# Folded blood-pressure cuffs

## Stored assets and source files

- `folded-cuff.glb`: standalone textured fabric mesh extracted from `../sphygmomanometer_low_poly.glb`; 466 vertices / 480 triangles. Original source GLB is unchanged.
- `variants.json`: generated description of all seven sizes, their Portuguese names, circumference ranges, bladder dimensions (cm), and folded display dimensions (m).
- `preview.png`: reviewed desktop close-up of the seven variants on the chair-side tray.
- `../../../src/scene/cuffVariants.ts`: runtime size definitions derived from the canonical `clinicalParameters.ts` cuff table.
- `../../../src/scene/buildCuffSet.ts`: shared-mesh cloning, placement, labels, and selection metadata.
- `../../../scripts/extract-folded-cuff.py`: reproducible extraction of the inspected fabric component, retaining original UV seams, normals, tangents, UV channels, and embedded material textures.
- `../../../scripts/generate-cuffs.mjs`: extraction and variant-manifest generation.

Run `npm run cuffs:generate` from the repository root (requires Python 3 and installed npm dependencies). Generation fails if the expected cuff component cannot be identified. If the source topology changes, inspect it again before updating the extraction predicate. The extracted GLB records the source SHA-256 in its extras.

There are **not seven duplicate GLBs**: the seven scene objects share one geometry/material/texture atlas and use the dimensions in `cuffVariants.ts`. Vite serves/bundles the GLB directly from this directory. `variants.json` is an inspectable generated manifest; the runtime derives values from the typed definitions rather than maintaining a second clinical table.

## Geometry and sizing policy

The source has eight disconnected components inside one mesh. The inspected 466-vertex component is folded fabric/closure geometry; hoses, gauge, valve, and bulb are excluded. X/Z are centered, Y is grounded, and geometry is converted to meters using the original scene's 0.11 import scale. Original UVs and textures are preserved, including the original shared texture atlas (about 6.7 MB).

Folded footprints are art approximations: width = bladder width + 2 cm, depth = bladder length / 4 + 2 cm, thickness = 1.2 cm + 0.06 × bladder width in cm. These assumptions provide visible size differences without uniformly scaling thickness. They do **not** specify the actual outer sleeve, how many folds a manufactured cuff has, or a clinically valid fitted cuff. Fabric texture spacing changes with the display proportions.

All seven cuff/label pairs are separate pickable targets with `logicalTarget: "cuffs"` and the canonical `cuffId`. Labels travel with their cuff roots. Actual grabbing/selection scoring is deferred to the interaction implementation. The pre-existing cuff remains part of the original combined sphygmomanometer display model.

Fitted representations, artery alignment marks, tube attachments, and wrap mechanics remain pending until patient geometry is available. Labels and sizing rules come from the supplied checklist transcription; geometry is not used to infer cuff eligibility.

## Placement and verification

The set uses the world bounds of `chair_Object_8`, the cleared chair-side tray, in two rows. The chair station (key 5) frames the chair and cuff tray. Browser checks verify seven IDs, geometry count, support contact, footprint containment, non-overlap, scene reset, and resizing. Visual review used headless Chrome 153 on Linux; headset readability/reach and grasping remain untested.

## Provenance

Derived from the repository's existing sphygmomanometer GLB. Its original author/license was not supplied in repository metadata; no new license is asserted for the derived geometry or texture.
