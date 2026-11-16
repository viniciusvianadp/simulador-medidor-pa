import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { BulbGripCycle, ValveTouchLatch, type GripGesture } from "./gripGesture";

export interface InstrumentHandFrame {
	handId: string;
	wrist: TransformNode | null;
	palm: Vector3;
	indexTip: Vector3 | null;
	indexExtended?: boolean;
	gesture: GripGesture;
	now: number;
}

type DockPose = { node: TransformNode; parent: TransformNode | null; position: Vector3; rotation: Vector3; quaternion: Quaternion | null; scale: Vector3 };

/** Owns the tethered bulb while a hand grips it; the scene still owns its meshes. */
export class HandInstruments {
	private _owner: string | null = null;
	private _carrier: TransformNode | null = null;
	private _rotationOffset = Quaternion.Identity();
	private _centerLocal = Vector3.Zero();
	private _dock: DockPose[] = [];
	private _cycle = new BulbGripCycle();
	private _closed = new Map<string, boolean>();
	private _touches = new Map<string, ValveTouchLatch>();
	public lastValveTouch = -Infinity;

	public constructor(
		private _bulb: Mesh,
		private _valve: Mesh,
		private _pump: () => boolean,
		private _useValve: () => boolean,
		private _canAcquire: () => boolean,
		private _settleFeedback: () => void,
	) {}

	public get isHolding(): boolean { return this._owner !== null; }

	public update(frame: InstrumentHandFrame): boolean {
		const { handId, gesture, now } = frame;
		const closedForGrab = gesture.grab && !frame.indexExtended;
		const wasClosed = this._closed.get(handId) ?? false;
		this._closed.set(handId, closedForGrab);
		if (this._owner === handId) {
			if (gesture.tracked && frame.wrist) this._followHand(frame);
			const event = this._cycle.update(gesture, now);
			if (event === "release") this.release();
			else if (event === "squeeze") this._pump();
			return true;
		}
		if (!gesture.tracked || !frame.wrist) return false;
		if (this._owner === null && closedForGrab && !wasClosed && this._canAcquire()) {
			this._bulb.computeWorldMatrix(true);
			const center = this._bulb.getBoundingInfo().boundingBox.centerWorld.clone();
			if (Vector3.Distance(frame.palm, center) <= 0.14) {
				this._settleFeedback();
				const scene = this._bulb.getScene();
				const parts = [this._bulb, scene.getMeshByName("instrument-bulb-cap"), this._valve.parent];
				this._dock = parts.filter((node): node is TransformNode => node instanceof TransformNode).map(node => ({
					node, parent: node.parent as TransformNode | null, position: node.position.clone(),
					rotation: node.rotation.clone(), quaternion: node.rotationQuaternion?.clone() ?? null, scale: node.scaling.clone(),
				}));
				const carrier = new TransformNode("held-bulb-root", scene);
				// Group in the original model space first. Reparenting each mesh
				// independently loses its non-zero GLB pivot under hand scaling.
				carrier.parent = this._dock[0].parent;
				for (const pose of this._dock) pose.node.parent = carrier;
				carrier.setParent(null, true);
				carrier.computeWorldMatrix(true);
				this._bulb.computeWorldMatrix(true);
				this._centerLocal = Vector3.TransformCoordinates(this._bulb.getBoundingInfo().boundingBox.centerWorld, carrier.getWorldMatrix().clone().invert());
				frame.wrist.computeWorldMatrix(true);
				const rotation = carrier.rotationQuaternion ?? Quaternion.FromEulerVector(carrier.rotation);
				this._rotationOffset = frame.wrist.absoluteRotationQuaternion.conjugate().multiply(rotation);
				this._carrier = carrier;
				this._owner = handId;
				carrier.metadata = { ownerHandId: handId };
				this._followHand(frame);
				this._cycle = new BulbGripCycle();
				return true;
			}
		}
		// Only the free hand operates the valve while the other holds the bulb.
		let valveContact = false;
		if (frame.indexTip) {
			this._valve.computeWorldMatrix(true);
			const distance = Vector3.Distance(frame.indexTip, this._valve.getBoundingInfo().boundingBox.centerWorld);
			const latch = this._touches.get(handId) ?? new ValveTouchLatch();
			this._touches.set(handId, latch);
			if (latch.update(distance) && (frame.indexExtended ?? !gesture.tight)) {
				this.lastValveTouch = now;
				this._useValve();
			}
			valveContact = distance < 0.065;
		}
		return valveContact;
	}

	private _followHand(frame: InstrumentHandFrame): void {
		if (!this._carrier || !frame.wrist) return;
		frame.wrist.computeWorldMatrix(true);
		// Joint meshes are scaled to their tracked radius. Copy pose only, so
		// those radii cannot resize the instrument as the learner moves.
		this._carrier.rotationQuaternion = frame.wrist.absoluteRotationQuaternion.multiply(this._rotationOffset);
		this._carrier.computeWorldMatrix(true);
		const offset = Vector3.TransformNormal(this._centerLocal, this._carrier.getWorldMatrix());
		this._carrier.position.copyFrom(frame.palm.subtract(offset));
		this._carrier.computeWorldMatrix(true);
	}

	public handLost(handId: string): void {
		if (this._owner === handId) this.release();
		this._closed.delete(handId);
		this._touches.delete(handId);
	}

	public release(): void {
		this._settleFeedback();
		for (const { node, parent, position, rotation, quaternion, scale } of this._dock) {
			node.parent = parent;
			node.position.copyFrom(position);
			node.rotation.copyFrom(rotation);
			node.rotationQuaternion = quaternion?.clone() ?? null;
			node.scaling.copyFrom(scale);
			node.computeWorldMatrix(true);
		}
		this._carrier?.dispose();
		this._carrier = null;
		this._dock = [];
		this._owner = null;
		this._cycle = new BulbGripCycle();
	}

	public dispose(): void {
		this.release();
		this._closed.clear();
		this._touches.clear();
	}
}
