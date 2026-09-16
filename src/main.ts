import ForgEng from "forgeng";
import { DOM_UI_SHELL_PROVIDER_DESCRIPTOR } from "@forgeng/ui-dom";
import { GameScene } from "./scene/gameScene";

/**
 * Engine ulaz (kao Phaser Game config).
 * Ovde podešavaš canvas, veličinu, render profil, UI provider i spisak scena.
 * Sadržaj scene živi u src/scene/ — ne ovde.
 */
ForgEng.create({
  canvas: {
    target: "#game",
    layout: "viewport",
  },

  // Opciono: fiksna rezolucija umesto viewport-a
  // size: { width: 1280, height: 720, autoResize: true },

  // Ugrađeni DomUiShell (side-panel, notifikacije, settings…)
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
