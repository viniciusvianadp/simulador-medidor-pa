# Babylon.js Editor

This folder contains all the assets used in the project.

`clinical-room.scene/` is the current procedural room blockout. Its generated asset
inventory is `clinical-room/manifest.json`. Edit the dimensions and palette in
`src/scene/clinicalRoomSpec.ts`, then run `npm run room:generate` to rebuild the
Editor scene and runtime export. See the [visual specification](../references/CLINICAL_ROOM_VISUAL_SPEC.md)
for ownership of generated objects, modeling conventions, and remaining work.

`example.scene/` retains the original pinch-box prototype.
