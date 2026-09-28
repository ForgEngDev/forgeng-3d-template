import type { Scene, StandardMesh } from "forgeng";

type MeshTransform = {
  setPosition(x: number, y: number, z: number): void;
};

/** Player cube with movement, jumping, platform collision, and fall recovery. */
export class Box {
  private mesh: StandardMesh | null = null;
  private x = 0;
  private y = 0.75;
  private z = 0;
  private verticalSpeed = 0;
  private grounded = true;

  /** Half the platform minus half the cube: beyond this point the cube falls. */
  private readonly platformLimit = 3.25;
  private readonly groundY = 0.75;
  private readonly speed = 3.2;
  private readonly jumpSpeed = 7;
  private readonly gravity = -18;
  private readonly resetY = -8;

  public async build(scene: Scene): Promise<void> {
    this.mesh = await scene.add
      .cube(1.5)
      .setColor(0.9, 0.45, 0.2, 1)
      .at(this.x, this.y, this.z)
      .build();
  }

  public move(dx: number, dz: number, dt: number): void {
    if (!this.mesh) return;
    this.x += dx * this.speed * dt;
    this.z += dz * this.speed * dt;
    this.transform().setPosition(this.x, this.y, this.z);
  }

  /** Jump only while standing on the platform. */
  public jump(): boolean {
    if (!this.mesh || !this.grounded) return false;
    this.verticalSpeed = this.jumpSpeed;
    this.grounded = false;
    return true;
  }

  /** Reset the complete player state, for example after falling or pressing E. */
  public resetPosition(): void {
    this.x = 0;
    this.y = this.groundY;
    this.z = 0;
    this.verticalSpeed = 0;
    this.grounded = true;
    this.mesh && this.transform().setPosition(this.x, this.y, this.z);
  }

  /** Apply gravity, land on the platform, and report an automatic fall reset. */
  public update(dt: number): boolean {
    if (!this.mesh) return false;

    const supported = this.isOverPlatform();
    if (this.grounded && !supported) {
      this.grounded = false;
    }

    if (!this.grounded) {
      const previousY = this.y;
      this.verticalSpeed += this.gravity * dt;
      this.y += this.verticalSpeed * dt;

      if (
        supported
        && this.verticalSpeed <= 0
        && previousY >= this.groundY
        && this.y <= this.groundY
      ) {
        this.y = this.groundY;
        this.verticalSpeed = 0;
        this.grounded = true;
      }
    }

    this.transform().setPosition(this.x, this.y, this.z);

    if (this.y < this.resetY) {
      this.resetPosition();
      return true;
    }
    return false;
  }

  public destroy(): void {
    this.mesh?.destroy();
    this.mesh = null;
  }

  private transform(): MeshTransform {
    return this.mesh!.transform as unknown as MeshTransform;
  }

  private isOverPlatform(): boolean {
    return Math.abs(this.x) <= this.platformLimit && Math.abs(this.z) <= this.platformLimit;
  }
}
