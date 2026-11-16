/** Finger extension is tip-to-knuckle distance divided by its joint-chain length. */
export interface GripGesture {
	tracked: boolean;
	grab: boolean;
	tight: boolean;
	relaxed: boolean;
	open: boolean;
}

export function classifyGrip(distances: number[], palmSpan: number, fingerLengths?: number[]): GripGesture {
	const span = Number.isFinite(palmSpan) && palmSpan >= 0.04 ? palmSpan : 0.08;
	const ratios = distances.map((distance, index) => {
		const length = fingerLengths?.[index];
		return distance / (length && Number.isFinite(length) && length > 0.02 ? length : span);
	}).filter(ratio => Number.isFinite(ratio) && ratio >= 0);
	const tracked = ratios.length >= 3;
	return {
		tracked,
		grab: tracked && ratios.filter(ratio => ratio < 0.78).length >= 3,
		tight: tracked && ratios.filter(ratio => ratio < 0.45).length >= 3,
		relaxed: tracked && ratios.filter(ratio => ratio > 0.62).length >= 3,
		open: tracked && ratios.filter(ratio => ratio > 0.90).length >= 3,
	};
}

/** Acquisition never pumps; each squeeze needs a preceding relaxation. */
export class BulbGripCycle {
	private _armed = false;
	private _openSince: number | null = null;
	private _lostSince: number | null = null;

	public update(gesture: GripGesture, now: number): "squeeze" | "release" | null {
		if (!gesture.tracked) {
			this._lostSince ??= now;
			this._armed = false;
			this._openSince = null;
			return now - this._lostSince >= 250 ? "release" : null;
		}
		this._lostSince = null;
		if (gesture.open) {
			this._openSince ??= now;
			if (now - this._openSince >= 350) return "release";
		} else this._openSince = null;
		if (gesture.relaxed) this._armed = true;
		if (gesture.tight && this._armed) {
			this._armed = false;
			return "squeeze";
		}
		return null;
	}
}

/** Direct valve contact fires once until the finger clearly withdraws. */
export class ValveTouchLatch {
	private _touching = false;
	public update(distance: number): boolean {
		if (distance >= 0.065) this._touching = false;
		if (distance > 0.035 || this._touching) return false;
		this._touching = true;
		return true;
	}
}
