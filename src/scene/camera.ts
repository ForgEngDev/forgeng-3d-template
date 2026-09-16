import type { SceneCamera } from "forgeng";

/** Perspektivna kamera: dijagonalni 3/4 ugao na scenu. */
export function setupCamera(camera: SceneCamera): void {
  camera.setPosition(6, 6, 8);
  camera.setTarget(0, 0.5, 0);
  camera.setFOV(50);
  camera.updateMatrix();
}
