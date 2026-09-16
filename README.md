# ForgEng 3D Template

**TypeScript starter template for browser games** built with **[ForgEng](https://forgeng.dev)** — a **WebGPU-first**, modular game engine that runs directly in modern browsers (no native runtime install).

This repository is the **3D** starter sibling of [`forgeng-2d-template`](https://github.com/ForgEngDev/forgeng-2d-template). Use it to bootstrap client-side 3D scenes with Vite + TypeScript, then grow into the full ForgeNG 3.0 stack documented at [forgeng.dev](https://forgeng.dev).

> Keywords: `ForgEng`, `ForgeNG`, `TypeScript`, `WebGPU`, `3D game template`, `Vite`, `browser game engine`, `WGSL`, `ECS`, `transport`, `lighting`, `shadows`

## Why this template

[ForgEng / ForgeNG 3.0](https://forgeng.dev/en/forgeng-3.0/getting-started/overview) is the current stable **browser-first TypeScript** engine release. Public docs describe it as combining:

- the established **scene, ECS and 3D WebGPU runtime** under one lifecycle owner
- a **production 2D runtime** (sprites, tilemaps, text, particles, cameras, animation, collision, lighting, masks, hybrid composition) when you need 2D or hybrid work
- **versioned provider contracts** for input/actions, audio, physics, assets, gameplay, storage, **transport**, UI, animation and rendering
- manifest-driven assets, compressed formats, opt-in devtools and bounded performance observability

The marketing site positions the engine as **type-safe, GPU-first, web-native**: modern **WebGPU** pipelines, **WGSL** shaders, lighting, materials, shadows and post-processing, with composable scenes, ECS, providers and plugins — delivered as ordinary web assets on desktop/mobile browsers that support WebGPU ([forgeng.dev](https://forgeng.dev/en)).

This template gives you a **minimal, runnable 3D game shell** on that foundation so you can start iterating on scenes immediately.

## What you get in *this* repo

A focused **3D starter** (not the full engine surface):

- `ForgEng.create` engine entry (Phaser-style: config in `main.ts`, content in `src/scene/`)
- perspective camera + ambient / directional lighting
- orange cube on an 8×8 platform (WASD move, optional rotation)
- Space / pointer actions, E reset, Q pause rotation
- DomUiShell side panel: **Kontrole** + optional **Metrike** (`?advanced=1`)
- vendored ForgeNG **3D runtime** + DomUiShell under `src/vendor/forgeng/`

## Engine capabilities you can grow into

Documented on [forgeng.dev](https://forgeng.dev) / ForgeNG 3.0 docs (not all enabled in this starter by default):

| Area | Publicly documented direction |
| --- | --- |
| Rendering | WebGPU-only runtime (no silent fallback to another renderer); GPU pipelines, WGSL, lighting, materials, shadows, post-processing |
| 3D gameplay | Scene ownership, ECS, transforms/hierarchy, materials/textures, models/glTF, quality profiles, camera, atmosphere/fog (see docs tree) |
| 2D / hybrid | Full 2D stack and hybrid composition available in the same 3.0 product line |
| Architecture | Explicit scenes, ECS, replaceable providers/plugins behind versioned contracts |
| Systems | Input/actions, audio, physics, assets, gameplay, storage, UI, animation, rendering |
| Networking | **Opt-in transport** composition (`forgeng/transport`, optional reconnect). Contract is DOM-neutral and binary-only; ForgeNG does not ship a signaling service with the SDK ([Transport Composition](https://forgeng.dev/en/forgeng-3.0/advanced/transport-composition)) |
| Delivery | Deploy as web assets; share demos/games by opening a page in a WebGPU browser |

> Honest scope note: this template demonstrates **3D scene + lighting + input + UI**. Features such as multiplayer transport, GPU physics providers, compressed asset codecs, or the full 2D stack are part of the broader ForgeNG ecosystem and docs — enable them when your project needs them.

## Requirements

- Node.js 18+
- A browser/device with **WebGPU** support (ForgeNG 3.0 does not silently switch renderer)

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

## Project layout

```text
src/
  main.ts              # ForgEng.create — canvas, providers, scenes
  scene/
    gameScene.ts       # create / update / destroy wiring
    camera.ts
    light.ts
    ground.ts          # platform plane
    box.ts             # orange cube
    controller.ts      # WASD / mouse / touch
    hud.ts             # DomUiShell panels
  vendor/forgeng/      # vendored runtime + DomUiShell
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

Advanced metrics: side-panel toggle or `?advanced=1`.

## Learn more

- Website: [https://forgeng.dev](https://forgeng.dev)
- Docs (3.0 overview): [https://forgeng.dev/en/forgeng-3.0/getting-started/overview](https://forgeng.dev/en/forgeng-3.0/getting-started/overview)
- Transport (opt-in networking composition): [https://forgeng.dev/en/forgeng-3.0/advanced/transport-composition](https://forgeng.dev/en/forgeng-3.0/advanced/transport-composition)
- Demos: [https://forgeng.dev/en](https://forgeng.dev/en) → Demos
- 2D sibling template: [forgeng-2d-template](https://github.com/ForgEngDev/forgeng-2d-template)

## License

See [LICENSE](./LICENSE).

- **Template / game code:** free to use and improve for client-side games.
- **ForgEng engine** (vendored under `src/vendor/forgeng/`): installation on other computers as an engine/SDK and commercial use of the engine are strictly forbidden.

Engine ownership and commercial grants are also described on the public [ForgeNG License](https://forgeng.dev/en/license) page.
