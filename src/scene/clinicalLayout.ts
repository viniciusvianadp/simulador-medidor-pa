// Single source for the clinical room's spatial layout, in meters (Babylon
// left-handed axes, +Y up). Room expansion (B13), the patient model (B12) and
// item placement (B14) should change values here instead of in scene code.

export type Vec3 = [number, number, number];

export type StationId = "overview" | "hygiene" | "prontuario" | "mesa" | "cadeira" | "esquerdo" | "direito";

export interface Station {
	/** Desktop camera eye position. */
	position: Vec3;
	lookAt: Vec3;
	/** WebXR teleport snap point on the floor, when the station offers one. */
	teleportPoint?: [number, number];
}

const eyeHeight = 1.6;

export const clinicalLayout = {
	eyeHeight,

	/** doctors_office.glb is authored at roughly half real-world size. */
	officeScale: 2.4,

	/** Interior bounds: GLB walls on −X/−Z, added enclosure walls on +X/+Z. */
	room: { minX: -2.45, maxX: 2.28, minZ: -2.52, maxZ: 2.40, height: 2.88 },

	/** Distance kept between the XR teleport floor and the walls. */
	teleportWallMargin: 0.2,

	spawn: { position: [-1.05, eyeHeight, -1.50] as Vec3, lookAt: [-1.60, 1.10, -1.40] as Vec3 },

	stations: {
		overview: { position: [0, eyeHeight, 0.5], lookAt: [-1.3, 1.1, -1.3], teleportPoint: [0, 0.5] },
		hygiene: { position: [-1.05, eyeHeight, -1.50], lookAt: [-1.23, 1.0, -1.90], teleportPoint: [-1.05, -1.50] },
		prontuario: { position: [-1.05, eyeHeight, -1.50], lookAt: [-0.67, 1.0, -1.90], teleportPoint: [-1.05, -1.50] },
		mesa: { position: [-1.05, eyeHeight, -1.50], lookAt: [-0.95, 1.0, -1.90], teleportPoint: [-1.05, -1.50] },
		cadeira: { position: [-0.65, 1.65, -0.45], lookAt: [-1.65, 1.05, -1.20], teleportPoint: [-0.65, -0.45] },
		esquerdo: { position: [-1.05, eyeHeight, -0.45], lookAt: [-1.65, 0.85, -0.95], teleportPoint: [-1.05, -0.45] },
		direito: { position: [-1.05, eyeHeight, -1.50], lookAt: [-1.60, 1.10, -1.40], teleportPoint: [-1.05, -1.50] },
	} satisfies Record<StationId, Station>,

	// Apply only after the mannequin/chair pose helpers inspect source coordinates.
	patientStationOffset: [-0.80, 0, 0] as Vec3,
	measurementStandOffset: [0.25, -0.13, 0.14] as Vec3,
	supplyTableCenter: [-0.95, -1.90] as [number, number],
	// The imported pump points along +X; face the shared station (+0.18 X, +0.40 Z).
	sanitizerRotationY: -Math.atan2(0.40, 0.18),
	supplyPositions: {
		sanitizer: [-1.23, -1.90], stethoscope: [-0.97, -1.90], record: [-0.67, -1.90],
	} satisfies Record<string, [number, number]>,

	chair: { position: [-1.15, 0.02, -1.25] as Vec3, rotationY: Math.PI / 2, scale: 0.035 },
	patient: { position: [-1.04, 0.332, -1.095] as Vec3, rotationY: Math.PI / 2, scale: 1.0 },

	/** Supply tray shares the relocated table; heights come from its mesh. */
	supplyTray: { x: -1.08, width: 0.53, depth: 0.32 },

	/** Invisible interaction anchors on the patient's arms. */
	anchors: {
		forearm: { esquerdo: [-0.85, 0.85, -0.95] as Vec3, direito: [-0.98, 1.085, -1.5] as Vec3 },
		wrist: { esquerdo: [-0.85, 0.85, -0.72] as Vec3, direito: [-0.98, 1.085, -1.72] as Vec3 },
	},

	soapDispenser: [0.792, 1.272, -2.391] as Vec3,
	dialogueApproachRadius: 1.6,
	dialogueTrigger: [-1.84, 1.85, -1.095] as Vec3,
	/** General XR guidance slate, offset from the wall behind the sanitizer. */
	xrSlate: [-2.3, 1.85, -0.62] as Vec3,
	/** Restart/mode panel on the empty front wall (+Z), facing into the room. */
	restartPanel: [0, 1.45, 2.37] as Vec3,
};

/** Rectangle of the room floor that accepts XR teleportation. */
export function teleportFloorBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
	const { room, teleportWallMargin: margin } = clinicalLayout;
	return { minX: room.minX + margin, maxX: room.maxX - margin, minZ: room.minZ + margin, maxZ: room.maxZ - margin };
}
