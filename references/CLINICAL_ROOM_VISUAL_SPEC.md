# Clinical Room — Visual Specification and Blockout

Implementation-plan stages **3.1 and 3.2**. This is the first spatial draft; detailed assets and clinical interactions remain in subsequent stages.

## Editable Sources and Regeneration

- `src/scene/clinicalRoomSpec.ts`: dimensions, initial positions, palette, budgets, and complete asset inventory for stages 3.3–3.8. Cuff bladder dimensions come directly from the 2026 clinical parameters.
- `src/scene/buildClinicalRoom.ts`: procedural geometry, static materials, camera, lighting, and future target anchors.
- `scripts/generate-clinical-room.mjs`: compiles the builder, creates an Editor scene, writes the manifest, and calls the existing scene packer.
- `assets/clinical-room/manifest.json`: generated asset inventory, production method, dimensions, provenance, material references, status, and scene counts.
- `assets/clinical-room.scene/`: editable Babylon.js Editor scene. `project.bjseditor` selects this scene.
- `public/scene/clinical-room.babylon`: exported runtime scene loaded when starting a session.

Run `npm run room:generate` after changing the procedural sources. It generates local files only. The original `assets/example.scene` and its box interaction prototype remain available in the Editor.

The generator owns the named blockout meshes, lights, camera, and scene configuration. Direct Editor edits to those generated objects are overwritten when regenerating: preserve permanent changes in the builder, or duplicate a model under a new ID before refining it in the Editor. Manual additions with different IDs are retained. Run `npm run generate` to export Editor-only changes without rebuilding geometry.

## Visual Direction

Use the reference room's pale clinical surfaces, windows, overhead lighting, and clearly organized workspace. Replace the bed with a supported chair. The menu's warm white and green palette establishes this project's identity; do not reproduce reference branding or unrelated monitors/equipment.

Use simplified, matte geometry and recognizable silhouettes, with enough contrast between hands/skin, cuff fabric, instrument surfaces, and the room. The first draft uses flat materials and a geometric mannequin. The final patient should be a suitably licensed rigged model with adaptable arms; the model and its license have not yet been selected.

| Material | Color | Use |
| --- | --- | --- |
| Wall | `#F2F2E9` | Warm pale background |
| Floor | `#C5D8D1` | Quiet green-gray floor |
| Trim | `#FFFFFF` | Frames, instrument surfaces |
| Green | `#1B5947` | Matches the start menu; small identifying accents |
| Upholstery | `#52786E` | Chair, supports, cuff placeholders |
| Metal | `#B6C3BF` | Matte instrument and furniture parts |
| Dark | `#253C38` | Tubing and future high-contrast markings |
| Skin | `#C89778` | Placeholder mannequin only |
| Shirt / trousers | `#E3E6DA` / `#586866` | Neutral patient clothing |
| Window | `#B9D7DB` | Opaque daylight placeholder |
| Accent | `#BC651F` | Reserved for guidance; matches menu focus color |

Lighting uses a hemisphere fill and a directional window light, without real-time shadows or postprocessing in the blockout. Window geometry is opaque to avoid transparency sorting costs. Ceiling light panels are visual placeholders, not additional dynamic lights.

## Scale, Orientation, Naming, and Pivots

- One scene unit equals **one meter**. Dimensions other than cuff bladder sizes are provisional design assumptions, not clinical requirements or device specifications.
- Babylon's left-handed axes: **+Y up**, **+Z toward the rear wall**, **+X toward the learner's right when looking into the room**. The seated patient faces **−Z**; consequently the patient's left arm is on **+X**.
- Room origin is the floor center. The patient is centered at `(0, 0, 0.45)`. Interior room dimensions are `4.60 × 4.80 × 2.80 m`.
- Mesh names and IDs use stable lowercase kebab-case, such as `patient-forearm-esquerdo`. Materials use `clinical-<palette-key>`. Each mesh records its owning `assetId` and `status: blockout` in metadata.
- Blockout primitives use center origins. Later compound furniture/patient roots should use floor-level origins; movable instruments should use a documented grasp origin. The final gauge needle must pivot at its dial center, and the valve around its mechanical axis.
- Arm-specific metadata anchors use `esquerdo` and `direito`. The logical `patient-arm`/`patient-wrist` target must resolve to the active side in stage 4. Anatomical anchors are approximate placeholders, not validated palpation zones.

## Layout and Access

| Element | Initial specification |
| --- | --- |
| Learner | `(1.60, 1.60, −2.00)`, looking toward `(0.30, 0.95, 0.35)` |
| Patient | Seated, feet at floor level, legs separated, back behind torso |
| Chair | Seat `0.52 × 0.48 m`, top `0.46 m` above floor |
| Arm supports | One on each side; pad top `1.04 m` above floor |
| Instrument surface | On the patient's left; top at `0.84 m` |
| Tray | Center `(1.10, 0.87, 0.65)`, size `0.50 × 0.34 m` |
| Hygiene dispenser | Action center `(1.72, 1.12, −0.10)` |
| Gauge | Center `(0.78, 1.35, 0.44)`, diameter `0.12 m` |

The initial camera is an overview position, not a promise that every object is reachable without moving. Approach the tray/dispenser separately; walk around the front of the chair to access the opposite arm. Both arm supports are present to test clearance. Moving the gauge/tray to the active side belongs to later placement interactions. Gauge height must ultimately support eye-level alignment rather than assuming a fixed height suits all learners.

Desktop controls: WASD or arrow keys to move, drag to look. The camera has wall/furniture collision checks, a short near clipping plane, and no vertical keyboard movement. XR keeps the ground as its teleport surface and enables tracked hands; instrument grabbing is not implemented by these placeholders.

Headset reach, comfort, actual hand occlusion, eye-height variation, and bilateral positioning must still be checked on hardware. The room is a navigable layout draft, not a certified accessible room or a completed clinical posture model.

## Asset Production and Performance

The manifest includes room shell, door/windows/lighting, chair/supports/trolley, patient/poses, hygiene/preparation items, gauge/bulb/tubes, all seven cuff sizes, stethoscope/tape, and controlled labels. Existing placeholders are marked `blockout`; missing components and finished variants remain `planned`.

Use procedural geometry for the room, furniture, and simple props. Adapt a rigged patient model after reviewing its license and geometry. Prepare custom fitted/loose variants for cuffs and tape. The blockout cuff stack is schematic and does **not** represent the seven finished cuff models. The stethoscope loop is a footprint placeholder, not its final anatomy or tubing route.

No bitmap generation is required for this stage. Optional future bitmaps may supply surface detail or decoration; instrument numerals, scale ticks, Portuguese labels, and size information must come from controlled SVG/canvas/text sources. The current gauge face is deliberately blank until the accurate scale is implemented in 3.7.

Provisional standalone-XR targets, to be revised against the chosen headset:

- Blockout: at most 15,000 triangles; current generated counts are in the manifest.
- Finished visible room: initial ceiling of 150,000 triangles and 120 draw calls per view.
- Texture dimensions: normally at most 1024 px, labels normally at most 512 px; justify exceptions using actual readability checks.
- Reuse materials, keep decorative meshes non-pickable, and avoid adding shadows/transparent layers without measuring their cost.

These are engineering budgets, not measured headset performance. The geometric patient is shared by all current fictional cases; case-specific arm dimensions and pose switching are future work.

## Validation Record

The generated blockout contains **85 meshes, 10,376 triangles, and no textures**. The Editor packer successfully exported it and the application loaded the result. A [learner-view screenshot](../assets/clinical-room.scene/preview.png) is saved with the scene.

Verified on Linux with headless Google Chrome 153.0.8010.47: geometry loading, desktop/mobile menu layout, keyboard movement at a fixed 1.60 m eye height, wall collision, scene/progress reset, patient selection, resize, load-error recovery, and absence of uncaught browser exceptions. The simulation's 31 regression tests also pass.

Production build passes with the existing large-bundle warning. Project type checking passes with `--skipLibCheck`; the full `tsc --noEmit` check still reports TS1540 in the installed `@recast-navigation/wasm` declaration. No dependency or compiler configuration was changed to suppress that error.

Not verified: loading/editing the scene in the graphical Babylon.js Editor, physical headset/controller/hand behavior, reach comfort, or headset frame rate. Detailed model readability, validated anatomy, and clinical interactions are not supplied by this blockout.
