import { cuffs, pdfSource } from "../simulation/clinicalParameters.js";

// Dimensions are design assumptions in meters unless sourced from the cuff table.
export const roomSpec = {
	version: 1,
	units: "meters",
	size: { width: 4.6, depth: 4.8, height: 2.8, wallThickness: 0.12 },
	patient: { position: [0, 0, 0.45], seatHeight: 0.46, armHeight: 1.04 },
	learner: { position: [1.6, 1.6, -2.0], target: [0.3, 0.95, 0.35], eyeHeight: 1.6 },
	workPositions: {
		esquerdo: [0.95, 0, 0.15],
		direito: [-0.95, 0, 0.15],
		hygiene: [1.38, 0, -0.48],
	},
	tray: { position: [1.1, 0.87, 0.65], width: 0.5, depth: 0.34 },
	hygiene: { position: [1.72, 1.12, -0.1] },
	gauge: { position: [0.78, 1.35, 0.44], diameter: 0.12 },
	// Preliminary standalone-XR budgets; no particular headset has been validated.
	budgets: { blockoutTriangles: 15000, finalVisibleTriangles: 150000, drawCalls: 120, textureSize: 1024, labelTextureSize: 512 },
	palette: {
		wall: "#F2F2E9", floor: "#C5D8D1", trim: "#FFFFFF", green: "#1B5947",
		upholstery: "#52786E", metal: "#B6C3BF", dark: "#253C38", skin: "#C89778",
		shirt: "#E3E6DA", trousers: "#586866", glass: "#B9D7DB", accent: "#BC651F",
	},
} as const;

export interface ClinicalAsset {
	id: string;
	label: string;
	stage: string;
	dimensions: string;
	method: "procedural" | "adapt-rigged-model" | "controlled-label";
	status: "blockout" | "planned";
	materials: string[];
	parts: string[];
	source: string;
}

const asset = (id: string, label: string, stage: string, dimensions: string, materials: string[], parts: string[], status: ClinicalAsset["status"] = "blockout", method: ClinicalAsset["method"] = "procedural"): ClinicalAsset => ({
	id, label, stage, dimensions, materials, parts, status, method,
	source: method === "adapt-rigged-model" ? "Current placeholder: original procedural geometry; final model/source/license not selected." : "Original project geometry or controlled label; no third-party asset used.",
});

export const clinicalAssets: ClinicalAsset[] = [
	asset("room", "Sala clínica", "3.3", "4.60 × 4.80 × 2.80 m interior", ["wall", "floor", "trim"], ["ground", "walls", "ceiling"]),
	asset("door", "Porta", "3.3", "0.90 × 2.10 m opening", ["upholstery", "metal"], ["door-panel", "handle"]),
	asset("windows", "Janelas", "3.3", "Two 1.30 × 1.10 m panes", ["glass", "trim"], ["frames", "panes"]),
	asset("lighting", "Iluminação", "3.3", "Ceiling panels 1.20 × 0.35 m", ["trim"], ["ceiling-panels", "fill", "window-light"]),
	asset("chair", "Cadeira", "3.4", "Seat 0.52 × 0.48 m; seat height 0.46 m", ["upholstery", "metal"], ["seat", "back", "legs"]),
	asset("arm-supports", "Apoios de braço", "3.4", "Two 0.20 × 0.48 m pads; top 1.04 m", ["upholstery", "metal"], ["left-pad", "right-pad", "adjustable-stems"]),
	asset("trolley", "Mesa de instrumentos", "3.4", "0.70 × 0.50 m top; top height 0.84 m", ["trim", "metal"], ["top", "shelf", "legs"]),
	asset("patient", "Paciente", "3.5", "Seated placeholder head top approximately 1.57 m", ["skin", "shirt", "trousers"], ["torso", "head", "left-arm", "right-arm", "legs", "feet"], "blockout", "adapt-rigged-model"),
	asset("patient-poses", "Posições do paciente", "3.5", "Waist-height flexion, arm alongside body, supported palm-up pose on both sides", ["skin"], ["shoulders", "elbows", "wrists"], "planned", "adapt-rigged-model"),
	asset("hygiene-station", "Higiene das mãos", "3.6", "Dispenser 0.13 × 0.22 × 0.12 m; action height 1.12 m", ["trim", "green"], ["dispenser", "pump", "stand"]),
	asset("tray", "Bandeja", "3.6", "0.50 × 0.34 m; rim 0.025 m", ["metal"], ["base", "rim", "placement-zone"]),
	asset("alcohol-70", "Álcool 70%", "3.6", "Bottle 0.055 m diameter × 0.14 m height", ["trim", "green"], ["bottle", "cap", "label"]),
	asset("cotton", "Algodão", "3.6", "Container 0.08 m diameter × 0.06 m height", ["trim", "metal"], ["container", "cotton"]),
	asset("gauge", "Manômetro", "3.7", "0.12 m face diameter; 0.035 m depth", ["metal", "trim", "dark"], ["body", "face", "needle", "stand"]),
	asset("gauge-face", "Escala do manômetro", "3.7", "Exact mmHg scale; 512 px label texture budget", ["trim", "dark"], ["ticks", "numbers", "units"], "planned", "controlled-label"),
	asset("bulb", "Pera de insuflação", "3.7", "0.045 × 0.08 m", ["dark"], ["bulb", "valve"]),
	asset("pressure-tubes", "Tubos do esfigmomanômetro", "3.7", "0.008 m diameter; final routes depend on active arm", ["dark"], ["gauge-tube", "bulb-tube"], "planned"),
	...cuffs.map(cuff => ({
		...asset(`cuff-${cuff.id}`, `Manguito ${cuff.label}`, "3.7", `Bladder ${cuff.width / 100} × ${cuff.length / 100} m; arm ${cuff.min > 0 ? cuff.min : ">0"}–${cuff.max} cm. Outer sleeve not yet sized.`, ["upholstery", "trim"], ["loose", "fitted", "alignment-mark", "size-label"], "planned"),
		source: `${pdfSource}, Tabela 1; dimensions apply to inflatable bladder, not outer sleeve.`,
	})),
	asset("cuffs", "Reserva de manguitos", "3.7", "0.55 × 0.24 m storage zone; schematic stack only", ["upholstery"], ["storage-zone"]),
	asset("stethoscope", "Estetoscópio", "3.8", "Chestpiece 0.045 m diameter; tube approximately 0.60 m", ["metal", "dark"], ["earpieces", "tube", "bell", "diaphragm"]),
	asset("measuring-tape", "Fita métrica", "3.8", "0.015 m wide; approximately 1.50 m unrolled", ["trim", "dark"], ["loose", "wrapped", "centimeter-labels"]),
	asset("labels", "Identificação dos materiais", "3.6–3.8", "Shared controlled SVG/canvas labels, at most 512 px each", ["trim", "dark", "green"], ["alcohol-70-label", "cuff-labels", "tape-markings"], "planned", "controlled-label"),
];
