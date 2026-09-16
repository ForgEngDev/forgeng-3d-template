/** Jedan izvor istine: šta je aktivno u Controller-u (prikaz u HUD-u + wiring). */
export const ACTIVE_CONTROLS = [
  { id: "wasd", label: "Tastatura · WASD", help: "Pomeranje kocke po platformi" },
  { id: "arrows", label: "Tastatura · Strelice", help: "Isto kretanje kao WASD" },
  { id: "space", label: "Tastatura · Space", help: "Akcija + notifikacija" },
  { id: "e", label: "Tastatura · E", help: "Reset pozicije kocke" },
  { id: "q", label: "Tastatura · Q", help: "Pauza / nastavak rotacije" },
  { id: "lmb", label: "Miš · Levi klik", help: "Ista akcija kao Space" },
  { id: "rmb", label: "Miš · Desni klik", help: "Sekundarna akcija" },
  { id: "mmb", label: "Miš · Srednji klik", help: "Tercijarna akcija" },
  { id: "touch", label: "Touch · Tap", help: "Ista akcija kao Space" },
] as const;

export type ControlId = (typeof ACTIVE_CONTROLS)[number]["id"];

/** Callback-ovi za ulazne akcije. */
export interface ControllerHandlers {
  onAction?: (source: "space" | "mouse-left" | "touch") => void;
  onInteract?: () => void;
  onToggleRotate?: () => void;
  onMouseRight?: () => void;
  onMouseMiddle?: () => void;
  /** WASD / strelice — jednom pri prvom pritisku tastera */
  onMove?: (key: string, label: string) => void;
}

/**
 * Ulaz: samo tasteri iz ACTIVE_CONTROLS.
 */
export class Controller {
  private readonly keys = new Set<string>();
  private onKeyDown: ((event: KeyboardEvent) => void) | null = null;
  private onKeyUp: ((event: KeyboardEvent) => void) | null = null;
  private onPointer: ((event: PointerEvent) => void) | null = null;
  private onContextMenu: ((event: Event) => void) | null = null;
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
        this.handlers.onAction?.("space");
        return;
      }

      if (code === "KeyE") {
        event.preventDefault();
        this.handlers.onInteract?.();
        return;
      }

      if (code === "KeyQ") {
        event.preventDefault();
        this.handlers.onToggleRotate?.();
      }
    };

    this.onKeyUp = (event: KeyboardEvent) => {
      this.keys.delete(event.code);
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.canvas = document.querySelector(canvasSelector);
    if (this.canvas) {
      this.onContextMenu = (event) => event.preventDefault();
      this.canvas.addEventListener("contextmenu", this.onContextMenu);

      this.onPointer = (event: PointerEvent) => {
        // 0 = levi, 1 = srednji, 2 = desni
        if (event.button === 0) {
          const source = event.pointerType === "touch" ? "touch" : "mouse-left";
          this.handlers.onAction?.(source);
          return;
        }
        if (event.button === 1) {
          event.preventDefault();
          this.handlers.onMouseMiddle?.();
          return;
        }
        if (event.button === 2) {
          event.preventDefault();
          this.handlers.onMouseRight?.();
        }
      };
      this.canvas.addEventListener("pointerdown", this.onPointer);
    }
  }

  /** Jedinični pravac kretanja iz WASD (XZ ravan). */
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
    if (this.canvas && this.onContextMenu) {
      this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    }
    this.onKeyDown = null;
    this.onKeyUp = null;
    this.onPointer = null;
    this.onContextMenu = null;
    this.canvas = null;
    this.keys.clear();
    this.handlers = {};
  }
}

const MOVEMENT_LABELS: Record<string, { key: string; label: string }> = {
  KeyW: { key: "W", label: "napred" },
  KeyS: { key: "S", label: "nazad" },
  KeyA: { key: "A", label: "levo" },
  KeyD: { key: "D", label: "desno" },
  ArrowUp: { key: "↑", label: "napred" },
  ArrowDown: { key: "↓", label: "nazad" },
  ArrowLeft: { key: "←", label: "levo" },
  ArrowRight: { key: "→", label: "desno" },
};
