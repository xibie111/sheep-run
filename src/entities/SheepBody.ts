export interface SheepBodySyncPort {
  position: { x: number; y: number };
  prevFrame: { x: number; y: number };
  setSize(width: number, height: number): unknown;
  setOffset(x: number, y: number): unknown;
  updateFromGameObject(): unknown;
}

export interface SheepBodyGeometry {
  frameWidth: number;
  frameHeight: number;
  scaleX: number;
  scaleY: number;
  logicalWidth: number;
  logicalHeight: number;
}

export function syncSheepArcadeBody(body: SheepBodySyncPort, geometry: SheepBodyGeometry): void {
  const scaleX = Math.max(0.0001, Math.abs(geometry.scaleX));
  const scaleY = Math.max(0.0001, Math.abs(geometry.scaleY));
  const bodyWidth = (geometry.logicalWidth - 12) / scaleX;
  const bodyHeight = geometry.logicalHeight / scaleY;
  const oldX = body.position.x;
  const oldY = body.position.y;

  body.setSize(bodyWidth, bodyHeight);
  body.setOffset((geometry.frameWidth - bodyWidth) / 2, geometry.frameHeight - bodyHeight);
  body.updateFromGameObject();
  // Arcade postUpdate applies position - prevFrame to the sprite; exclude the hitbox-only shift.
  body.prevFrame.x += body.position.x - oldX;
  body.prevFrame.y += body.position.y - oldY;
}
