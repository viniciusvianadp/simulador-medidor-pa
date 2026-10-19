import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRFeatureName } from "@babylonjs/core/XR/webXRFeaturesManager";
import { WebXRState } from "@babylonjs/core/XR/webXRTypes";
import "@babylonjs/core/XR/features/WebXRControllerMovement";

import { WebXRHandJoint, WebXRHandTracking } from "@babylonjs/core/XR/features/WebXRHandTracking";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export default class XR {
    private _canGrabStethoscope: (() => boolean) | null = null;
    private _onStethoscopeRelease: ((position: Vector3) => boolean) | null = null;

    public constructor(public scene: Scene) {}

    public setStethoscopeInteractionHandlers(
        canGrab: () => boolean,
        onRelease: (position: Vector3) => boolean
    ): void {
        this._canGrabStethoscope = canGrab;
        this._onStethoscopeRelease = onRelease;
    }

    public async onStart(): Promise<void> {
        const ground = this.scene.getMeshByName("ground");
        const box = this.scene.getMeshByName("box");

        if (!ground) {
            console.error("XR: ground not found");
            return;
        }

        try {
            const floorMeshes = [ground];
            const officeFloor = this.scene.getMeshByName("DoctorsOffice_blinn1_0");
            if (officeFloor) {
                floorMeshes.push(officeFloor);
            }

            const xr = await WebXRDefaultExperience.CreateAsync(
                this.scene,
                {
                    floorMeshes,
                }
            );

            // A restart can dispose the scene while XR support is being detected.
            if (this.scene.isDisposed) {
                xr.dispose();
                return;
            }

            console.log("XR experience created:", xr);

            // Enable thumbstick smooth locomotion and snap turning for VR controllers
            try {
                xr.baseExperience.featuresManager.enableFeature(
                    WebXRFeatureName.MOVEMENT,
                    "latest",
                    {
                        xrInput: xr.input,
                        movementOrientationFollowsViewerPose: true,
                        movementOrientationFollowsController: false,
                        movementSpeed: 0.15,
                        rotationSpeed: 0.3,
                    }
                );
            } catch (movementError) {
                console.warn("XR: Movement feature not available:", movementError);
            }

            // Spawn in the center of the doctor's office looking towards the counter
            const initialSpawnPosition = new Vector3(0, 0, 0.5);
            const initialTarget = new Vector3(0, 1.1, -1.8);

            xr.baseExperience.onInitialXRPoseSetObservable.add((camera) => {
                camera.position.copyFrom(initialSpawnPosition);
                camera.setTarget(initialTarget);
            });

            xr.baseExperience.onStateChangedObservable.add((state) => {
                if (state === WebXRState.IN_XR) {
                    xr.baseExperience.camera.position.copyFrom(initialSpawnPosition);
                    xr.baseExperience.camera.setTarget(initialTarget);
                }
            });

            // Add snap points for the key clinical stations for teleportation
            if (xr.teleportation) {
                xr.teleportation.addSnapPoint(new Vector3(0, 0, 0.5));        // 1: Visão geral
                xr.teleportation.addSnapPoint(new Vector3(0.79, 0, -1.6));    // 2: Estação de higiene (dispensador)
                xr.teleportation.addSnapPoint(new Vector3(-0.07, 0, -1.3));   // 3: Prontuário / Balcão
                xr.teleportation.addSnapPoint(new Vector3(-1.50, 0, -0.50));  // 4: Mesa & Instrumentos
                xr.teleportation.addSnapPoint(new Vector3(0.05, 0, -0.55));   // Aproximação pelo braço esquerdo
                xr.teleportation.addSnapPoint(new Vector3(-0.18, 0, -1.82));  // Aproximação pelo braço direito
            }

            const handTracking =
                xr.baseExperience.featuresManager.enableFeature(
                    WebXRFeatureName.HAND_TRACKING,
                    "latest",
                    {
                        xrInput: xr.input,
                    }
                ) as WebXRHandTracking;

            console.log("Hand tracking enabled:", handTracking);

            // The clinical room uses hands for presence; instrument interactions
            // arrive in stage 4. Retain pinch behavior in the original box scene.
            if (!box) return;

            const originalParent = box.parent;

            // Only one hand can hold the box at a time.
            let grabbingHand: string | null = null;
            let stethoscopeHand: string | null = null;

            handTracking.onHandAddedObservable.add((hand) => {
                const handedness =
                    hand.xrController.inputSource.handedness;

                console.log("Hand added:", handedness);

                let wasPinching = false;
                let grabbedStethoscope: TransformNode | null = null;
                let stethoscopeOriginalParent: TransformNode | null = null;
                let stethoscopeOriginalPosition: Vector3 | null = null;

                const PINCH_START_DISTANCE = 0.025;
                const PINCH_END_DISTANCE = 0.04;

                this.scene.onBeforeRenderObservable.add(() => {
                    const thumbTip =
                        hand.getJointMesh(WebXRHandJoint.THUMB_TIP);

                    const indexTip =
                        hand.getJointMesh(WebXRHandJoint.INDEX_FINGER_TIP);

                    if (!thumbTip || !indexTip) {
                        return;
                    }

                    const thumbPosition =
                        thumbTip.getAbsolutePosition();

                    const indexPosition =
                        indexTip.getAbsolutePosition();

                    const fingerDistance = Vector3.Distance(
                        thumbPosition,
                        indexPosition
                    );

                    /*
                     * PINCH START
                     */
                    if (
                        !wasPinching &&
                        fingerDistance < PINCH_START_DISTANCE
                    ) {
                        wasPinching = true;

                        console.log(
                            "PINCH START:",
                            handedness
                        );

                        // Don't allow both hands to hold the cube.
                        if (grabbingHand !== null) {
                            return;
                        }

                        // Position halfway between thumb and index.
                        const pinchPosition = thumbPosition
                            .add(indexPosition)
                            .scale(0.5);

                        // Allow the learner to physically carry the stethoscope
                        // only during a step that asks them to place it.
                        const stethoscope = this.scene.getTransformNodeByName("stethoscope-root");
                        if (stethoscope && stethoscopeHand === null && this._canGrabStethoscope?.()) {
                            stethoscope.computeWorldMatrix(true);
                            const bounds = stethoscope.getHierarchyBoundingVectors(true);
                            const stethoscopeCenter = bounds.min.add(bounds.max).scale(0.5);
                            const radius = bounds.max.subtract(bounds.min).length() * 0.5;
                            if (Vector3.Distance(pinchPosition, stethoscopeCenter) <= Math.max(radius, 0.12) + 0.12) {
                                grabbedStethoscope = stethoscope;
                                stethoscopeOriginalParent = stethoscope.parent as TransformNode | null;
                                stethoscopeOriginalPosition = stethoscope.getAbsolutePosition().clone();
                                stethoscopeHand = handedness;
                                stethoscope.setParent(indexTip, true);
                            }
                        }

                        if (!grabbedStethoscope) {
                            const boxPosition = box.getAbsolutePosition();

                            const boxRadius = box.getBoundingInfo().boundingSphere.radiusWorld;

                            const distanceToBox = Vector3.Distance(pinchPosition, boxPosition);

                            console.log("GRAB CHECK", handedness, {
                                pinchPosition,
                                boxPosition,
                                distanceToBox,
                                boxRadius,
                            });

                            if (distanceToBox < boxRadius + 10) {
                                grabbingHand = handedness;

                                // Attach the cube directly to the index-finger joint.
                                box.setParent(indexTip);

                                console.log("BOX GRABBED:", handedness);
                            }
                        }
                    }

                    /*
                     * PINCH END
                     */
                    if (
                        wasPinching &&
                        fingerDistance > PINCH_END_DISTANCE
                    ) {
                        wasPinching = false;

                        console.log(
                            "PINCH END:",
                            handedness
                        );

                        if (
                            grabbingHand === handedness
                        ) {
                            const releasePosition = thumbPosition
                                .add(indexPosition)
                                .scale(0.5);

                            // Read the other hand now, so the midpoint does not
                            // depend on the order of the hands' render callbacks.
                            const otherHand = handTracking.getHandByHandedness(
                                handedness === "left" ? "right" : "left"
                            );
                            const otherThumb = otherHand?.getJointMesh(WebXRHandJoint.THUMB_TIP);
                            const otherIndex = otherHand?.getJointMesh(WebXRHandJoint.INDEX_FINGER_TIP);
                            if (otherThumb && otherIndex) {
                                const otherHandPosition = otherThumb.getAbsolutePosition()
                                    .add(otherIndex.getAbsolutePosition())
                                    .scale(0.5);
                                releasePosition.addInPlace(otherHandPosition).scaleInPlace(0.5);
                            }

                            box.setParent(originalParent);

                            // This scene has a roughly one-meter box. Keep its
                            // volume beyond the hands so the viewer isn't inside it.
                            box.computeWorldMatrix(true);
                            const boxRadius = box.getBoundingInfo()
                                .boundingSphere.radiusWorld;
                            const awayFromHead = releasePosition.subtract(
                                xr.baseExperience.camera.globalPosition
                            );
                            if (awayFromHead.lengthSquared() < 0.000001) {
                                awayFromHead.copyFrom(
                                    xr.baseExperience.camera.getForwardRay().direction
                                );
                            }
                            releasePosition.addInPlace(
                                awayFromHead.normalize().scale(boxRadius + 0.02)
                            );
                            box.setAbsolutePosition(releasePosition);

                            grabbingHand = null;

                            console.log(
                                "BOX RELEASED:",
                                handedness
                            );
                        }

                        if (stethoscopeHand === handedness && grabbedStethoscope) {
                            const releasePosition = thumbPosition
                                .add(indexPosition)
                                .scale(0.5);
                            grabbedStethoscope.setParent(stethoscopeOriginalParent, true);
                            grabbedStethoscope.setAbsolutePosition(releasePosition);
                            const accepted = this._onStethoscopeRelease?.(releasePosition) ?? false;
                            if (!accepted && stethoscopeOriginalPosition) {
                                grabbedStethoscope.setAbsolutePosition(stethoscopeOriginalPosition);
                            }
                            grabbedStethoscope = null;
                            stethoscopeOriginalParent = null;
                            stethoscopeOriginalPosition = null;
                            stethoscopeHand = null;
                        }
                    }
                });
            });
        } catch (error) {
            console.error(
                "WebXR initialization failed:",
                error
            );
        }
    }
}
