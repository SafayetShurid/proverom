# Prøverom: AR dress try-on demo

Live site: https://proverom.vercel.app

Rebuild with `python3 build.py`. Output goes to `dist/`.

- `dist/standalone/Proverom.html` is one self-contained file with the live camera.
- `dist/artifact/` is the photo-only published version.
- `dist/vercel/` is the hosted site (proverom.vercel.app). The engine loads from jsDelivr.
- `src/dresses.js` holds the catalogue. Replace `draw()` output with a real cut-out product photo and keep the measurements.
- `src/fit.js` holds the body fitting.
- `src/app.js` holds the camera, tracking and rendering.
- `engine/` is MediaPipe Pose (Apache 2.0), hosted locally.

## Deploying

Vercel runs `build.py` on each push to `main` and serves `dist/vercel/`. The settings are in `vercel.json`.
