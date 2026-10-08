# Repository Guidelines

## Simulation Scope & References

Build a Portuguese-language **“Simulador de medição de pressão arterial”**, initially covering the auscultatory method. Implement a guided simulation based on the supplied PDF checklist. Follow [the implementation plan](references/IMPLEMENTATION_PLAN.md) for the workflow and visual references: `Start_menu.png` for menu organization, `example_hands_and_step.png` for visible hands and next-step arrows, and `example_room.png` for the clinical environment. The patient is pre-seated on the examination chair with arm at heart level, and the cuff is pre-fitted. Conversational and anamnese tasks are non-blocking, accessible via a lateral interaction trigger with timing evaluated for debriefing feedback. Adapt the menu to this scenario and project identity. Documentation may remain in English; user-facing instructions and feedback must be in Portuguese.

## Project Structure & Module Organization

This project uses TypeScript, Vite, Babylon.js, and Havok for an interactive WebXR scene.
- `src/main.ts` initializes `App`; `src/App.ts` configures rendering, physics, and scene loading.
- `src/scripts/xr.ts` handles hand tracking and pinch interactions; `src/scripts/box.ts` controls box rotation.
- `src/scripts.ts` is the Babylon.js Editor-generated script registry. Keep registrations consistent with scene scripts.
- `src/style.css` and `index.html` define the page and canvas.
- `assets/` contains editable scene data, materials, and textures; `project.bjseditor` is the Editor project configuration.
- `public/scene/` contains exported runtime assets, including `example.babylon`. No test directory currently exists.

## Build, Test, and Development Commands

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run dev` (or `npm start`): start Vite on port 3000.
- `npm run generate`: pack the Babylon.js Editor project using its CLI; review generated changes before committing.
- `npx tsc --noEmit`: check TypeScript without emitting files.
- `npm run build`: create the production bundle in `dist/`; this does not replace type checking.
- `npm run serve`: preview the production build locally.

## Local Command Execution

The command sandbox in this environment currently fails before execution with `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`. While this condition persists, use the execution tool's `sandbox_permissions: "require_escalated"` option directly, with its required justification and approval flow, instead of repeating a known-failing sandboxed attempt. This note does not override platform permissions or approvals.

For isolated headless Chrome browser checks in this environment, launch Chrome with `--no-sandbox` and a dedicated temporary user-data directory. `--no-sandbox` is a Chrome option, not a general flag for shell commands, npm, or TypeScript.

## Coding Style & Naming Conventions

Use TypeScript ES modules, PascalCase class names, and camelCase methods and variables. Existing private members often use an underscore prefix, such as `_scene`. Match surrounding indentation: most files use tabs, while `xr.ts` uses four spaces. Preserve local quote style and use semicolons. Prefer specific Babylon.js module imports and retain required side-effect registrations. No formatter or linter is configured; avoid unrelated formatting changes.

## Testing Guidelines

There is no automated test framework, test naming convention, or coverage threshold. Run type checking and a production build for code changes. Manually verify scene loading, resizing, and console errors. For interaction changes, check both hands, pinch acquisition, exclusive box ownership, release position, and rotation on compatible XR hardware. Report hardware and browser used, and any untested behavior.

## Commit & Pull Request Guidelines

History currently contains only `Initial commit: pinch the box`; no formal commit convention is established. Use concise, imperative subjects describing the affected behavior. Keep changes focused. Pull requests should describe the change, link relevant issues, list validation performed, and include screenshots or recordings for visual or XR changes. Include corresponding scene exports when updating Editor assets. Keep dependencies, caches, local environment files, and build output untracked as specified in `.gitignore`.
