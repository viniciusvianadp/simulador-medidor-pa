# Start menu and session lifecycle

`StartMenu.ts` renders the Portuguese menu and session navigation. `labels.ts` centralizes interface copy; procedural prompts remain in the scenario definition. The layout follows the grouped panels and prominent start action of `references/Start_menu.png`, with responsive styling in `src/style.css`.

The patient selector uses the five fictional cases without exposing pressure answers or branch details. Starting calls `App.startSimulation(config)`, which creates a new controller and loads a fresh exported scene. Restart uses the active configuration and recreates both; returning to the menu disposes the scene, stops rendering, and clears the controller. This also resets existing mesh transforms, physics, camera and scene-owned XR resources. A loading guard prevents concurrent starts. Failures discard the partial session and offer a retry in Portuguese.

The page opens on the menu without initializing WebGL. Scene rendering starts after loading succeeds. The session bar exposes restart and return controls; the browser canvas remains available for exploration. These are browser controls, not in-world XR panels. Exit immersive XR to use them on devices without DOM presentation. The clinical room and tracked procedural interactions remain later plan steps.

`App.dispatchSimulationEvent()` is the integration point for future scene adapters; `getSimulationSnapshot()` supports inspection. No mock answers or automatic progression are wired to the interface.

## Verification

- `npm test`: simulation regression tests.
- `npx tsc --noEmit` and `npm run build`: project checks. The installed Recast declaration currently reports TS1540 during the full type check.
- `node tests/menu.browser.mjs`: optional actual-browser integration checks. Start Vite on port 3000 and an isolated Chrome instance with `--remote-debugging-port=9223` first. Alternate URLs can be provided with `MENU_APP_URL` and `MENU_BROWSER_URL`.

The browser check verifies desktop/mobile layout, patient selection, duplicate-start protection, restart of scene transforms and progress, disposal on return, changing patients, resizing, and failed-load recovery. It saves screenshots in `/tmp/projeto-xr-menu-desktop.png`, `/tmp/projeto-xr-menu-mobile.png`, and `/tmp/projeto-xr-session.png`.

Browser verification uses headless Google Chrome 153 on Linux with software WebGL (SwiftShader), at 1440×1000, 390×844, and 800×600. No physical XR headset or hand-tracking hardware was tested.
