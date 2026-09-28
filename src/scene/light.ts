import type { Scene } from "forgeng";

/**
 * Cool ambient light plus warm directional sunlight.
 * The angled light gives the cube volume and creates clear ground shadows.
 */
export function setupLight(scene: Scene): void {
  scene.getRenderApi().setAmbientLight(0.3, 0.35, 0.45, 0.8);

  scene.add.directionalLight({
    direction: [-0.5, -1, -0.4],
    target: [0, 0.75, 0],
    intensity: 10.5,
    color: [1, 0.95, 0.9],
  });
}
