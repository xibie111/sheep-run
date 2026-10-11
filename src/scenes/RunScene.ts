import Phaser from "phaser";
import { GAME_FEATURES, PLAYER, POOL, RUN, SCENE, WORLD } from "../game/Constants";
import type { SkinId } from "../data/sheepSkins";
import type { ResultSceneData } from "../game/GameState";
import { Obstacle } from "../entities/Obstacle";
import { Sheep } from "../entities/Sheep";
import { Star } from "../entities/Star";
import { OBSTACLE_DEFINITIONS } from "../game/ObstacleDefinitions";
import { POWER_UP_DEFINITIONS } from "../data/powerups";
import { PowerUp } from "../entities/PowerUp";
import { CollisionSystem } from "../systems/CollisionSystem";
import { InputSystem } from "../systems/InputSystem";
import { DifficultySystem } from "../systems/DifficultySystem";
import { SpawnSystem } from "../systems/SpawnSystemOwner";
import { PowerUpSystem, type PowerUpType } from "../systems/PowerUpSystem";
import { ProgressionSystem } from "../systems/ProgressionSystem";
import { ScoreSystem, type StarAward } from "../systems/ScoreSystem";
import { AudioSystem } from "../systems/AudioSystem";
import { EnvironmentSystem } from "../environment/EnvironmentSystem";
import { seasonAtScore } from "../environment/SeasonProgress";
import { runViewportOrigin, runViewportRight, viewportSizeFromScale, watchViewport } from "../game/Viewport";
import { addDisplayText } from "../ui/DisplayText";
import { attachRunHudArt } from "../ui/RunHudArt";
import { createRunPauseTarget } from "../ui/RunPauseTarget";
import { containsRunPausePoint, runHudLayout } from "../ui/RunHudLayout";
import type { ArtRect } from "../ui/MenuArtLayout";
import { attachRunEasterEggs } from "../ui/EasterEggs";
import { RunFeedback } from "../ui/RunFeedback";
import { HiddenCollectionRun } from "../ui/HiddenCollectionRun";
import { CompanionController } from "../companions/CompanionController";
import { SaveSystem } from "../systems/SaveSystem";
import { JourneyRun, journeyStore } from "../systems/JourneyStore";
import { collectionStore } from "../systems/CollectionStore";
import { JourneyToast } from "../ui/JourneyToast";
import { AmbientLifeController } from "../ambient/AmbientLifeController";
import { ANIMAL_TEXTURE } from "../ambient/animalAssets";
import { SceneryController } from "../scenery/SceneryController";
import { crowdedForAnimal } from "../ambient/AnimalRules";
import { DELIVERY_ID, DELIVERY_SEED, DeliveryRoute } from '../delivery/DeliveryRoute';
import { DeliveryView } from '../delivery/DeliveryView';
import { attachDeliveryHud } from '../delivery/DeliveryHud';
import { createDeliveryPanel } from '../delivery/DeliveryPanel';
import { deliveryStore } from '../delivery/DeliveryStore';

export class RunScene extends Phaser.Scene {
  static readonly CONTROL_HINT = GAME_FEATURES.dash
    ? "点按跳跃，上滑高跳，下滑蹲伏，长按冲刺。"
    : "点按跳跃，上滑高跳，下滑蹲伏。";

  private sheep!: Sheep;
  private readonly scoreSystem = new ScoreSystem();
  private obstacles!: Phaser.Physics.Arcade.Group;
  private stars!: Phaser.Physics.Arcade.Group;
  private powerUps!: Phaser.Physics.Arcade.Group;
  private readonly powerUpHudSlots = new Map<PowerUpType, { icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.BitmapText }>();
  private readonly powerUpSystem = new PowerUpSystem();
  private upgradeEffects = ProgressionSystem.effectsFor({ jump: 0, speed: 0, magnet: 0, dash: 0 });
  private selectedSkin: SkinId = "white";
  private audioSystem!: AudioSystem;
  private activeRunTimeMs = 0;
  private wasGrounded = true;
  private wasDashing = false;
  private environmentSystem: EnvironmentSystem | null = null;
  private pauseButton?: Phaser.GameObjects.Container;
  private starMilestone: number | null = null;
  private milestoneTimer: Phaser.Time.TimerEvent | null = null;
  private readonly inputSystem = new InputSystem();
  private readonly spawnSystem = new SpawnSystem();
  private difficultySystem = new DifficultySystem();
  private readonly onPointerCancel = (): void => this.inputSystem.cancel();
  private readonly onWindowBlur = (): void => this.pauseRun();
  private readonly onVisibilityChange = (): void => { if (document.visibilityState === "hidden") this.pauseRun(); };
  private readonly onPageHide = (): void => this.pauseRun();
  private finished = false;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private runFeedback?: RunFeedback;
  private hiddenCollections?: HiddenCollectionRun;
  private companions?: CompanionController;
  private journey?: JourneyRun;
  private journeyToast?: JourneyToast;
  private ambientLife?: AmbientLifeController;
  private rareScenery?: SceneryController;
  private delivery?: DeliveryRoute;
  private deliveryView?: DeliveryView;
  private deliveryPanel?: ReturnType<typeof createDeliveryPanel>;

  constructor() {
    super({ key: SCENE.run });
  }

  init(data?: { deliveryId?: string }): void {
    this.delivery = data?.deliveryId === DELIVERY_ID ? new DeliveryRoute() : undefined;
    this.data.set('delivery-id', this.delivery ? DELIVERY_ID : null);
    // Launch data can be retained by Phaser; only an explicit route start opts in.
    if (data) delete data.deliveryId;
  }

  private refreshProgression(): void {
    const runProgression = ProgressionSystem.currentRun();
    this.upgradeEffects = runProgression.effects;
    this.selectedSkin = runProgression.skinId;
    this.difficultySystem = new DifficultySystem(this.upgradeEffects.worldSpeedMultiplier);
  }

  create(): void {
    this.inputSystem.reset();
    this.refreshProgression();
    this.activeRunTimeMs = 0;
    this.powerUpHudSlots.clear();
    this.wasGrounded = true;
    this.wasDashing = false;
    this.audioSystem = this.registry.get("audioSystem") as AudioSystem | undefined ?? new AudioSystem();
    this.registry.set("audioSystem", this.audioSystem);
    this.scoreSystem.beginRun();
    if (!this.delivery) this.spawnSystem.reset(undefined, this.upgradeEffects.jumpImpulseMultiplier);
    this.difficultySystem.reset();
    this.powerUpSystem.reset();
    this.finished = false;
    if (!this.delivery) {
      journeyStore.reconcile(SaveSystem.load().unlockedSkins, collectionStore.load().ids);
      this.journey = new JourneyRun(journeyStore, ids => this.journeyToast?.achievements(ids));
    }
    this.starMilestone = null;
    const viewport = viewportSizeFromScale(this.scale);

    this.environmentSystem = new EnvironmentSystem(this, { reducedMotion: this.reducedMotion, calmAtmosphere: true, ...(this.delivery ? { seed: DELIVERY_SEED } : {}) });
    if (this.delivery) { this.environmentSystem.setTheme('spring'); this.environmentSystem.setWeather('sunny'); }

    // Viewport expansion changes what the camera sees, not the player's physics.
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.groundY);
    this.sheep = new Sheep(this, this.upgradeEffects.jumpImpulseMultiplier, this.selectedSkin);
    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.stars = this.physics.add.group({ allowGravity: false, immovable: true });
    this.powerUps = this.physics.add.group({ allowGravity: false, immovable: true });
    if (!this.delivery) this.companions = new CompanionController(this, {
      lead: this.sheep, leadSkin: this.selectedSkin,
      unlockedSkins: () => SaveSystem.load().unlockedSkins,
      playBell: () => this.audioSystem.play("bell"),
      onSummoned: () => this.journey?.summon(),
      jumpImpulseMultiplier: this.upgradeEffects.jumpImpulseMultiplier, reducedMotion: this.reducedMotion,
    });
    new CollisionSystem(this).connect(this.sheep, this.obstacles, this.stars, {
      onObstacle: (obstacle) => this.onObstacleOverlap(obstacle),
      onStar: (star) => this.onStarOverlap(star),
      onPowerUp: (powerUp) => this.onPowerUpOverlap(powerUp),
    }, this.powerUps);

    this.pauseButton = createRunPauseTarget(this, () => {
      this.audioSystem.initializeAfterGesture();
      this.audioSystem.play("button");
      this.pauseRun();
    });
    if (this.delivery) {
      this.deliveryView = new DeliveryView(this, this.sheep, this.selectedSkin, this.reducedMotion);
      attachDeliveryHud(this, this.delivery, this.pauseButton);
      this.deliveryPanel = createDeliveryPanel(this, {
        start: () => this.scene.restart({ deliveryId: DELIVERY_ID }),
        exit: () => this.scene.start(SCENE.menu, { openMailbox: true }),
      });
    } else {
      attachRunHudArt(this, () => ({ score: this.scoreSystem.score, best: this.scoreSystem.bestAtStart,
        stars: this.scoreSystem.starCount, streak: this.scoreSystem.streak, milestone: this.starMilestone }), this.pauseButton);
      attachRunEasterEggs(this, () => this.scoreSystem.score);
      if (this.game.canvas?.parentElement && this.game.events) {
        this.runFeedback = new RunFeedback(this, this.sheep);
        this.hiddenCollections = new HiddenCollectionRun(this, this.sheep, this.runFeedback);
        this.journeyToast = new JourneyToast(this);
      }
      if (this.textures?.exists(ANIMAL_TEXTURE)) this.ambientLife = new AmbientLifeController(this, this.reducedMotion);
      this.rareScenery = new SceneryController(this, this.reducedMotion, message => this.journeyToast?.notice(message));
    }
    let previousViewport = viewport;
    watchViewport(this, (size) => {
      if (size.width !== previousViewport.width || size.height !== previousViewport.height) {
        // A resize changes pointer-to-world coordinates; it is not a swipe.
        this.inputSystem.cancel();
        previousViewport = size;
      }
      const origin = runViewportOrigin(size);
      this.cameras.main.setScroll(-origin.x, -origin.y);
    });

    this.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.onPreUpdate, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.game.canvas.addEventListener("pointercancel", this.onPointerCancel);
    window.addEventListener("blur", this.onWindowBlur);
    window.addEventListener("pagehide", this.onPageHide);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    const status = document.getElementById("game-status");
    if (status) status.textContent = RunScene.CONTROL_HINT;
  }

  override update(_time: number, deltaMs: number): void {
    if (this.finished) return;
    const activeDeltaMs = Math.max(0, Math.min(deltaMs, RUN.simulationDeltaCapMs));
    if (this.delivery) { this.updateDelivery(activeDeltaMs); return; }
    const deltaSeconds = activeDeltaMs / 1000;
    const speed = this.difficultySystem.update(deltaSeconds);
    this.scoreSystem.update(speed, activeDeltaMs);
    this.environmentSystem?.update(this.scoreSystem.travelledDistancePx, activeDeltaMs, this.scoreSystem.score);
    this.journey?.visit(seasonAtScore(this.scoreSystem.score));
    this.spawnObjects(deltaSeconds);
    this.moveObjects(deltaSeconds);
    this.powerUpSystem.update(this.activeRunTimeMs);
    this.updatePowerUpHud(this.activeRunTimeMs);
    this.runFeedback?.update(this.activeRunTimeMs, activeDeltaMs, this.powerUpSystem.activeEffects(this.activeRunTimeMs));
    this.hiddenCollections?.update(deltaSeconds, speed, this.scoreSystem.score);
    this.journeyToast?.update(activeDeltaMs);
    if (this.companions) {
      const badge = this.children.getByName("hidden-collection") as Phaser.GameObjects.Image | null;
      const pickups = [...this.stars.getChildren(), ...this.powerUps.getChildren(), ...(badge ? [badge] : [])]
        .filter(object => object.active && (object as Phaser.GameObjects.Sprite).visible)
        .map(object => (object as Phaser.GameObjects.Sprite).getBounds());
      this.companions.update({ nowMs: this.activeRunTimeMs, deltaSeconds, speed,
        viewport: viewportSizeFromScale(this.scale), obstacles: this.obstacles.getChildren() as Obstacle[], pickups });
    }
    if (this.rareScenery && this.environmentSystem) {
      const importantNotice = !!this.game.canvas.parentElement?.querySelector('[data-adventure-overlay="journey-toast"][style*="display: block"],[data-adventure-overlay="collection-toast"][style*="display: block"],[data-easter-egg="score"][style*="display: block"]');
      this.rareScenery.update({ nowMs: this.activeRunTimeMs, deltaMs: activeDeltaMs,
        landscape: this.environmentSystem.presentation(), viewport: viewportSizeFromScale(this.scale),
        blocked: importantNotice || this.starMilestone !== null || this.ambientLife?.scheduler.state === 'playing' ||
          this.companions?.scheduler.state === 'bell' || this.companions?.scheduler.state === 'companion' || crowdedForAnimal(this.obstacles.getChildren() as Obstacle[], speed) });
    }
    if (this.ambientLife && this.environmentSystem) this.ambientLife.update({
      nowMs: this.activeRunTimeMs, speed, viewport: viewportSizeFromScale(this.scale),
      landscape: this.environmentSystem.presentation(), obstacles: this.obstacles.getChildren() as Obstacle[],
      companionState: this.companions?.scheduler.state, milestoneVisible: this.starMilestone !== null || this.rareScenery?.busy,
    });
  }

  private updateDelivery(deltaMs: number): void {
    const route = this.delivery!;
    const speed = route.state === 'running' ? this.difficultySystem.update(deltaMs / 1000) : 0;
    for (const request of route.advance(deltaMs, speed)) {
      const obstacle = this.acquireObstacle(request.definition, request.phase);
      obstacle?.setData('delivery-at', request.at);
      obstacle?.activate(WORLD.width + 18 + request.at - route.distance, request.phase, 0, 'spring');
    }
    for (const object of this.obstacles.getChildren()) if (object instanceof Obstacle && object.active) {
      const body = object.body as Phaser.Physics.Arcade.Body;
      // Authored world positions are frame-rate independent and use the existing body.
      body.reset(WORLD.width + 18 + Number(object.getData('delivery-at')) - route.distance, WORLD.groundY - object.definition.groundOffset);
      if (object.visualRightEdge < this.obstacleRecycleX) object.deactivate();
    }
    this.environmentSystem?.update(route.distance * .15, deltaMs, 0);
    if (route.state === 'ending') {
      this.inputSystem.cancel(); this.physics.pause();
      (this.sheep.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }
    this.deliveryView?.update(route, this.activeRunTimeMs);
    if (route.state === 'complete') {
      this.finished = true; this.pauseButton!.input!.enabled = false;
      const result = deliveryStore.complete(DELIVERY_ID);
      this.audioSystem.play('bell');
      this.deliveryPanel?.show('success', !result.saved);
    }
  }

  private get speed(): number {
    return this.difficultySystem.speed;
  }

  private get obstacleRecycleX(): number {
    // Wide viewports reveal road behind world x=0. Recycle only beyond that
    // visible edge, with the existing offscreen margin for pixel rounding.
    return -runViewportOrigin(viewportSizeFromScale(this.scale)).x - 20;
  }

  private spawnObjects(deltaSeconds: number): void {
    // Convert the visible right edge to world space; camera expansion preserves
    // the player-to-entry distance, scheduled gaps and existing pool lifetimes.
    const visibleRight = runViewportRight(viewportSizeFromScale(this.scale));
    for (const request of this.spawnSystem.update(deltaSeconds, this.speed)) {
      if (request.type === "obstacle") {
        const obstacle = this.acquireObstacle(request.definition, request.phase);
        obstacle?.activate(visibleRight + 18, request.phase, this.speed, seasonAtScore(this.scoreSystem.score));
        this.companions?.observeObstacleSpawn(request, obstacle);
      } else if (request.type === "star") {
        const star = this.acquireStar();
        star?.activate(visibleRight + 14, request.y, request.phase, this.speed);
      } else {
        const powerUp = this.acquirePowerUp(request.powerUp);
        powerUp?.activate(visibleRight + 14, request.y, request.powerUp, request.phase, this.speed);
      }
    }
  }

  private acquireObstacle(definition: (typeof OBSTACLE_DEFINITIONS)[number], phase: number): Obstacle | null {
    const children = this.obstacles.getChildren();
    const reusable = children.find((child): child is Obstacle =>
      child instanceof Obstacle && !child.active && child.definition.kind === definition.kind,
    );
    if (reusable) return reusable;

    const countOfKind = children.filter((child) => child instanceof Obstacle && child.definition.kind === definition.kind).length;
    if (countOfKind >= POOL.obstaclesPerKind) return null;

    const obstacle = new Obstacle(this, runViewportRight(viewportSizeFromScale(this.scale)) + 18, definition, phase);
    this.obstacles.add(obstacle);
    return obstacle;
  }

  private acquireStar(): Star | null {
    const children = this.stars.getChildren();
    const reusable = children.find((child): child is Star => child instanceof Star && !child.active);
    if (reusable) return reusable;
    if (children.filter((child) => child instanceof Star).length >= POOL.stars) return null;

    const star = new Star(this, runViewportRight(viewportSizeFromScale(this.scale)) + 14, WORLD.groundY - 80, 0);
    this.stars.add(star);
    return star;
  }

  private acquirePowerUp(type: PowerUpType): PowerUp | null {
    const children = this.powerUps.getChildren();
    const reusable = children.find((child): child is PowerUp => child instanceof PowerUp && !child.active);
    if (reusable) return reusable;
    if (children.filter((child) => child instanceof PowerUp).length >= POOL.powerUps) return null;

    const powerUp = new PowerUp(this, runViewportRight(viewportSizeFromScale(this.scale)) + 14, WORLD.groundY - 84, type, 0);
    this.powerUps.add(powerUp);
    return powerUp;
  }

  private moveObjects(deltaSeconds: number): void {
    const playerX = PLAYER.x;
    const obstacleChildren = this.obstacles.getChildren();
    for (const child of obstacleChildren) {
      if (!(child instanceof Obstacle) || !child.active) continue;
      child.moveAt(this.speed, deltaSeconds);
      if (!child.passed && child.rightEdge < playerX) {
        child.passed = true;
        this.audioSystem.play("nearMiss");
        this.scoreSystem.awardPassedObstacle();
        this.journey?.passed();
      }
      if (child.visualRightEdge < this.obstacleRecycleX) child.deactivate();
    }

    const starChildren = this.stars.getChildren();
    for (const child of starChildren) {
      if (!(child instanceof Star) || !child.active) continue;
      child.updateMotion(
        deltaSeconds,
        this.speed,
        this.powerUpSystem.isActive("magnet", this.activeRunTimeMs)
          ? { x: this.sheep.x, y: this.sheep.y - PLAYER.height / 2, radiusPx: this.upgradeEffects.magnetRadiusPx }
          : undefined,
      );
      if (child.x < PLAYER.x - 4) {
        if (!child.collected) {
          this.scoreSystem.missStar();
        }
        child.deactivate();
      }
    }

    const powerUpChildren = this.powerUps.getChildren();
    for (const child of powerUpChildren) {
      if (!(child instanceof PowerUp) || !child.active) continue;
      child.updateMotion(deltaSeconds, this.speed);
      if (child.x < -30) child.deactivate();
    }
  }

  private updatePowerUpHud(nowMs: number): void {
    const active = new Map(this.powerUpSystem.activeEffects(nowMs).map((effect) => [effect.type, effect.remainingMs]));
    POWER_UP_DEFINITIONS.forEach((definition, index) => {
      const remainingMs = active.get(definition.type);
      let slot = this.powerUpHudSlots.get(definition.type);
      if (remainingMs === undefined) {
        slot?.icon.setVisible(false);
        slot?.label.setVisible(false);
        return;
      }
      if (!slot) {
        const x = 80 + index * 92;
        slot = {
          icon: this.add.image(x, 54, definition.textureKey).setDisplaySize(14, 14).setDepth(30).setScrollFactor(0),
          label: addDisplayText(this, x + 11, 54, "", 10).setOrigin(0, 0.5).setDepth(30).setScrollFactor(0),
        };
        this.powerUpHudSlots.set(definition.type, slot);
      }
      slot.icon.setVisible(true);
      slot.label.setVisible(true).setText(`${definition.label} ${Math.ceil(remainingMs / 1000)}s`);
    });
  }

  private onPreUpdate(_time: number, deltaMs: number): void {
    if (this.finished) return;
    this.activeRunTimeMs += Math.max(0, Math.min(deltaMs, RUN.simulationDeltaCapMs));
    if (!this.delivery || this.delivery.state === 'running') this.updateInput(this.activeRunTimeMs);
  }

  private updateInput(now: number): void {
    const grounded = this.sheep.grounded;
    const frame = this.inputSystem.update(now, grounded, this.powerUpSystem.dashCooldownMs(this.activeRunTimeMs));
    if (!this.wasGrounded && grounded) {
      this.audioSystem.play("land");
      this.runFeedback?.land(this.sheep.x, this.sheep.y);
    }
    if (frame.jump !== null) {
      this.audioSystem.play("jump");
      this.sheep.applyJump(frame.jump);
    }
    if (frame.dashing && !this.wasDashing) this.audioSystem.play("dash");
    this.wasGrounded = grounded;
    this.wasDashing = frame.dashing;
    this.sheep.setDashing(frame.dashing);
    this.sheep.setCrouching(frame.crouching);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    const size = viewportSizeFromScale(this.scale);
    const origin = runViewportOrigin(size);
    const pause = this.pauseButton?.getData("hud-rect") as ArtRect | undefined
      ?? runHudLayout(size, { left: 0, right: 0, top: 0, bottom: 0 }).pause;
    if (containsRunPausePoint(pause, pointer.worldX + origin.x, pointer.worldY + origin.y)) return;
    this.audioSystem.initializeAfterGesture();
    this.forwardPointer("down", pointer);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    this.forwardPointer("move", pointer);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    this.forwardPointer("up", pointer);
  }

  private forwardPointer(type: "down" | "move" | "up", pointer: Phaser.Input.Pointer): void {
    if (this.finished || (this.delivery && this.delivery.state !== 'running')) return;
    this.inputSystem.handleGesture({
      type,
      pointerId: pointer.id,
      x: pointer.worldX,
      y: pointer.worldY,
      at: this.activeRunTimeMs,
    });
  }

  private pauseRun(): void {
    if (this.finished || this.scene.isActive(SCENE.pause)) return;
    this.inputSystem.cancel();
    this.scene.pause(SCENE.run);
    this.scene.launch(SCENE.pause);
  }

  private onObstacleOverlap(obstacleObject?: object): void {
    if (this.finished || this.inputSystem.isObstacleImmune(this.activeRunTimeMs)) return;
    if (this.powerUpSystem.consumeShield(this.activeRunTimeMs)) {
      this.runFeedback?.shieldBreak(this.sheep.x, this.sheep.y - this.sheep.displayHeight / 2);
      if (obstacleObject instanceof Obstacle) obstacleObject.deactivate();
      this.audioSystem.play("hit");
      this.updatePowerUpHud(this.activeRunTimeMs);
      return;
    }
    this.finished = true;
    this.ambientLife?.clear();
    this.rareScenery?.clear();
    this.companions?.clear();
    this.journeyToast?.clear();
    this.audioSystem.play("hit");
    this.physics.pause();
    this.sheep.motionState = "HIT";
    (this.sheep.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    if (this.delivery) {
      this.delivery.fail(); this.deliveryView?.stopCompanion(); this.inputSystem.cancel();
      this.pauseButton!.input!.enabled = false;
      this.deliveryPanel?.show('failure');
      return;
    }
    const scoreResult = this.scoreSystem.finish();
    const reward = new ProgressionSystem().awardRun(scoreResult.score);
    const result: ResultSceneData = { ...scoreResult, ...reward,
      ...(this.journey ? { achievements: this.journey.finish(scoreResult.newRecord) } : {}) };
    this.audioSystem.play(result.newRecord ? "newRecord" : "gameOver");
    if (!this.reducedMotion) this.cameras.main.shake(140, 0.003);
    this.time.delayedCall(460, () => this.scene.start(SCENE.result, result));
    const status = document.getElementById("game-status");
    if (status) status.textContent = `游戏结束，得分 ${result.score}。`;
  }

  private onPowerUpOverlap(powerUpObject: object): void {
    if (this.delivery || this.finished || !(powerUpObject instanceof PowerUp) || powerUpObject.collected) return;
    powerUpObject.collected = true;
    this.powerUpSystem.activate(powerUpObject.type, this.activeRunTimeMs);
    this.audioSystem.play("powerUp");
    this.runFeedback?.collect(powerUpObject.x, powerUpObject.y, powerUpObject.type === "shield" ? 0xa5e9ff : 0xffffff);
    this.updatePowerUpHud(this.activeRunTimeMs);
    powerUpObject.deactivate();
  }

  private onStarOverlap(starObject: object): void {
    if (this.delivery || this.finished || !(starObject instanceof Star) || starObject.collected) return;
    starObject.collected = true;
    const award = this.scoreSystem.awardStar(this.powerUpSystem.starMultiplier(this.activeRunTimeMs));
    this.journey?.star();
    this.audioSystem.play(award.streak > 2 ? "combo" : "starCollect");
    this.runFeedback?.collect(starObject.x, starObject.y);
    if (award.milestone !== null) this.showMilestone(award);
    starObject.deactivate();
  }

  private showMilestone(award: StarAward): void {
    if (award.milestone === null) return;
    this.starMilestone = award.milestone;
    this.milestoneTimer?.remove(false);
    this.milestoneTimer = this.time.delayedCall(1000, () => {
      this.starMilestone = null;
      this.milestoneTimer = null;
    });
    const status = document.getElementById("game-status");
    if (status) status.textContent = `收集到${award.milestone}颗星。`;
  }

  private onShutdown(): void {
    this.deliveryView?.clear(); this.deliveryView = undefined; this.deliveryPanel = undefined;
    this.delivery = undefined;
    this.ambientLife?.clear();
    this.ambientLife = undefined;
    this.rareScenery?.clear();
    this.rareScenery = undefined;
    this.journey?.clear();
    this.journey = undefined;
    this.journeyToast?.clear();
    this.journeyToast = undefined;
    this.companions?.clear();
    this.companions = undefined;
    this.runFeedback = undefined;
    this.hiddenCollections = undefined;
    this.environmentSystem?.clear();
    this.environmentSystem = null;
    this.milestoneTimer?.remove(false);
    this.milestoneTimer = null;
    this.starMilestone = null;
    this.inputSystem.cancel();
    this.events.off(Phaser.Scenes.Events.PRE_UPDATE, this.onPreUpdate, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.game.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    window.removeEventListener("blur", this.onWindowBlur);
    window.removeEventListener("pagehide", this.onPageHide);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }
}
