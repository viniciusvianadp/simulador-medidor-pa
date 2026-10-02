import type { ActionCondition, ActionDefinition, StepDefinition } from "./types.js";
import { pdfSource } from "./clinicalParameters.js";

export { defaultConfig } from "./patientCases.js";

function action(type: string, target: string, prompt: string, condition: ActionCondition = { rule: "equals", expected: true }): ActionDefinition {
	return { type, target, prompt, ...condition, feedback: `Ação não concluída. ${prompt}` };
}
const hygiene = () => action("hand-hygiene-performed", "hygiene-station", "Higienize as mãos.");
const dialogue = (type: string, prompt: string, condition: ActionCondition = { rule: "equals", expected: true }) => action(type, "patient", prompt, condition);

const entries: [string, string, ActionDefinition[]][] = [
	["initial-hand-hygiene", "Higienize as mãos.", [hygiene()]],
	["disinfect-stethoscope", "Desinfete o estetoscópio com algodão e álcool a 70%.", [
		action("chestpiece-disinfected", "stethoscope", "Desinfete a campânula/diafragma com algodão e álcool a 70%.", { rule: "equals", expected: "cotton-alcohol-70" }),
		action("earpieces-disinfected", "stethoscope", "Desinfete as olivas com algodão e álcool a 70%.", { rule: "equals", expected: "cotton-alcohol-70" }),
	]],
	["prepare-materials", "Separe os materiais na bandeja.", [action("materials-gathered", "tray", "Coloque todos os materiais necessários na bandeja.", { rule: "materials" })]],
	["hand-hygiene-before-identification", "Higienize as mãos novamente.", [hygiene()]],
	["identify-patient", "Apresente-se e confirme dois identificadores.", [dialogue("introduced-self", "Apresente-se ao paciente."), dialogue("name-confirmed", "Confirme o nome do paciente.", { rule: "patient-name" }), dialogue("birth-date-confirmed", "Confirme a data de nascimento.", { rule: "patient-birth" })]],
	["check-readiness", "Verifique as condições de preparo do paciente.", [dialogue("bladder-checked", "Confirme que a bexiga não está cheia.", { rule: "equals", expected: "empty" }), dialogue("exercise-history-checked", "Confirme pelo menos 60 minutos sem exercício, caminhada ou fisioterapia.", { rule: "exercise" }), dialogue("intake-history-checked", "Confirme pelo menos 30 minutos sem álcool, café, alimentos ou tabaco.", { rule: "intake" })]],
	["explain-and-rest", "Explique o procedimento e proporcione repouso em ambiente calmo.", [dialogue("procedure-explained", "Explique o procedimento."), dialogue("silence-instructed", "Oriente a não conversar durante a medida."), dialogue("questions-addressed", "Esclareça as dúvidas antes da medida."), dialogue("quiet-rest-started", "Inicie o repouso em ambiente calmo.", { rule: "start-timer" }), dialogue("quiet-rest-finished", "Aguarde pelo menos 5 minutos de repouso.", { rule: "rest" })]],
	["hand-hygiene-before-measurement", "Higienize as mãos.", [hygiene()]],
	["measure-arm-and-select-cuff", "Meça o braço e selecione o manguito.", [action("arm-prepared", "patient-arm", "Deixe o braço desnudo, fletido, com a mão na cintura."), action("midpoint-located", "patient-arm", "Determine o ponto médio entre acrômio e olecrano."), action("arm-extended", "patient-arm", "Estenda o braço ao longo do corpo."), action("circumference-measured", "measuring-tape", "Meça a circunferência no ponto médio.", { rule: "circumference" }), action("cuff-selected", "cuffs", "Selecione um manguito da faixa indicada na Tabela 1.", { rule: "cuff" })]],
	["position-patient", "Posicione o paciente sentado na cadeira.", [
		...[["seated", "Sente o paciente na cadeira."], ["legs-uncrossed", "Descruze as pernas."], ["feet-supported", "Apoie os pés no chão."], ["back-supported", "Mantenha o dorso apoiado e relaxado."], ["arm-supported", "Apoie o braço desnudo na altura do coração (3º ao 5º espaço intercostal)."], ["palm-up", "Mantenha a palma para cima."], ["elbow-flexed", "Deixe o cotovelo ligeiramente fletido."]].map(([type, prompt]) => dialogue(type, prompt)),
	]],
	["align-cuff", "Localize a artéria braquial e alinhe a bolsa.", [action("brachial-artery-palpated", "patient-arm", "Palpe a artéria braquial."), action("bladder-aligned", "cuff", "Alinhe o meio da bolsa sobre a artéria braquial.")]],
	["fit-cuff", "Ajuste o manguito sem folgas, 2–3 cm acima da fossa cubital.", [action("cuff-fitted", "cuff", "Ajuste o manguito sem folgas."), action("cuff-offset-measured", "cuff", "Posicione o manguito 2–3 cm acima da fossa cubital.", { rule: "offset" })]],
	["align-gauge", "Posicione os olhos no nível do manômetro.", [action("eye-level-aligned", "gauge", "Alinhe os olhos com o manômetro aneroide.")]],
	["estimate-systolic", "Estime a pressão sistólica pela palpação radial.", [action("radial-pulse-palpated", "patient-wrist", "Palpe o pulso radial."), action("pulse-disappeared", "cuff", "Infle até o pulso desaparecer.", { rule: "pulse-disappearance" }), action("slow-deflation-performed", "cuff", "Desinfle lentamente."), action("pulse-reappearance-recorded", "gauge", "Registre a pressão de reaparecimento do pulso.", { rule: "systolic" }), action("estimation-air-released", "cuff", "Libere todo o ar.", { rule: "release-start-timer" }), action("estimation-wait-finished", "cuff", "Aguarde de 15 a 30 segundos.", { rule: "estimation-wait" })]],
	["place-earpieces", "Coloque as olivas voltadas para frente.", [action("earpieces-placed", "stethoscope", "Coloque as olivas nos ouvidos, voltadas para frente.")]],
	["place-bell", "Posicione a campânula sobre a artéria braquial.", [action("cubital-artery-palpated", "patient-arm", "Palpe a artéria braquial na fossa cubital."), action("bell-placed", "stethoscope", "Coloque a campânula sem compressão excessiva.")]],
	["inflate-for-auscultation", "Infle rapidamente de 10 em 10 mmHg até 20–30 mmHg acima da estimativa.", [action("rapid-inflation-increment", "cuff", "Infle rapidamente em incrementos de 10 mmHg.", { rule: "inflate" })]],
	["start-deflation", "Desinfle a 2 mmHg por segundo.", [action("deflation-started", "cuff", "Ajuste a deflação para 2 mmHg/s.", { rule: "deflation" })]],
	["identify-systolic", "Identifique o primeiro som de Korotkoff, seguido de batidas regulares.", [action("first-sound-recorded", "gauge", "Registre a pressão do primeiro som.", { rule: "systolic" }), action("regular-beats-confirmed", "stethoscope", "Confirme as batidas regulares após o primeiro som.")]],
	["identify-diastolic", "Identifique o desaparecimento dos sons (fase V).", [action("sound-disappearance-recorded", "gauge", "Registre a pressão no desaparecimento dos sons.", { rule: "diastolic" })]],
	["confirm-disappearance", "Confirme o desaparecimento dos sons e libere o ar.", [action("disappearance-confirmed", "stethoscope", "Continue auscultando por mais 20–30 mmHg.", { rule: "confirmation" }), action("remaining-air-released", "cuff", "Libere todo o ar restante.", { rule: "equals", expected: 0 })]],
	["persistent-sounds", "Se os sons persistirem até zero, registre sistólica/abafamento/zero.", [action("muffling-recorded", "gauge", "Registre a pressão no abafamento dos sons.", { rule: "diastolic" }), action("sounds-at-zero-confirmed", "stethoscope", "Confirme a persistência dos sons até zero.", { rule: "equals", expected: 0 }), action("three-values-recorded", "record", "Registre sistólica/diastólica/zero.", { rule: "readings" })]],
	["inform-patient", "Informe os valores obtidos ao paciente.", [dialogue("results-communicated", "Informe os valores obtidos ao paciente.", { rule: "readings" })]],
	["remove-cuff", "Retire o manguito.", [action("cuff-removed", "cuff", "Retire o manguito do paciente.")]],
	["final-hand-hygiene", "Higienize as mãos após o procedimento.", [hygiene()]],
	["document-measurement", "Cheque o procedimento e registre a medida exata no prontuário.", [action("measurement-documented", "record", "Registre data/hora, braço, posição, valores exatos e identificação profissional fictícia.", { rule: "documentation" })]],
];

export const auscultatoryScenario: StepDefinition[] = entries.map(([id, prompt, completionConditions], index) => ({
	id, checklistNumber: index + 1, prompt, completionConditions,
	prerequisites: index === 0 ? [] : [entries[index - 1][0]],
	targets: [...new Set(completionConditions.map(condition => condition.target))],
	source: `${pdfSource}, item ${index + 1}`,
}));
// Branch prerequisites describe actual clinical ordering, preserving PDF numbering.
auscultatoryScenario[21].prerequisites = ["identify-systolic"];
auscultatoryScenario[22].prerequisites = ["confirm-disappearance", "persistent-sounds"];
