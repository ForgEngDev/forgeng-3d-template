import type { UiDisposable, UiShellLike } from "@forgeng/ui-dom";
import { ACTIVE_CONTROLS } from "./controller";

/** Izvor metrika iz engine-a / scene (prosledi iz GameScene). */
export interface MetricsSource {
  getRenderCounters(): {
    drawCalls?: number;
    triangles?: number;
    vertices?: number;
  };
  getSystemInfo(): { gpu: string; ramGB?: number; cpuCores?: number };
  getMSAA(): number;
  getQualityProfile(): string;
  getCanvasSize(): { width: number; height: number };
  getGpuMemoryMB?: () => number | null;
}

function readAdvancedFromUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("advanced");
  } catch {
    return false;
  }
}

/**
 * Engine GUI: početnici vide Kontrole + status;
 * napredne Metrike tek preko toggle-a ili ?advanced=1.
 */
export class Hud {
  private readonly disposers: UiDisposable[] = [];
  private ui: UiShellLike | null = null;
  private source: MetricsSource | null = null;
  private styleEl: HTMLStyleElement | null = null;

  private advanced = false;
  private fps = 0;
  private frameMs = 0;
  private timeSeconds = 0;
  private frames = 0;
  private fpsTimer = 0;

  public setup(ui: UiShellLike, source: MetricsSource, sceneName = "main"): void {
    this.destroy();
    this.ui = ui;
    this.source = source;
    this.advanced = readAdvancedFromUrl();

    this.hideDefaultEngineChrome(ui, sceneName);
    this.applyAdvancedMode(this.advanced);

    // 1) Kontrole — lista iz ACTIVE_CONTROLS (isti izvor kao Controller)
    this.disposers.push(
      ui.settings.register({
        id: "template.controls",
        title: "Kontrole",
        fields: [
          {
            id: "status",
            label: "Status",
            kind: "status",
            read: () => `Spreman · ${this.fps} FPS`,
          },
          ...ACTIVE_CONTROLS.map((control) => ({
            id: `ctrl-${control.id}`,
            label: control.label,
            kind: "status" as const,
            read: () => control.help,
          })),
          {
            id: "advanced",
            label: "Napredne metrike",
            kind: "boolean",
            read: () => this.advanced,
            write: (value: string | number | boolean | null) => {
              this.setAdvanced(value === true);
            },
          },
          {
            id: "advanced-hint",
            label: "Tip",
            kind: "status",
            read: () =>
              this.advanced
                ? "Metrike su uključene (?advanced=1)"
                : "Uključi gore ili otvori ?advanced=1",
          },
        ],
      }),
    );
    this.disposers.push(
      ui.contributions.register({
        id: "template.controls.panel",
        title: "Kontrole",
        slot: "side-panel",
        order: 10,
        settingsSchemaId: "template.controls",
      }),
    );

    // 2) Metrike — registrovane uvek, vidljive samo u advanced režimu
    this.disposers.push(
      ui.settings.register({
        id: "template.metrics",
        title: "Metrike",
        fields: [
          { id: "fps", label: "FPS", kind: "status", read: () => String(this.fps) },
          {
            id: "frame-ms",
            label: "Frame time",
            kind: "status",
            read: () => `${this.frameMs.toFixed(1)} ms`,
          },
          {
            id: "time",
            label: "Vreme scene",
            kind: "status",
            read: () => `${this.timeSeconds.toFixed(1)} s`,
          },
          {
            id: "draw-calls",
            label: "Draw calls",
            kind: "status",
            read: () => this.readCounter("drawCalls"),
          },
          {
            id: "triangles",
            label: "Trouglovi",
            kind: "status",
            read: () => this.readCounter("triangles"),
          },
          {
            id: "vertices",
            label: "Vertices",
            kind: "status",
            read: () => this.readCounter("vertices"),
          },
          {
            id: "quality",
            label: "Quality profil",
            kind: "status",
            read: () => this.source?.getQualityProfile() ?? "—",
          },
          {
            id: "msaa",
            label: "MSAA",
            kind: "status",
            read: () => {
              const n = this.source?.getMSAA();
              return n != null ? `${n}x` : "—";
            },
          },
          {
            id: "resolution",
            label: "Rezolucija",
            kind: "status",
            read: () => {
              const size = this.source?.getCanvasSize();
              return size ? `${size.width}×${size.height}` : "—";
            },
          },
          {
            id: "gpu-mem",
            label: "GPU memorija",
            kind: "status",
            read: () => {
              const mb = this.source?.getGpuMemoryMB?.();
              return mb != null && Number.isFinite(mb) ? `${mb.toFixed(1)} MB` : "—";
            },
          },
          {
            id: "gpu",
            label: "GPU",
            kind: "status",
            read: () => this.source?.getSystemInfo().gpu || "—",
          },
          {
            id: "cpu",
            label: "CPU jezgra",
            kind: "status",
            read: () => {
              const cores = this.source?.getSystemInfo().cpuCores;
              return cores != null ? String(cores) : "—";
            },
          },
          {
            id: "ram",
            label: "RAM (uređaj)",
            kind: "status",
            read: () => {
              const ram = this.source?.getSystemInfo().ramGB;
              return ram != null ? `${ram} GB` : "—";
            },
          },
        ],
      }),
    );
    this.disposers.push(
      ui.contributions.register({
        id: "template.metrics.panel",
        title: "Metrike",
        slot: "side-panel",
        order: 20,
        settingsSchemaId: "template.metrics",
      }),
    );
  }

  public update(dt: number): void {
    this.timeSeconds += dt;
    this.frames += 1;
    this.fpsTimer += dt;

    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsTimer);
      this.frameMs = this.fps > 0 ? 1000 / this.fps : 0;
      this.frames = 0;
      this.fpsTimer = 0;
      this.ui?.settings.refresh("template.controls");
      if (this.advanced) {
        this.ui?.settings.refresh("template.metrics");
      }
    }
  }

  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private toastEl: HTMLElement | null = null;

  /**
   * Feedback poruka.
   * Ne koristimo ui.notifications — DomUiShell pri settings.refresh() radi
   * replaceChildren() na floating-overlay i obriše toast (~0.5s).
   */
  public notify(message: string, durationMs = 6000): void {
    if (typeof document === "undefined") return;

    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
    }

    const toast = this.ensureToast();
    toast.innerHTML = `<strong>Kontroler</strong><span>${escapeHtml(message)}</span>`;
    toast.hidden = false;

    this.notifyTimer = setTimeout(() => {
      toast.hidden = true;
      this.notifyTimer = null;
    }, durationMs);
  }

  public destroy(): void {
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
    }
    this.toastEl?.remove();
    this.toastEl = null;

    for (const d of this.disposers.splice(0).reverse()) {
      void d.dispose();
    }
    this.styleEl?.remove();
    this.styleEl = null;
    if (typeof document !== "undefined") {
      delete document.body.dataset.templateAdvanced;
    }
    this.ui = null;
    this.source = null;
  }

  private ensureToast(): HTMLElement {
    if (this.toastEl) return this.toastEl;

    const toast = document.createElement("div");
    toast.className = "template-toast";
    toast.hidden = true;
    document.body.appendChild(toast);
    this.toastEl = toast;
    return toast;
  }

  private setAdvanced(enabled: boolean): void {
    this.advanced = enabled;
    this.applyAdvancedMode(enabled);
    this.syncAdvancedUrl(enabled);
    this.ui?.settings.refresh("template.controls");
    if (enabled) this.ui?.settings.refresh("template.metrics");
  }

  private applyAdvancedMode(enabled: boolean): void {
    if (typeof document === "undefined") return;
    document.body.dataset.templateAdvanced = enabled ? "1" : "0";
  }

  private syncAdvancedUrl(enabled: boolean): void {
    try {
      const url = new URL(window.location.href);
      if (enabled) url.searchParams.set("advanced", "1");
      else url.searchParams.delete("advanced");
      window.history.replaceState({}, "", url);
    } catch {
      // ignore (npr. file://)
    }
  }

  private hideDefaultEngineChrome(ui: UiShellLike, _sceneName: string): void {
    ui.preferences.update({
      layout: {
        sidePanelWidth: 340,
        sidePanelCollapsed: false,
        hiddenSlots: ["top-bar", "bottom-status"],
      },
    });

    // Ne zovi surfaces.hide() — DomUiShell tada radi structuredClone na chrome
    // surface content-u (sa mountContent) i puca: "must contain cloneable data".
    // Sakrivamo chrome / Exit / Audio / Renderer samo CSS-om.
    if (typeof document === "undefined") return;

    this.styleEl = document.createElement("style");
    this.styleEl.id = "template-ui-focus";
    this.styleEl.textContent = `
      /* Scene chrome (naslov "main" + Exit) */
      .forgeng-ui-surface[data-surface-id$=".chrome"],
      .forgeng-ui-surface[data-surface-id$=".menu"] {
        display: none !important;
      }

      /* Ugrađene engine kartice */
      .forgeng-ui-card[data-contribution-id="forgeng.renderer.webgpu.debug"],
      .forgeng-ui-card[data-contribution-id="forgeng.audio.webaudio.panel"],
      .forgeng-ui-card[data-contribution-id="forgeng.assets.health.panel"] {
        display: none !important;
      }

      /* Metrike samo u advanced režimu */
      body[data-template-advanced="0"] .forgeng-ui-card[data-contribution-id="template.metrics.panel"] {
        display: none !important;
      }

      .forgeng-ui-shell {
        --fg-side-width: 340px;
      }
      .forgeng-ui-slot[data-slot="side-panel"] {
        top: 12px;
        bottom: 12px;
      }
      .forgeng-ui-slot[data-slot="top-bar"] {
        display: none !important;
      }
    `;
    document.head.appendChild(this.styleEl);
  }

  private readCounter(key: "drawCalls" | "triangles" | "vertices"): string {
    const value = this.source?.getRenderCounters()?.[key];
    return typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "—";
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
