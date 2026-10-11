import type { CompanionPose } from "./CompanionPose";

// Neck attachment pixels in the existing 128×112 normalized pose frames.
// Shared by the skin sheets, rather than a separate skin catalog or edited artwork.
const NECK_PIXELS = [
  [88, 77], [90, 77], [91, 78], [93, 76], [90, 77],
  [87, 68], [88, 75], [92, 89], [89, 75], [90, 95],
  [89, 76], [90, 74], [90, 75], [89, 75], [90, 95],
] as const;

export function companionAccessory(pose: CompanionPose, frame: string | number, nowMs: number, reducedMotion: boolean) {
  const [pixelX, pixelY] = NECK_PIXELS[Number(frame)] ?? NECK_PIXELS[1];
  const dx = (pixelX / 128 - .5) * pose.width, dy = (pixelY / 112 - 1) * pose.height;
  const angle = pose.angle * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const x = pose.x + dx * cos - dy * sin, y = pose.y + dx * sin + dy * cos;
  return { x, y, bellX: x - sin, bellY: y + cos,
    collarAngle: pose.angle - 16, bellAngle: pose.angle + (reducedMotion ? 0 : Math.sin(nowMs / 210) * 2) };
}
