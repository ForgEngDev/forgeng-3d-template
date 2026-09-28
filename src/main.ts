import ForgEng from "forgeng";
import { DOM_UI_SHELL_PROVIDER_DESCRIPTOR } from "@forgeng/ui-dom";
import { GameScene } from "./scene/gameScene";

/**
 * Engine entry point, similar to a Phaser Game config.
 * Configure the canvas, size, render profile, UI provider, and scene list here.
 * Scene content lives in src/scene/, not in this file.
 */
ForgEng.create({
  canvas: {
    target: "#game",
    layout: "viewport",
  },

  // Optional: use a fixed resolution instead of the viewport.
  // size: { width: 1280, height: 720, autoResize: true },

  // Built-in DomUiShell with a side panel, notifications, and settings.
  providers: {
    ui: DOM_UI_SHELL_PROVIDER_DESCRIPTOR,
  },

  render: {
    startupRenderProfile: "Balanced", // Performance | Balanced | Quality | Cinematic
    backgroundColor: "#10141d",
  },

  scenes: [GameScene],
  boot: { scene: "main" },
});
