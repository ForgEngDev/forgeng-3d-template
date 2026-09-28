import type { SceneCamera } from "forgeng";

/** Perspective camera with a diagonal three-quarter view of the scene. */
export function setupCamera(camera: SceneCamera): void {
  camera.setPosition(6, 6, 8);
  camera.setTarget(0, 0.5, 0);
  camera.setFOV(50);
  camera.updateMatrix();
}
