# Offline use and updates

- `vite build` runs `scripts/sw-plugin.mjs`, which writes `dist/sw.js`: a service worker that precaches every built file (app shell, JS and CSS chunks, the lazy SRD data chunks). Its cache name carries a hash of the build, so any change produces a new version.
- `src/offline/updates.ts` registers `/sw.js` in production builds only (`import.meta.env.PROD`). The dev server and Vitest never register a worker.
- A new version installs in the background and waits. `UpdatePrompt` (bottom right) shows "A new version is ready" with an Update now button; only then does the worker take over and the page reload. First install never reloads.
- Shipping an update: build and deploy `dist/`. Open tabs see the prompt the next time the browser checks for a new `sw.js` (on navigation, at least daily).

## Testing offline behavior

- Automated: `npx playwright test e2e/offline.spec.ts` (builds, serves `dist` with `vite preview` on port 5198, goes offline in a real Chromium, and fakes a new version by editing `dist/sw.js`).
- By hand: `npm run build && npm run preview`, load the site once, then DevTools > Network > Offline (or Application > Service Workers > Offline) and reload.
