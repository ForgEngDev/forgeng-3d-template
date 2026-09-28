/** Single source of truth for active controls, HUD display, and input wiring. */
export const ACTIVE_CONTROLS = [
  { id: "wasd", label: "Keyboard · WASD", help: "Move the cube — you can walk off the edge" },
  { id: "arrows", label: "Keyboard · Arrow keys", help: "Same movement as WASD" },
  { id: "space", label: "Keyboard · Space", help: "Jump" },
  { id: "e", label: "Keyboard · E", help: "Reset the cube to the center" },
  { id: "lmb", label: "Mouse · Left click", help: "Jump" },
  { id: "touch", label: "Touch · Tap", help: "Jump" },
] as const;

export type ControlId = (typeof ACTIVE_CONTROLS)[number]["id"];

/** Callbacks for input actions. */
export interface ControllerHandlers {
  onJump?: (source: "space" | "mouse-left" | "touch") => void;
  onReset?: () => void;
  /** WASD / arrow keys, fired once on the initial key press. */
  onMove?: (key: string, label: string) => void;
}

/**
 * Input is limited to keys listed in ACTIVE_CONTROLS.
 */
export class Controller {
  private readonly keys = new Set<string>();
  private onKeyDown: ((event: KeyboardEvent) => void) | null = null;
  private onKeyUp: ((event: KeyboardEvent) => void) | null = null;
  private onPointer: ((event: PointerEvent) => void) | null = null;
  private canvas: HTMLElement | null = null;
  private handlers: ControllerHandlers = {};

  public setup(handlers: ControllerHandlers = {}, canvasSelector = "#game"): void {
    this.destroy();
    this.handlers = handlers;

    this.onKeyDown = (event: KeyboardEvent) => {
      const code = event.code;

      if (MOVEMENT_LABELS[code]) {
        event.preventDefault();
        const firstPress = !this.keys.has(code) && !event.repeat;
        this.keys.add(code);
        if (firstPress) {
          const info = MOVEMENT_LABELS[code]!;
          this.handlers.onMove?.(info.key, info.label);
        }
        return;
      }

      if (event.repeat) return;

      if (code === "Space") {
        event.preventDefault();
        this.handlers.onJump?.("space");
        return;
      }

      if (code === "KeyE") {
        event.preventDefault();
        this.handlers.onReset?.();
      }
    };

    this.onKeyUp = (event: KeyboardEvent) => {
      this.keys.delete(event.code);
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.canvas = document.querySelector(canvasSelector);
    if (this.canvas) {
      this.onPointer = (event: PointerEvent) => {
        if (event.button === 0) {
          const source = event.pointerType === "touch" ? "touch" : "mouse-left";
          this.handlers.onJump?.(source);
        }
      };
      this.canvas.addEventListener("pointerdown", this.onPointer);
    }
  }

  /** Normalized WASD movement direction on the XZ plane. */
  public getMoveDirection(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) z -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) z += 1;

    const len = Math.hypot(x, z);
    if (len > 0) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  public destroy(): void {
    if (this.onKeyDown) window.removeEventListener("keydown", this.onKeyDown);
    if (this.onKeyUp) window.removeEventListener("keyup", this.onKeyUp);
    if (this.canvas && this.onPointer) {
      this.canvas.removeEventListener("pointerdown", this.onPointer);
    }
    this.onKeyDown = null;
    this.onKeyUp = null;
    this.onPointer = null;
    this.canvas = null;
    this.keys.clear();
    this.handlers = {};
  }
}

const MOVEMENT_LABELS: Record<string, { key: string; label: string }> = {
  KeyW: { key: "W", label: "forward" },
  KeyS: { key: "S", label: "backward" },
  KeyA: { key: "A", label: "left" },
  KeyD: { key: "D", label: "right" },
  ArrowUp: { key: "↑", label: "forward" },
  ArrowDown: { key: "↓", label: "backward" },
  ArrowLeft: { key: "←", label: "left" },
  ArrowRight: { key: "→", label: "right" },
};
