# Babylon.js Editor

This folder contains all the assets used in the project.

`doctors-office.scene/` is the main scene. Its environment is
`Models/doctors_office.glb`, imported through the Editor. The model is authored at
roughly half real-world size (about 2 × 2 m with a 1.2 m ceiling), so the imported
root is scaled by about 2.2 to give a ~2.6 m ceiling for XR.

`hospital_room.env` is the prefiltered environment texture used for image-based
lighting. `Models/` also holds the clinical props (chair, sphygmomanometer,
stethoscope, hand sanitizer) to be placed in the scene.

Run `npm run generate` after saving the scene in the Editor to refresh `public/scene/`.
