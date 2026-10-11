import { RUN } from "../game/Constants";

export class DifficultySystem {
  private elapsedSeconds = 0;

  constructor(private readonly speedMultiplier = 1) {}

  get elapsed(): number {
    return this.elapsedSeconds;
  }

  get speed(): number {
    return Math.min(RUN.maxSpeed, RUN.initialSpeed + this.elapsedSeconds * RUN.speedAcceleration) * this.speedMultiplier;
  }

  update(deltaSeconds: number): number {
    if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) this.elapsedSeconds += deltaSeconds;
    return this.speed;
  }

  reset(): void {
    this.elapsedSeconds = 0;
  }
}
