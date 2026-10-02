import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRFeatureName } from "@babylonjs/core/XR/webXRFeaturesManager";

import { WebXRHandJoint, WebXRHandTracking } from "@babylonjs/core/XR/features/WebXRHandTracking";

export default class XR {
    public constructor(public scene: Scene) {}

    public async onStart(): Promise<void> {
        const ground = this.scene.getMeshByName("ground");
        const box = this.scene.getMeshByName("box");

        if (!ground || !box) {
            console.error("XR: ground or box not found");
            return;
        }

        try {
            const xr = await WebXRDefaultExperience.CreateAsync(
                this.scene,
                {
                    floorMeshes: [ground],
                }
            );

            // A restart can dispose the scene while XR support is being detected.
            if (this.scene.isDisposed) {
                xr.dispose();
                return;
            }

            console.log("XR experience created:", xr);

            const handTracking =
                xr.baseExperience.featuresManager.enableFeature(
                    WebXRFeatureName.HAND_TRACKING,
                    "latest",
                    {
                        xrInput: xr.input,
                    }
                ) as WebXRHandTracking;

            console.log("Hand tracking enabled:", handTracking);

            const originalParent = box.parent;

            // Only one hand can hold the box at a time.
            let grabbingHand: string | null = null;

            handTracking.onHandAddedObservable.add((hand) => {
                const handedness =
                    hand.xrController.inputSource.handedness;

                console.log("Hand added:", handedness);

                let wasPinching = false;

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

                        const boxPosition =
                            box.getAbsolutePosition();

                        const boxRadius =
                            box.getBoundingInfo()
                                .boundingSphere.radiusWorld;

                        const distanceToBox =
                            Vector3.Distance(
                                pinchPosition,
                                boxPosition
                            );

                        console.log(
                            "GRAB CHECK",
                            handedness,
                            {
                                pinchPosition,
                                boxPosition,
                                distanceToBox,
                                boxRadius,
                            }
                        );

                        if (
                            distanceToBox <
                            boxRadius + 10
                        ) {
                            grabbingHand = handedness;

                            //Attach the cube directly to the
                            //index-finger joint.
                            box.setParent(indexTip);

                            console.log(
                                "BOX GRABBED:",
                                handedness
                            );
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
