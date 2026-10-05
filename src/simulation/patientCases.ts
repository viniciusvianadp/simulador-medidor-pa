import type { ScenarioConfig } from "./types.js";

export interface PatientCase {
	id: string;
	description: string;
	config: ScenarioConfig;
}

// Single-arm measurement fixtures, not the bilateral first-assessment workflow.
// Fictional engineering fixtures, not diagnoses or clinically validated case histories.
// Ana's pressure matches the PDF example; other numbers exercise configurable behavior.
export const patientCases: PatientCase[] = [
	{
		id: "ana-standard", description: "Manguito adulto; desaparecimento dos sons.",
		config: {
			patient: { name: "Ana Exemplo", dateOfBirth: "1980-05-12", armCircumferenceCm: 30 },
			pressure: { systolic: 118, diastolic: 66 }, persistentSounds: false, arm: "esquerdo",
		},
	},
	{
		id: "bruno-large-cuff", description: "Braço de maior circunferência e valores de pressão maiores.",
		config: {
			patient: { name: "Bruno Exemplo", dateOfBirth: "1965-09-23", armCircumferenceCm: 40 },
			pressure: { systolic: 158, diastolic: 94 }, persistentSounds: false, arm: "direito",
		},
	},
	{
		id: "clara-small-cuff", description: "Manguito adulto pequeno e valores de pressão menores.",
		config: {
			patient: { name: "Clara Exemplo", dateOfBirth: "1997-02-08", armCircumferenceCm: 24 },
			pressure: { systolic: 96, diastolic: 58 }, persistentSounds: false, arm: "esquerdo",
		},
	},
	{
		id: "diego-persistent", description: "Sons persistentes até zero; registro do abafamento.",
		config: {
			patient: { name: "Diego Exemplo", dateOfBirth: "1988-11-19", armCircumferenceCm: 33 },
			pressure: { systolic: 126, diastolic: 72 }, persistentSounds: true, arm: "direito",
		},
	},
	{
		id: "elisa-infant-cuff", description: "Circunferência de 21 cm; manguito infantil conforme a Tabela 1 de 2026.",
		config: {
			patient: { name: "Elisa Exemplo", dateOfBirth: "2001-06-04", armCircumferenceCm: 21 },
			pressure: { systolic: 110, diastolic: 70 }, persistentSounds: false, arm: "esquerdo",
		},
	},
];

export const defaultConfig: ScenarioConfig = structuredClone(patientCases[0].config);
