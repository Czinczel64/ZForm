# ZForm

ZForm is an original, local-first 3D sculpting and painting prototype. It is inspired by common 3D sculpting workflows and has its own interface and implementation.

## MVP scope

- Browser-first application built with Three.js and Vite.
- Starter mesh with draw, smooth, move, inflate, flatten, clay, crease, pinch, paint, erase, and mask brushes. Masks protect painted and sculpted vertices.
- X symmetry, adjustable brush size and strength, undo and redo, and one-step mesh refinement.
- Local project persistence in IndexedDB.
- Native `.zform` project files preserve the mesh topology, vertex colors, masks, material, and project name for reopening in ZForm.
- Undo and redo preserve mesh topology when restoring geometry changes such as refinement. Imported and restored meshes are checked for finite positions, valid triangle indices, matching color/mask attributes, and the 120,000-vertex budget before replacing the active study.
- OBJ, STL, and GLB import and export (the current importer uses the first mesh in a GLB scene).
- Installable PWA shell with a service worker for same-origin assets.
- A five-step guided walkthrough, contextual tips, and keyboard shortcuts in Portuguese.

This is an early MVP, not a production replacement for professional sculpting software. It does not yet include voxel remeshing, subdivision levels, topology tools, layers, texture painting, rigging, rendering, scripting, cloud sync, or desktop installers. Full ZBrush-level quality and workflows require substantial later development and performance work.

## Run locally

Requires Node.js 20.19+ or 22.12+ and pnpm.

```sh
pnpm install
pnpm dev
```

Create a production bundle with `pnpm build`. Open the app through a local server (`pnpm dev`), HTTPS, or GitHub Pages; opening `index.html` directly with a `file://` URL will prevent browser modules and styles from loading correctly.

Run geometry validation checks with `pnpm test`.

## Publish on GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`. It builds the app with the `/ZForm/` base path and deploys the `dist` folder whenever `main` changes. In the repository settings, select **Settings → Pages → Build and deployment → GitHub Actions**. The public site will be at `https://czinczel64.github.io/ZForm/` after the first successful deployment.

## Desktop packaging

The application is structured as a web app. Windows, macOS, and Linux desktop installers still need a packaging layer such as Tauri, signing/notarization setup, platform-specific builds, and release automation. Those installers are outside this initial browser MVP.

## Performance note

The starter mesh is intentionally modest and the renderer limits device pixel ratio to reduce GPU memory use. Actual performance depends on browser, GPU drivers, display resolution, and imported mesh size. This prototype has not been benchmarked on a 4 GB VRAM machine.

## License

MIT. See `LICENSE`.

See [`ROADMAP.md`](ROADMAP.md) for the staged plan toward broader professional sculpting workflows.

