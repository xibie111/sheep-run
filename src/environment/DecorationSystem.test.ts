import { describe, expect, it } from "vitest";
import { DecorationSystem } from "./DecorationSystem";
import { DECORATION_CATALOG, generateDecorationPattern } from "./DecorationCatalog";

describe("DecorationSystem patterns", () => {
  it("produces stable instances for the same seed, chunk index, and theme", () => {
    expect(generateDecorationPattern(17, 12, "spring")).toEqual(generateDecorationPattern(17, 12, "spring"));
    expect(generateDecorationPattern(17, 12, "spring")).not.toEqual(generateDecorationPattern(18, 12, "spring"));
    expect(generateDecorationPattern(17, 12, "spring")).not.toEqual(generateDecorationPattern(17, 12, "winter"));
  });

  it("defines collision-free visual decorations with distinct obstacle texture keys", () => {
    expect(DECORATION_CATALOG.map(({ id }) => id)).toEqual(["tree", "flower", "fence", "barn", "hayBale", "barrel", "rock"]);
    expect(DECORATION_CATALOG.every((definition) => definition.collision === false)).toBe(true);
    expect(DECORATION_CATALOG.find(({ id }) => id === "fence")?.textureKey).not.toBe("fence");
    expect(DECORATION_CATALOG.find(({ id }) => id === "rock")?.textureKey).not.toBe("rock");
  });

  it("keeps large props out of the running lane and places only catalog entries", () => {
    const pattern = generateDecorationPattern(29, 4, "autumn");
    for (const item of pattern) {
      const definition = DECORATION_CATALOG.find(({ id }) => id === item.id);
      expect(definition).toBeDefined();
      expect(definition?.collision).toBe(false);
      if (definition?.layer !== "ground") expect(item.y).toBeLessThan(190);
      expect(item.y).not.toBe(218);
    }
  });

  it("scrolls midground and ground decorations at their visual layer ratios", () => {
    const positions: Array<[string, number, number]> = [];
    const scene = {
      add: {
        image: (_x: number, _y: number, texture: string) => ({
          setDepth() { return this; },
          setScale() { return this; },
          setFlipX() { return this; },
          setTexture() { return this; },
          setVisible() { return this; },
          setPosition(x: number, y: number) { positions.push([texture, x, y]); return this; },
          setScrollFactor() { return this; },
          destroy() { return this; },
        }),
      },
    };
    const decorations = new DecorationSystem(scene as never);
    decorations.attach(0, 0, [
      { id: "tree", x: 200, y: 150, scale: 1, flipX: false },
      { id: "flower", x: 200, y: 244, scale: 1, flipX: false },
    ]);

    decorations.update(100);

    expect(positions).toEqual([
      ["environment-tree", 40, 150],
      ["environment-flower", 100, 244],
    ]);
    decorations.destroy();
  });

  it("renders pooled images only and never registers a gameplay collider", () => {
    const images: Array<{ texture: string; destroy: boolean }> = [];
    const scene = {
      add: { image: (_x: number, _y: number, texture: string) => {
        const image = { texture, destroy: false };
        images.push(image);
        return {
          setDepth() { return this; },
          setScale() { return this; },
          setFlipX() { return this; },
          setTexture() { return this; },
          setVisible() { return this; },
          setPosition() { return this; },
          setScrollFactor() { return this; },
          destroy() { image.destroy = true; },
        };
      } },
      physics: { add: { existing: () => { throw new Error("decoration must never register a collider"); } } },
    };
    const decorations = new DecorationSystem(scene as never);
    decorations.attach(0, 0, generateDecorationPattern(4, 0, "spring"));
    const firstCount = images.length;
    decorations.detachChunk(0);
    const secondPattern = generateDecorationPattern(4, 1, "summer");
    const secondCount = secondPattern.length;
    decorations.attach(1, 480, secondPattern);
    expect(images.length).toBe(Math.max(firstCount, secondCount));
    decorations.destroy();
    expect(images.every((image) => image.destroy)).toBe(true);
  });

  it("uses the live visible right edge after the camera offset and aligns taller views vertically", () => {
    const images: Array<{ x: number; y: number; visible: boolean; scale: number }> = [];
    const scene = {
      scale: { gameSize: { width: 584, height: 270 } },
      add: {
        image(x: number, y: number) {
          const image = {
            x, y, visible: true, scale: 1,
            setDepth() { return this; },
            setScale(scale: number) { this.scale = scale; return this; },
            setFlipX() { return this; },
            setTexture() { return this; },
            setVisible(visible: boolean) { this.visible = visible; return this; },
            setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
            setScrollFactor() { return this; },
            destroy() {},
          };
          images.push(image);
          return image;
        },
      },
    };
    const decorations = new DecorationSystem(scene as never);
    decorations.attach(1, 480, [
      { id: "flower", x: 16, y: 244, scale: 2, flipX: false },
      { id: "flower", x: 65, y: 244, scale: 1, flipX: false },
    ]);
    decorations.update(0);
    expect(images[0]).toMatchObject({ x: 600, y: 244, visible: true, scale: 2 });
    expect(images[1]).toMatchObject({ x: 649, y: 244, visible: false, scale: 1 });

    scene.scale.gameSize = { width: 480, height: 360 };
    decorations.update(0);
    expect(images[0]).toMatchObject({ x: 496, y: 289, visible: true, scale: 2 });
    expect(images[1]).toMatchObject({ x: 545, y: 289, visible: false, scale: 1 });
    decorations.update(100);
    expect(images[0]).toMatchObject({ x: 396, y: 289, visible: true, scale: 2 });
    decorations.destroy();
  });
});
