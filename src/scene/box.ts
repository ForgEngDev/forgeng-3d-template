import type { Scene, StandardMesh } from "forgeng";

type MeshTransform = {
  setRotation(x: number, y: number, z: number): void;
  setPosition(x: number, y: number, z: number): void;
};

/** Narandžasta kocka — rotira se i pomera se WASD-om. */
export class Box {
  private mesh: StandardMesh | null = null;
  private x = 0;
  private readonly y = 0.75;
  private z = 0;
  private rotating = true;

  /** Pola platforme (8×8) minus pola kocke, da ne padne sa ivice */
  private readonly limit = 3.25;
  private readonly speed = 3.2;

  public async build(scene: Scene): Promise<void> {
    this.mesh = await scene.add
      .cube(1.5)
      .setColor(0.9, 0.45, 0.2, 1)
      .at(this.x, this.y, this.z)
      .build();
  }

  public move(dx: number, dz: number, dt: number): void {
    if (!this.mesh) return;
    this.x = clamp(this.x + dx * this.speed * dt, -this.limit, this.limit);
    this.z = clamp(this.z + dz * this.speed * dt, -this.limit, this.limit);
    this.transform().setPosition(this.x, this.y, this.z);
  }

  /** Vrati kocku u centar (npr. taster E). */
  public resetPosition(): void {
    this.x = 0;
    this.z = 0;
    this.mesh && this.transform().setPosition(this.x, this.y, this.z);
  }

  /** Q — pauza / nastavak rotacije. */
  public toggleRotation(): boolean {
    this.rotating = !this.rotating;
    return this.rotating;
  }

  public update(timeSeconds: number): void {
    if (!this.mesh || !this.rotating) return;
    this.transform().setRotation(0, timeSeconds * 1.2, 0);
  }

  public destroy(): void {
    this.mesh?.destroy();
    this.mesh = null;
  }

  private transform(): MeshTransform {
    return this.mesh!.transform as unknown as MeshTransform;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
