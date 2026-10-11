(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const context = canvas.getContext("2d", { alpha: false });
  const stage = document.getElementById("gameStage");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const jumpButton = document.getElementById("jumpButton");
  const scoreValue = document.getElementById("scoreValue");
  const bestValue = document.getElementById("bestValue");
  const finalScore = document.getElementById("finalScore");
  const bestMessage = document.getElementById("bestMessage");
  const gameStatus = document.getElementById("gameStatus");

  const WIDTH = 480;
  const HEIGHT = 270;
  const GROUND_Y = 218;
  const PLAYER_X = 80;
  const PLAYER_W = 42;
  const PLAYER_H = 38;
  const BEST_KEY = "sheep-run-best-v1";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const colors = {
    ink: "#4a382f",
    inkLight: "#725b48",
    sky: "#b4ddd1",
    skyLight: "#e7f0c5",
    cloud: "#fff1d5",
    hillFar: "#aecb83",
    hillNear: "#82ad6c",
    grass: "#6c9c5c",
    grassLight: "#9fc76b",
    grassDark: "#3f704b",
    mint: "#8fc276",
    soil: "#b8774d",
    soilLight: "#d79a61",
    wood: "#a96b48",
    woodLight: "#d09458",
    woodDark: "#6b493b",
    wool: "#fff7da",
    woolShade: "#ded4b7",
    face: "#c28d6a",
    coral: "#d96d54",
    yellow: "#f5c85d",
  };

  const backgroundCanvas = document.createElement("canvas");
  backgroundCanvas.width = WIDTH;
  backgroundCanvas.height = HEIGHT;
  const backgroundContext = backgroundCanvas.getContext("2d", { alpha: false });
  backgroundContext.imageSmoothingEnabled = false;
  let backgroundReady = false;

  const sheepImage = new Image();
  const sheepTextureCanvas = document.createElement("canvas");
  const sheepTextureContext = sheepTextureCanvas.getContext("2d");
  let sheepImageReady = false;
  let sheepTextureCrop = null;

  function isNearWhite(data, index) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    return red > 232 && green > 232 && blue > 232 && Math.max(red, green, blue) - Math.min(red, green, blue) < 18;
  }

  function prepareSheepTexture() {
    try {
      const width = sheepImage.naturalWidth;
      const height = sheepImage.naturalHeight;
      sheepTextureCanvas.width = width;
      sheepTextureCanvas.height = height;
      sheepTextureContext.imageSmoothingEnabled = false;
      sheepTextureContext.drawImage(sheepImage, 0, 0);
      const imageData = sheepTextureContext.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      const visited = new Uint8Array(width * height);
      const queue = [];
      const seed = (x, y) => {
        const position = y * width + x;
        if (!visited[position] && isNearWhite(pixels, position * 4)) queue.push(position);
      };

      for (let x = 0; x < width; x += 1) {
        seed(x, 0);
        seed(x, height - 1);
      }
      for (let y = 1; y < height - 1; y += 1) {
        seed(0, y);
        seed(width - 1, y);
      }

      while (queue.length) {
        const position = queue.pop();
        if (visited[position]) continue;
        const x = position % width;
        const y = Math.floor(position / width);
        if (!isNearWhite(pixels, position * 4)) continue;
        visited[position] = 1;
        pixels[position * 4 + 3] = 0;
        if (x > 0) queue.push(position - 1);
        if (x < width - 1) queue.push(position + 1);
        if (y > 0) queue.push(position - width);
        if (y < height - 1) queue.push(position + width);
      }

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (pixels[(y * width + x) * 4 + 3] <= 8) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      if (maxX < 0 || maxY < 0) throw new Error("sheep texture has no visible subject");
      const padding = 3;
      sheepTextureCrop = {
        x: Math.max(0, minX - padding),
        y: Math.max(0, minY - padding),
        w: Math.min(width - Math.max(0, minX - padding), maxX - Math.max(0, minX - padding) + padding * 2 + 1),
        h: Math.min(height - Math.max(0, minY - padding), maxY - Math.max(0, minY - padding) + padding * 2 + 1),
      };
      sheepTextureContext.putImageData(imageData, 0, 0);
      sheepImageReady = true;
    } catch {
      sheepImageReady = false;
      gameStatus.textContent = "小羊素材无法读取，使用像素备用贴图";
    }
  }

  sheepImage.addEventListener("load", prepareSheepTexture);
  sheepImage.addEventListener("error", () => {
    sheepImageReady = false;
    gameStatus.textContent = "小羊素材无法读取，使用像素备用贴图";
  });
  sheepImage.src = "assets/cartoon-sheep-pixel-design_61878-536.avif";

  const random = (min, max) => min + Math.random() * (max - min);
  const formatScore = (value) => String(Math.max(0, Math.floor(value))).padStart(5, "0");

  function readBest() {
    try {
      const saved = Number(window.localStorage.getItem(BEST_KEY));
      return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // Gameplay remains available when storage is blocked.
    }
  }

  const game = {
    state: "ready",
    lastTime: 0,
    elapsed: 0,
    distance: 0,
    bonus: 0,
    score: 0,
    best: readBest(),
    speed: 190,
    player: { y: GROUND_Y - PLAYER_H, vy: 0, grounded: true },
    obstacles: [],
    stars: [],
    particles: [],
    obstacleTimer: 1.2,
    starTimer: 1.6,
    groundOffset: 0,
    cloudOffset: 0,
    cameraShake: 0,
    hitFlash: 0,
    wasNewBest: false,
  };

  bestValue.textContent = formatScore(game.best);

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    context.imageSmoothingEnabled = false;
  }

  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas);
  window.addEventListener("orientationchange", resizeCanvas);
  window.addEventListener("resize", resizeCanvas);

  function setOverlay(element, visible) {
    element.classList.toggle("is-hidden", !visible);
    element.setAttribute("aria-hidden", String(!visible));
  }

  function resetRun() {
    game.elapsed = 0;
    game.distance = 0;
    game.bonus = 0;
    game.score = 0;
    game.speed = 190;
    game.player.y = GROUND_Y - PLAYER_H;
    game.player.vy = 0;
    game.player.grounded = true;
    game.obstacles = [];
    game.stars = [];
    game.particles = [];
    game.obstacleTimer = 1.25;
    game.starTimer = 1.1;
    game.cameraShake = 0;
    game.hitFlash = 0;
    game.wasNewBest = false;
    scoreValue.textContent = formatScore(0);
    setOverlay(startOverlay, false);
    setOverlay(gameOverOverlay, false);
    gameStatus.textContent = "小羊开始奔跑";
  }

  function startRun() {
    if (game.state === "running") return;
    resetRun();
    game.state = "running";
    game.lastTime = performance.now();
  }

  function jump() {
    if (game.state === "ready") {
      startRun();
      return;
    }
    if (game.state !== "running" || !game.player.grounded) return;
    game.player.vy = -500;
    game.player.grounded = false;
    addDust(PLAYER_X + 15, GROUND_Y - 2, 7);
  }

  function finishRun() {
    if (game.state !== "running") return;
    game.state = "game-over";
    game.wasNewBest = game.score > game.best;
    if (game.wasNewBest) {
      game.best = game.score;
      saveBest(game.best);
      bestValue.textContent = formatScore(game.best);
    }
    finalScore.textContent = formatScore(game.score);
    bestMessage.textContent = game.wasNewBest ? "新的牧场纪录，太棒了！" : "星星会记住你的纪录。";
    gameStatus.textContent = `游戏结束，得分 ${game.score}。点击再跑一次。`;
    game.cameraShake = reduceMotion.matches ? 0 : 11;
    game.hitFlash = 0.8;
    setOverlay(gameOverOverlay, true);
  }

  function addDust(x, y, amount) {
    for (let i = 0; i < amount; i += 1) {
      game.particles.push({
        x: x + random(-7, 7),
        y: y + random(-3, 1),
        vx: random(-75, 35),
        vy: random(-72, -14),
        life: random(0.22, 0.48),
        maxLife: 0.48,
        size: random(2, 5),
        color: i % 2 ? colors.cloud : colors.yellow,
      });
    }
  }

  function spawnObstacle() {
    const height = Math.round(random(27, 35));
    game.obstacles.push({
      x: WIDTH + 18,
      y: GROUND_Y - height,
      w: Math.round(random(27, 34)),
      h: height,
      passed: false,
      stripe: Math.random() > 0.5,
    });
  }

  function spawnStar() {
    const baseY = random(GROUND_Y - 110, GROUND_Y - 64);
    game.stars.push({
      x: WIDTH + 14,
      y: baseY,
      baseY,
      r: 8,
      phase: random(0, Math.PI * 2),
      collected: false,
    });
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt) {
    game.elapsed += dt;
    game.speed = Math.min(390, 190 + game.elapsed * 5.1);
    game.distance += game.speed * dt * 0.12;
    game.groundOffset = (game.groundOffset + game.speed * dt) % 32;
    game.cloudOffset = (game.cloudOffset + game.speed * dt * 0.08) % 500;
    game.obstacleTimer -= dt;
    game.starTimer -= dt;

    if (game.obstacleTimer <= 0) {
      spawnObstacle();
      game.obstacleTimer = random(1.25, 1.9) * Math.max(0.72, 190 / game.speed);
    }
    if (game.starTimer <= 0) {
      spawnStar();
      game.starTimer = random(1.55, 2.25);
    }

    game.player.vy += 1450 * dt;
    game.player.y += game.player.vy * dt;
    if (game.player.y >= GROUND_Y - PLAYER_H) {
      if (!game.player.grounded && game.player.vy > 100) addDust(PLAYER_X + 22, GROUND_Y - 1, 4);
      game.player.y = GROUND_Y - PLAYER_H;
      game.player.vy = 0;
      game.player.grounded = true;
    }

    const playerBox = {
      x: PLAYER_X + 7,
      y: game.player.y + 6,
      w: PLAYER_W - 12,
      h: PLAYER_H - 8,
    };

    for (const obstacle of game.obstacles) {
      obstacle.x -= game.speed * dt;
      if (overlaps(playerBox, { x: obstacle.x + 3, y: obstacle.y + 7, w: obstacle.w - 6, h: obstacle.h - 7 })) {
        finishRun();
        break;
      }
      if (!obstacle.passed && obstacle.x + obstacle.w < PLAYER_X) {
        obstacle.passed = true;
        game.bonus += 25;
        addDust(obstacle.x + obstacle.w, GROUND_Y - 3, 3);
      }
    }
    game.obstacles = game.obstacles.filter((item) => item.x + item.w > -20);

    for (const star of game.stars) {
      star.x -= game.speed * dt;
      star.phase += dt * 5;
      star.y = star.baseY + Math.sin(star.phase) * 4;
      const dx = PLAYER_X + PLAYER_W * 0.55 - star.x;
      const dy = game.player.y + PLAYER_H * 0.48 - star.y;
      if (!star.collected && Math.hypot(dx, dy) < 25) {
        star.collected = true;
        game.bonus += 100;
        addDust(star.x, star.y, 9);
      }
    }
    game.stars = game.stars.filter((item) => !item.collected && item.x > -20);

    for (const particle of game.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 185 * dt;
    }
    game.particles = game.particles.filter((particle) => particle.life > 0);

    game.score = Math.floor(game.distance + game.bonus);
    scoreValue.textContent = formatScore(game.score);
    game.cameraShake = Math.max(0, game.cameraShake - dt * 28);
    game.hitFlash = Math.max(0, game.hitFlash - dt * 2.6);
  }

  function drawCloud(x, y, scale = 1, target = context) {
    target.fillStyle = colors.cloud;
    const blocks = [
      [8, 10, 34, 9],
      [15, 3, 19, 9],
      [23, 0, 18, 9],
      [36, 7, 16, 9],
      [0, 13, 13, 6],
      [43, 13, 15, 6],
    ];
    for (const [bx, by, bw, bh] of blocks) {
      target.fillRect(Math.round(x + bx * scale), Math.round(y + by * scale), Math.round(bw * scale), Math.round(bh * scale));
    }
  }

  function drawHill(offset, y, width, color, peakHeight, target = context) {
    target.fillStyle = color;
    const start = -((offset * 0.25) % width) - width;
    for (let x = start; x < WIDTH + width; x += width) {
      target.beginPath();
      target.moveTo(x, y);
      target.lineTo(x + width * 0.5, y - peakHeight);
      target.lineTo(x + width, y);
      target.closePath();
      target.fill();
    }
  }

  function drawCropRows(offset, target = context) {
    const start = -((offset * 0.45) % 44) - 44;
    for (let x = start; x < WIDTH + 44; x += 44) {
      const cropX = Math.round(x + 11);
      const cropY = 199;
      target.fillStyle = colors.grassDark;
      target.fillRect(cropX, cropY + 5, 3, 11);
      target.fillRect(cropX + 9, cropY + 3, 3, 13);
      target.fillStyle = colors.mint;
      target.fillRect(cropX - 3, cropY + 3, 7, 4);
      target.fillRect(cropX + 8, cropY, 7, 4);
      target.fillStyle = colors.yellow;
      target.fillRect(cropX + 2, cropY + 7, 4, 4);
    }
  }

  function buildStaticBackground() {
    const target = backgroundContext;
    target.fillStyle = colors.sky;
    target.fillRect(0, 0, WIDTH, HEIGHT);

    target.fillStyle = colors.yellow;
    target.fillRect(378, 37, 28, 28);
    target.fillStyle = colors.soilLight;
    target.fillRect(384, 32, 16, 4);
    target.fillRect(384, 66, 16, 4);
    target.fillRect(373, 44, 4, 14);
    target.fillRect(409, 44, 4, 14);

    drawHill(0, 177, 180, colors.hillFar, 43, target);
    drawHill(58, 194, 146, colors.hillNear, 31, target);
    drawCropRows(0, target);

    target.fillStyle = colors.grass;
    target.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
    target.fillStyle = colors.grassLight;
    target.fillRect(0, GROUND_Y, WIDTH, 5);
    target.fillStyle = colors.soil;
    target.fillRect(0, GROUND_Y + 11, WIDTH, HEIGHT - GROUND_Y - 11);
    target.fillStyle = colors.soilLight;
    target.fillRect(0, GROUND_Y + 11, WIDTH, 4);
    backgroundReady = true;
  }

  function drawBackground() {
    if (!backgroundReady) buildStaticBackground();
    context.drawImage(backgroundCanvas, 0, 0, WIDTH, HEIGHT);

    drawCloud(80 - game.cloudOffset * 0.6, 58, 0.7);
    drawCloud(334 - game.cloudOffset, 92, 0.52);
    drawCloud(540 - game.cloudOffset * 0.45, 47, 0.48);

    for (let x = -game.groundOffset; x < WIDTH; x += 32) {
      const gx = Math.round(x);
      context.fillStyle = colors.grassDark;
      context.fillRect(gx + 5, GROUND_Y + 24, 12, 3);
      context.fillRect(gx + 22, GROUND_Y + 42, 6, 3);
      context.fillStyle = colors.grassLight;
      context.fillRect(gx + 24, GROUND_Y + 12, 3, 7);
      context.fillRect(gx + 25, GROUND_Y + 10, 7, 3);
      context.fillStyle = colors.soilLight;
      context.fillRect(gx + 7, GROUND_Y + 30, 8, 3);
      context.fillRect(gx + 22, GROUND_Y + 54, 7, 3);
    }

    const fenceLineOffset = game.groundOffset % 142;
    context.fillStyle = colors.woodDark;
    context.fillRect(-fenceLineOffset, GROUND_Y + 5, WIDTH + 142, 4);
    context.fillStyle = colors.woodLight;
    context.fillRect(-fenceLineOffset, GROUND_Y + 5, WIDTH + 142, 2);
    for (let x = -fenceLineOffset; x < WIDTH; x += 36) {
      context.fillStyle = colors.woodDark;
      context.fillRect(Math.round(x), GROUND_Y + 1, 5, 16);
      context.fillStyle = colors.woodLight;
      context.fillRect(Math.round(x + 1), GROUND_Y + 2, 2, 10);
    }
  }

  function drawFence(obstacle) {
    const x = Math.round(obstacle.x);
    const y = Math.round(obstacle.y);
    const postW = 8;
    context.fillStyle = colors.woodDark;
    context.fillRect(x, y + 5, postW, obstacle.h - 5);
    context.fillRect(x + obstacle.w - postW, y + 5, postW, obstacle.h - 5);
    context.fillRect(x - 2, y + 4, obstacle.w + 4, 8);
    context.fillStyle = colors.woodLight;
    context.fillRect(x + 2, y + 6, obstacle.w - 4, 3);
    context.fillRect(x + 2, y + 16, obstacle.w - 4, 5);
    context.fillStyle = colors.coral;
    if (obstacle.stripe) {
      context.fillRect(x + 6, y + 17, 6, 4);
      context.fillRect(x + 19, y + 17, 5, 4);
    }
    context.fillStyle = colors.woodDark;
    context.fillRect(x - 1, GROUND_Y - 2, obstacle.w + 2, 4);
  }

  function drawStar(star) {
    context.save();
    context.translate(Math.round(star.x), Math.round(star.y));
    context.rotate(Math.sin(star.phase) * 0.12);
    context.fillStyle = colors.ink;
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 11 : 5;
      const px = Math.round(Math.cos(angle) * radius);
      const py = Math.round(Math.sin(angle) * radius);
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.fillStyle = colors.yellow;
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 8 : 4;
      const px = Math.round(Math.cos(angle) * radius);
      const py = Math.round(Math.sin(angle) * radius);
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.fillStyle = colors.cloud;
    context.fillRect(-1, -5, 2, 4);
    context.restore();
  }

  function drawSheep() {
    const x = Math.round(PLAYER_X) - 2;
    const y = Math.round(game.player.y);
    const legFrame = game.state === "running" && game.player.grounded ? Math.floor(game.elapsed * 13) % 2 : 0;

    context.fillStyle = "rgba(74, 56, 47, 0.22)";
    context.fillRect(x + 5, GROUND_Y + 1, 35, 5);

    if (sheepImageReady && sheepTextureCrop) {
      const textureWidth = 48;
      const textureHeight = Math.round(textureWidth * sheepTextureCrop.h / sheepTextureCrop.w);
      const textureX = x - 3;
      const textureY = y + PLAYER_H - textureHeight;
      context.drawImage(
        sheepTextureCanvas,
        sheepTextureCrop.x,
        sheepTextureCrop.y,
        sheepTextureCrop.w,
        sheepTextureCrop.h,
        textureX,
        textureY,
        textureWidth,
        textureHeight,
      );
      return;
    }

    drawPixelSheep(x, y, legFrame);
  }

  function drawPixelSheep(x, y, legFrame) {
    const scale = 3;
    const sprite = [
      ".....OOO.......",
      "...OOWWO.......",
      "..OWWWWWOOO....",
      ".OWWWWWWWOFOO..",
      "OWWWWWWWWOFFEN.",
      "OWWWWWWWWWOFFO.",
      "OWWWWWWWWOOO...",
      ".OWWWWWWO......",
      "..OOSSSOO......",
    ];
    const spriteColors = {
      O: colors.ink,
      W: colors.wool,
      S: colors.woolShade,
      F: colors.face,
      E: colors.ink,
      N: colors.coral,
    };

    // Tail sits behind the fixed grid sprite so it cannot cut through the body.
    context.fillStyle = colors.ink;
    context.fillRect(x - 3, y + 18, 7, 7);
    context.fillStyle = colors.wool;
    context.fillRect(x - 2, y + 17, 5, 5);

    for (let row = 0; row < sprite.length; row += 1) {
      for (let column = 0; column < sprite[row].length; column += 1) {
        const cell = sprite[row][column];
        if (cell === ".") continue;
        context.fillStyle = spriteColors[cell];
        context.fillRect(x + column * scale, y + row * scale, scale, scale);
      }
    }

    const legY = y + 27;
    const leftLegLift = legFrame ? 3 : 0;
    const rightLegLift = legFrame ? 0 : 3;
    context.fillStyle = colors.ink;
    context.fillRect(x + 10, legY + leftLegLift, 7, 9 - leftLegLift);
    context.fillRect(x + 25, legY + rightLegLift, 7, 9 - rightLegLift);
    context.fillStyle = colors.face;
    context.fillRect(x + 11, legY + leftLegLift + 4, 5, 5);
    context.fillRect(x + 26, legY + rightLegLift + 4, 5, 5);

    context.fillStyle = colors.ink;
    context.fillRect(x + 33, y + 12, 3, 3);
  }

  function drawParticles() {
    for (const particle of game.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.fillRect(Math.round(particle.x), Math.round(particle.y), Math.max(2, Math.round(particle.size)), Math.max(2, Math.round(particle.size)));
    }
    context.globalAlpha = 1;
  }

  function drawIdleDecoration() {
    if (game.state !== "ready") return;
    const bob = Math.sin(performance.now() / 360) * 3;
    game.player.y = GROUND_Y - PLAYER_H + bob;
    drawStar({ x: 172, y: 147 + Math.sin(performance.now() / 500) * 4, phase: performance.now() / 500 });
    drawStar({ x: 227, y: 128 + Math.sin(performance.now() / 400 + 1) * 3, phase: performance.now() / 400 });
  }

  function render() {
    context.save();
    if (game.cameraShake > 0 && !reduceMotion.matches) {
      context.translate(random(-game.cameraShake, game.cameraShake), random(-game.cameraShake * 0.35, game.cameraShake * 0.35));
    }
    drawBackground();
    drawIdleDecoration();
    for (const star of game.stars) drawStar(star);
    for (const obstacle of game.obstacles) drawFence(obstacle);
    drawSheep();
    drawParticles();
    context.restore();

    if (game.hitFlash > 0) {
      context.fillStyle = `rgba(255, 249, 233, ${game.hitFlash * 0.34})`;
      context.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  function frame(time) {
    if (!game.lastTime) game.lastTime = time;
    const dt = Math.min((time - game.lastTime) / 1000, 0.04);
    game.lastTime = time;
    if (game.state === "running") update(dt);
    else {
      game.groundOffset = (game.groundOffset + 22 * dt) % 32;
      game.cloudOffset = (game.cloudOffset + 2 * dt) % 500;
    }
    render();
    window.requestAnimationFrame(frame);
  }

  stage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    event.preventDefault();
    if (game.state === "ready") startRun();
    else if (game.state === "running") jump();
  }, { passive: false });

  startButton.addEventListener("click", (event) => {
    event.stopPropagation();
    startRun();
  });

  restartButton.addEventListener("click", (event) => {
    event.stopPropagation();
    startRun();
  });

  jumpButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    jump();
  }, { passive: false });
  jumpButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.detail === 0) jump();
  });

  window.addEventListener("keydown", (event) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === " " || key === "arrowup" || key === "w") {
      event.preventDefault();
      if (game.state === "game-over") startRun();
      else jump();
    } else if (key === "enter" && game.state !== "running") {
      startRun();
    }
  });

  document.addEventListener("visibilitychange", () => {
    game.lastTime = performance.now();
  });

  window.requestAnimationFrame(frame);
})();
