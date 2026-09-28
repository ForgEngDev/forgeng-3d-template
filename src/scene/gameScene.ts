import { Scene } from "forgeng";
import { setupCamera } from "./camera";
import { setupLight } from "./light";
import { Ground } from "./ground";
import { Box } from "./box";
import { Controller } from "./controller";
import { Hud } from "./hud";
import type { UiShellLike } from "@forgeng/ui-dom";

/**
 * Main game scene.
 * Compose the camera, lighting, objects, input, and GUI panels here.
 */
export class GameScene extends Scene {
  private readonly ground = new Ground();
  private readonly box = new Box();
  private readonly controller = new Controller();
  private readonly hud = new Hud();
  private time = 0;

  constructor(key = "main") {
    super(key);
  }

  protected override setupCamera(): void {
    setupCamera(this.camera);
  }

  public override async create(): Promise<void> {
    await this.getRenderApi().Experience.apply("ForgeDefault");

    setupLight(this);
    await this.ground.build(this);
    await this.box.build(this);

    // Engine DomUiShell: Controls are always visible; Metrics use ?advanced=1 or the toggle.
    const ui = this.getEngine().uiShell as UiShellLike | null;
    if (ui) {
      const engine = this.getEngine();
      this.hud.setup(ui, {
        getRenderCounters: () =>
          this.getRenderApi().getSceneRenderCounters() as {
            drawCalls?: number;
            triangles?: number;
            vertices?: number;
          },
        getSystemInfo: () => engine.getSystemInfo(),
        getMSAA: () => engine.Quality.getMSAA(),
        getQualityProfile: () =>
          engine.Quality.getLastAppliedProfile()?.committedProfile
          ?? engine.getStartupRenderProfile(),
        getCanvasSize: () => {
          const canvas = engine.getCanvas();
          return { width: canvas.width, height: canvas.height };
        },
        getGpuMemoryMB: () => {
          const maybe = engine as unknown as { getEstimatedGpuMemoryMB?: () => number };
          const mb = maybe.getEstimatedGpuMemoryMB?.();
          return typeof mb === "number" && Number.isFinite(mb) ? mb : null;
        },
      }, this.name);
    }

    this.controller.setup({
      onAction: (source) => {
        const label =
          source === "space"
            ? "Space — action"
            : source === "touch"
              ? "Touch — action"
              : "Left click — action";
        this.hud.notify(label);
      },
      onInteract: () => {
        this.box.resetPosition();
        this.hud.notify("E — cube reset to center");
      },
      onToggleRotate: () => {
        const on = this.box.toggleRotation();
        this.hud.notify(on ? "Q — rotation resumed" : "Q — rotation paused");
      },
      onMouseRight: () => {
        this.hud.notify("Right click — secondary action");
      },
      onMouseMiddle: () => {
        this.hud.notify("Middle click — tertiary action");
      },
      onMove: (key, label) => {
        this.hud.notify(`${key} — move ${label}`);
      },
    });
  }

  public override update(dt: number): void {
    super.update(dt);
    this.time += dt;

    const move = this.controller.getMoveDirection();
    this.box.move(move.x, move.z, dt);
    this.box.update(this.time);
    this.hud.update(dt);
  }

  public override destroy(): void {
    this.controller.destroy();
    this.hud.destroy();
    this.box.destroy();
    this.ground.destroy();
    super.destroy();
  }
}
