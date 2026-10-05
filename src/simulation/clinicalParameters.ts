// Transcribed from the supplied PDF, not independently clinically validated.
export const pdfSource = "references/checklist PA 2026.pdf";
export const pdfRevision = "2026-03-04";
export const clinicalParameters = {
	readiness: { exerciseMinutes: 90, intakeMinutes: 30, source: `${pdfSource}, item 6` },
	rest: { milliseconds: 300_000, source: `${pdfSource}, item 7` },
	cuffOffset: { minCm: 2, maxCm: 3, source: `${pdfSource}, item 12` },
	// The revised checklist specifies one minute, with no maximum wait.
	estimationWait: { minMs: 60_000, source: `${pdfSource}, item 14` },
	betweenMeasurements: { minMs: 60_000, source: `${pdfSource}, OBS após item 26` },
	inflation: { increment: 10, minAboveEstimate: 20, maxAboveEstimate: 30, source: `${pdfSource}, item 17` },
	deflation: { mmHgPerSecond: 2, source: `${pdfSource}, item 18` },
	confirmation: { minDrop: 20, maxDrop: 30, source: `${pdfSource}, item 21` },
} as const;

export const cuffs = [
	{ id: "newborn", label: "Recém-nascido", min: 0, max: 6, width: 3, length: 6 },
	{ id: "child", label: "Criança", min: 6, max: 15, width: 5, length: 15 },
	{ id: "infant", label: "Infantil", min: 16, max: 21, width: 8, length: 21 },
	{ id: "small-adult", label: "Adulto pequeno", min: 22, max: 26, width: 10, length: 24 },
	{ id: "adult", label: "Adulto", min: 27, max: 34, width: 13, length: 30 },
	{ id: "large-adult", label: "Adulto grande", min: 35, max: 44, width: 16, length: 38 },
	{ id: "thigh", label: "Coxa", min: 45, max: 52, width: 20, length: 42 },
] as const;

// Explicit scenario policy: accept either listed range at the shared 6 cm boundary.
// Do not extrapolate across gaps or silently override the table with sizing guidance.
export function eligibleCuffs(circumference: number): string[] {
	return Number.isFinite(circumference) && circumference > 0
		? cuffs.filter(cuff => circumference >= cuff.min && circumference <= cuff.max).map(cuff => cuff.id)
		: [];
}

export const supportingContent = {
	source: `${pdfSource}, notas 1–3, OBS após item 26 e Tabelas 1–2`,
	firstAssessment: "Na primeira avaliação, meça a pressão nos dois braços, respeitando intervalo mínimo de 1 minuto entre as aferições. Compare os valores e identifique o braço com maior pressão como referência para as medidas subsequentes.",
	// Literal supporting content only: the PDF omits a comparator before PAD 110.
	// Do not use these strings as automatic classification/scoring rules.
	officeClassification: {
		source: `${pdfSource}, Tabela 2`, minimumAgeYears: 18,
		rows: [
			{ label: "PA normal", systolic: "< 120", operator: "e", diastolic: "< 80" },
			{ label: "Pré-hipertensão", systolic: "120–139", operator: "e/ou", diastolic: "80–89" },
			{ label: "HA Estágio 1", systolic: "140–159", operator: "e/ou", diastolic: "90–99" },
			{ label: "HA Estágio 2", systolic: "160–179", operator: "e/ou", diastolic: "100–109" },
			{ label: "HA Estágio 3", systolic: "≥ 180", operator: "e/ou", diastolic: "110" },
		],
		pendingClarification: "A Tabela 2 apresenta PAD 110 no estágio 3 sem sinal de comparação. Confirmar com o responsável pelo checklist antes de automatizar a classificação.",
	},
	cuffSizing: "A largura da bolsa inflável deve corresponder a 40% da circunferência e seu comprimento envolver pelo menos 80% do braço.",
	handHygieneMoments: ["Antes de tocar o paciente", "Antes do procedimento limpo/asséptico", "Após risco de exposição a fluidos corporais", "Após tocar o paciente", "Após tocar superfícies próximas ao paciente"],
};

export const requiredMaterials = ["alcohol-70", "cotton", "tray", "sphygmomanometer", "cuffs", "stethoscope", "measuring-tape"];
