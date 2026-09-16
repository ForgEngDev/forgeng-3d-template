# ForgEng 3D Template

Starter template for **ForgEng** 3D games (WebGPU, Vite, TypeScript).

Same structure as the 2D template: `main.ts` is engine config; scene content lives under `src/scene/`.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000/](http://localhost:3000/).

```bash
npm run build
npm run preview
```

## Layout

```text
src/
  main.ts              # ForgEng.create — canvas, providers, scenes
  scene/
    gameScene.ts       # scene wiring (create, update, destroy)
    camera.ts
    light.ts
    ground.ts          # platform plane
    box.ts             # orange cube (move + rotate)
    controller.ts      # WASD / mouse / touch
    hud.ts             # DomUiShell: Kontrole + Metrike
  vendor/forgeng/      # vendored ForgEng runtime + DomUiShell
css/style.css
index.html
```

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move cube on the platform |
| Space / left click / tap | Action toast |
| E | Reset cube to center |
| Q | Pause / resume rotation |
| Right / middle click | Secondary / tertiary toast |

Advanced metrics: toggle in the side panel, or open with `?advanced=1`.

## Notes

- Perspective camera, ambient + directional light
- Orange cube on an 8×8 platform
- Requires a browser with **WebGPU**

## Sibling template

2D starter: [forgeng-2d-template](https://github.com/ForgEngDev/forgeng-2d-template)

## License

See [LICENSE](./LICENSE).

- **Template / game code:** free to use and improve for client-side games.
- **ForgEng engine** (vendored under `src/vendor/forgeng/`): installation on
  other computers as an engine/SDK and commercial use are strictly forbidden.

