import { classifyGrip } from "../interaction/gripGesture";
import type { InstrumentHandFrame } from "../interaction/HandInstruments";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRFeatureName } from "@babylonjs/core/XR/webXRFeaturesManager";
import { WebXRState } from "@babylonjs/core/XR/webXRTypes";
import "@babylonjs/core/XR/features/WebXRControllerMovement";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";

import { WebXRHandJoint, WebXRHandTracking } from "@babylonjs/core/XR/features/WebXRHandTracking";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { clinicalLayout, type Station } from "../scene/clinicalLayout";

export default class XR {
    private _canGrabStethoscope: (() => boolean) | null = null;
    private _onStethoscopeRelease: ((position: Vector3) => boolean) | null = null;
    private _onHandGrab: ((position: Vector3) => boolean) | null = null;
    private _onInstrumentHandFrame: ((frame: InstrumentHandFrame) => boolean) | null = null;
    private _onInstrumentHandLost: ((handId: string) => void) | null = null;

    public constructor(public scene: Scene) {}

    public setStethoscopeInteractionHandlers(
        canGrab: () => boolean,
        onRelease: (position: Vector3) => boolean,
        onHandGrab: (position: Vector3) => boolean
    ): void {
        this._canGrabStethoscope = canGrab;
        this._onStethoscopeRelease = onRelease;
        this._onHandGrab = onHandGrab;
    }

    public setInstrumentHandHandlers(
        onFrame: (frame: InstrumentHandFrame) => boolean,
        onLost: (handId: string) => void
    ): void {
        this._onInstrumentHandFrame = onFrame;
        this._onInstrumentHandLost = onLost;
    }

    public async onStart(): Promise<void> {
        const teleportFloor = this.scene.getMeshByName("teleport-floor");

        if (!teleportFloor) {
            console.error("XR: teleport floor not found");
            return;
        }

        try {
            const xr = await WebXRDefaultExperience.CreateAsync(
                this.scene,
                {
                    floorMeshes: [teleportFloor],
                    // Hands have no thumbstick: teleport on a long pinch, kept
                    // long enough that a short pinch still selects objects.
                    teleportationOptions: { timeToTeleport: 3000 },
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

            // Start at the shared preparation/measurement working position.
            const [spawnX, , spawnZ] = clinicalLayout.spawn.position;
            const initialSpawnPosition = new Vector3(spawnX, 0, spawnZ);
            const initialTarget = Vector3.FromArray(clinicalLayout.spawn.lookAt);

            xr.baseExperience.onInitialXRPoseSetObservable.add((camera) => {
                camera.position.copyFrom(initialSpawnPosition);
                camera.setTarget(initialTarget);
            });

            xr.baseExperience.onStateChangedObservable.add((state) => {
                if (state === WebXRState.IN_XR) {
                    // The XR camera position is the head, and the first frame has
                    // already added the user's height: keep it instead of using y = 0,
                    // which would put the eyes below the office floor.
                    const camera = xr.baseExperience.camera;
                    const headHeight = camera.realWorldHeight || clinicalLayout.eyeHeight;
                    camera.position.set(
                        initialSpawnPosition.x,
                        teleportFloor.position.y + headHeight,
                        initialSpawnPosition.z
                    );
                    camera.setTarget(initialTarget);
                }
            });

            // Add snap points for the key clinical stations for teleportation
            if (xr.teleportation) {
                const snapPoints = new Set<string>();
                for (const station of Object.values(clinicalLayout.stations) as Station[]) {
                    if (station.teleportPoint) {
                        const [x, z] = station.teleportPoint;
                        const key = `${x},${z}`;
                        if (snapPoints.has(key)) continue;
                        snapPoints.add(key);
                        xr.teleportation.addSnapPoint(new Vector3(x, 0, z));
                    }
                }
                this._fixHandTeleportation(xr);
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

            // Only one hand can hold the stethoscope at a time.
            let stethoscopeHand: string | null = null;

            handTracking.onHandAddedObservable.add((hand) => {
                const handedness =
                    hand.xrController.inputSource.handedness;

                console.log("Hand added:", handedness);

                let wasFistGrabbing = false;
                let grabbedStethoscope: TransformNode | null = null;
                let stethoscopeOriginalParent: TransformNode | null = null;
                let stethoscopeOriginalPosition: Vector3 | null = null;

                const handRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
                    const wrist = hand.getJointMesh(WebXRHandJoint.WRIST);
                    const knuckle = hand.getJointMesh(WebXRHandJoint.MIDDLE_FINGER_PHALANX_PROXIMAL);
                    const span = wrist && knuckle ? Vector3.Distance(wrist.getAbsolutePosition(), knuckle.getAbsolutePosition()) : 0.08;
                    const fingerJoints = [
                        [WebXRHandJoint.INDEX_FINGER_TIP, WebXRHandJoint.INDEX_FINGER_PHALANX_PROXIMAL, WebXRHandJoint.INDEX_FINGER_PHALANX_INTERMEDIATE, WebXRHandJoint.INDEX_FINGER_PHALANX_DISTAL],
                        [WebXRHandJoint.MIDDLE_FINGER_TIP, WebXRHandJoint.MIDDLE_FINGER_PHALANX_PROXIMAL, WebXRHandJoint.MIDDLE_FINGER_PHALANX_INTERMEDIATE, WebXRHandJoint.MIDDLE_FINGER_PHALANX_DISTAL],
                        [WebXRHandJoint.RING_FINGER_TIP, WebXRHandJoint.RING_FINGER_PHALANX_PROXIMAL, WebXRHandJoint.RING_FINGER_PHALANX_INTERMEDIATE, WebXRHandJoint.RING_FINGER_PHALANX_DISTAL],
                        [WebXRHandJoint.PINKY_FINGER_TIP, WebXRHandJoint.PINKY_FINGER_PHALANX_PROXIMAL, WebXRHandJoint.PINKY_FINGER_PHALANX_INTERMEDIATE, WebXRHandJoint.PINKY_FINGER_PHALANX_DISTAL],
                    ] as const;
                    let trackedFingers = 0;
                    let curledFingers = 0;
                    const curlDistances: number[] = [];
                    const fingerLengths: number[] = [];
                    let indexExtended = false;
                    for (const [tipJoint, proximalJoint, intermediateJoint, distalJoint] of fingerJoints) {
                        const tip = hand.getJointMesh(tipJoint);
                        const proximal = hand.getJointMesh(proximalJoint);
                        if (!tip || !proximal) continue;
                        trackedFingers++;
                        const distance = Vector3.Distance(tip.getAbsolutePosition(), proximal.getAbsolutePosition());
                        curlDistances.push(distance);
                        const intermediate = hand.getJointMesh(intermediateJoint);
                        const distal = hand.getJointMesh(distalJoint);
                        const length = intermediate && distal
                            ? Vector3.Distance(proximal.getAbsolutePosition(), intermediate.getAbsolutePosition())
                                + Vector3.Distance(intermediate.getAbsolutePosition(), distal.getAbsolutePosition())
                                + Vector3.Distance(distal.getAbsolutePosition(), tip.getAbsolutePosition())
                            : span;
                        fingerLengths.push(length);
                        if (tipJoint === WebXRHandJoint.INDEX_FINGER_TIP) indexExtended = distance > length * 0.70;
                        if (distance < 0.075) curledFingers++;
                    }
                    const fistGrab = trackedFingers >= 3 && curledFingers >= 3;
                    const fistRelease = trackedFingers >= 3 && curledFingers < 2;
                    const palm = wrist && knuckle
                        ? Vector3.Lerp(wrist.getAbsolutePosition(), knuckle.getAbsolutePosition(), 0.65)
                        : wrist?.getAbsolutePosition() ?? Vector3.Zero();
                    const gesture = classifyGrip(curlDistances, span, fingerLengths);
                    const indexTip = hand.getJointMesh(WebXRHandJoint.INDEX_FINGER_TIP);
                    const xrFrame = xr.baseExperience.sessionManager.currentFrame;
                    const referenceSpace = xr.baseExperience.sessionManager.referenceSpace;
                    const wristSpace = hand.xrController.inputSource.hand?.get(WebXRHandJoint.WRIST);
                    // Babylon leaves the previous joint meshes in place when a
                    // hand pose is unavailable; do not pump from those stale poses.
                    if (!wrist || !xrFrame || !referenceSpace || !wristSpace
                        || !xrFrame.getJointPose?.(wristSpace, referenceSpace)) gesture.tracked = false;
                    if (stethoscopeHand !== handedness && this._onInstrumentHandFrame?.({
                        handId: hand.xrController.uniqueId, wrist, palm,
                        indexTip: indexTip?.getAbsolutePosition() ?? null,
                        indexExtended,
                        gesture, now: performance.now(),
                    })) {
                        wasFistGrabbing = fistGrab;
                        return;
                    }
                    if (!gesture.tracked) {
                        wasFistGrabbing = false;
                        return;
                    }

                    // A closed hand picks up the stethoscope; opening it releases.
                    // This whole-hand gesture is easier to form than a fingertip pinch.
                    if (!wasFistGrabbing && fistGrab) {
                        wasFistGrabbing = true;
                        const stethoscope = this.scene.getTransformNodeByName("stethoscope-root");
                        let pickedUpStethoscope = false;
                        if (stethoscope && wrist && stethoscopeHand === null && this._canGrabStethoscope?.()) {
                            stethoscope.computeWorldMatrix(true);
                            const bounds = stethoscope.getHierarchyBoundingVectors(true);
                            const center = bounds.min.add(bounds.max).scale(0.5);
                            const radius = bounds.max.subtract(bounds.min).length() * 0.5;
                            if (Vector3.Distance(wrist.getAbsolutePosition(), center) <= Math.max(radius, 0.12) + 0.45) {
                                grabbedStethoscope = stethoscope;
                                stethoscopeOriginalParent = stethoscope.parent as TransformNode | null;
                                stethoscopeOriginalPosition = stethoscope.getAbsolutePosition().clone();
                                stethoscopeHand = handedness;
                                stethoscope.setParent(wrist, true);
                                pickedUpStethoscope = true;
                            }
                        }
                        if (!pickedUpStethoscope && wrist) this._onHandGrab?.(palm);
                    } else if (wasFistGrabbing && fistRelease) {
                        wasFistGrabbing = false;
                        if (stethoscopeHand === handedness && grabbedStethoscope && wrist) {
                            const releasePosition = wrist.getAbsolutePosition().clone();
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
                const removedObserver = handTracking.onHandRemovedObservable.add(removed => {
                    if (removed.xrController.uniqueId !== hand.xrController.uniqueId) return;
                    this._onInstrumentHandLost?.(hand.xrController.uniqueId);
                    this.scene.onBeforeRenderObservable.remove(handRenderObserver);
                    if (stethoscopeHand === handedness && grabbedStethoscope) {
                        grabbedStethoscope.setParent(stethoscopeOriginalParent, true);
                        if (stethoscopeOriginalPosition) grabbedStethoscope.setAbsolutePosition(stethoscopeOriginalPosition);
                        stethoscopeHand = null;
                    }
                    handTracking.onHandRemovedObservable.remove(removedObserver);
                });
            });
        } catch (error) {
            console.error(
                "WebXR initialization failed:",
                error
            );
        }
    }

    // Babylon starts a hand's long-press teleport from scene pointer events.
    private _fixHandTeleportation(xr: WebXRDefaultExperience): void {
        const teleportation = xr.teleportation;

        // When the target appears, teleportation detaches pointer selection,
        // which emits a synthetic pointer up and cancels a hand teleport.
        teleportation.setSelectionFeature(null);

        // Every hand starts on any pointer down and the last one registered
        // wins, so hand the teleport back to the hand that actually pinched.
        const internals = teleportation as unknown as {
            _currentTeleportationControllerId: string;
            _controllers: Record<string, { teleportationState: { forward: boolean } }>;
        };
        this.scene.onPointerObservable.add(pointerInfo => {
            if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;
            const pointerId = (pointerInfo.event as PointerEvent).pointerId;
            const source = xr.pointerSelection.getXRControllerByPointerId(pointerId);
            if (!source?.inputSource.hand) return;
            xr.baseExperience.sessionManager.onXRFrameObservable.addOnce(() => {
                if (!internals._controllers[source.uniqueId]?.teleportationState.forward) return;
                for (const [id, controller] of Object.entries(internals._controllers)) {
                    if (id !== source.uniqueId) controller.teleportationState.forward = false;
                }
                internals._currentTeleportationControllerId = source.uniqueId;
            });
        });
    }
}
