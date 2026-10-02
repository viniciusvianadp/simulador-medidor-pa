// Transcribed from the supplied PDF, not independently clinically validated.
export const pdfSource = "references/check list medida da PA.pdf";
export const clinicalParameters = {
	readiness: { exerciseMinutes: 60, intakeMinutes: 30, source: `${pdfSource}, item 6` },
	rest: { milliseconds: 300_000, source: `${pdfSource}, item 7` },
	cuffOffset: { minCm: 2, maxCm: 3, source: `${pdfSource}, item 12` },
	estimationWait: { minMs: 15_000, maxMs: 30_000, source: `${pdfSource}, item 14` },
	inflation: { increment: 10, minAboveEstimate: 20, maxAboveEstimate: 30, source: `${pdfSource}, item 17` },
	deflation: { mmHgPerSecond: 2, source: `${pdfSource}, item 18` },
	confirmation: { minDrop: 20, maxDrop: 30, source: `${pdfSource}, item 21` },
} as const;

export const cuffs = [
	{ id: "newborn", label: "Recém-nascido", min: 0, max: 10, width: 4, length: 8 },
	{ id: "child", label: "Criança", min: 11, max: 15, width: 6, length: 12 },
	{ id: "infant", label: "Infantil", min: 16, max: 22, width: 9, length: 18 },
	{ id: "small-adult", label: "Adulto pequeno", min: 20, max: 26, width: 10, length: 17 },
	{ id: "adult", label: "Adulto", min: 27, max: 34, width: 12, length: 23 },
	{ id: "large-adult", label: "Adulto grande", min: 35, max: 45, width: 16, length: 32 },
] as const;

// Explicit scenario policy: accept either listed range when ranges overlap.
// Do not extrapolate across gaps or silently override the table with sizing guidance.
export function eligibleCuffs(circumference: number): string[] {
	return Number.isFinite(circumference) && circumference > 0
		? cuffs.filter(cuff => circumference >= cuff.min && circumference <= cuff.max).map(cuff => cuff.id)
		: [];
}

export const supportingContent = {
	source: `${pdfSource}, notas 1–3 e Tabela 1`,
	cuffSizing: "A largura da bolsa inflável deve corresponder a 40% da circunferência e seu comprimento envolver pelo menos 80% do braço.",
	handHygieneMoments: ["Antes de tocar o paciente", "Antes do procedimento limpo/asséptico", "Após risco de exposição a fluidos corporais", "Após tocar o paciente", "Após tocar superfícies próximas ao paciente"],
};

export const requiredMaterials = ["alcohol-70", "cotton", "tray", "sphygmomanometer", "cuffs", "stethoscope", "measuring-tape"];
