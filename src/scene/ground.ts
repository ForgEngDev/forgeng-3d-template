import type { Scene, StandardMesh } from "forgeng";

/** Podloga 8×8 ispod kocke. */
export class Ground {
  private mesh: StandardMesh | null = null;

  public async build(scene: Scene): Promise<void> {
    // setScale(1,1,1) zadržava kvadrat — engine inače skalira plane po width/height
    this.mesh = await scene.add
      .plane(8, 8)
      .setScale(1, 1, 1)
      .setColor(0.18, 0.24, 0.35, 1)
      .at(0, 0, 0)
      .build();
  }

  public destroy(): void {
    this.mesh?.destroy();
    this.mesh = null;
  }
}
