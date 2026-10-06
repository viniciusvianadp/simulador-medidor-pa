import { Scene } from "@babylonjs/core/scene.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { PointerEventTypes, PointerInfo } from "@babylonjs/core/Events/pointerEvents.js";
import type { App } from "../App.js";
import { eligibleCuffs, requiredMaterials } from "../simulation/clinicalParameters.js";
import type { InteractionEvent, MeasurementRecord, SessionState } from "../simulation/types.js";

export interface StepHint {
	checklistNumber: number;
	title: string;
	instruction: string;
	targetName: string;
	targetPosition: [number, number, number];
	actionLabel: string;
	stationName?: "overview" | "hygiene" | "prontuario" | "esquerdo" | "direito";
}

export class InteractionManager {
	private _scene: Scene;
	private _app: App;
	private _arrowRoot: TransformNode | null = null;
	private _currentTargetPosition = new Vector3(0, 0, 0);
	private _targetLerpPosition = new Vector3(0, 0, 0);
	private _guidanceCard: HTMLElement | null = null;
	private _disposed = false;
	private _audioCtx: AudioContext | null = null;

	public constructor(scene: Scene, app: App) {
		this._scene = scene;
		this._app = app;
		this._initTargetArrow();
		this._initPointerInteractions();
		this._initGuidanceHUD();
		this._updateFromCurrentStep();
	}

	private _initTargetArrow(): void {
		const root = new TransformNode("target-indicator-arrow-root", this._scene);
		const material = new StandardMaterial("target-arrow-material", this._scene);
		material.diffuseColor = Color3.FromHexString("#00E5FF");
		material.emissiveColor = Color3.FromHexString("#00B0FF");
		material.specularColor = Color3.White();

		// Cone head pointing downwards
		const cone = CreateCylinder("target-arrow-cone", {
			diameterTop: 0,
			diameterBottom: 0.14,
			height: 0.20,
			tessellation: 20,
		}, this._scene);
		cone.material = material;
		cone.rotation.x = Math.PI; // point down
		cone.position.y = 0.10;
		cone.isPickable = false;
		cone.parent = root;

		// Shaft above the cone
		const shaft = CreateCylinder("target-arrow-shaft", {
			diameter: 0.045,
			height: 0.18,
			tessellation: 16,
		}, this._scene);
		shaft.material = material;
		shaft.position.y = 0.29;
		shaft.isPickable = false;
		shaft.parent = root;

		this._arrowRoot = root;

		let time = 0;
		this._scene.onBeforeRenderObservable.add(() => {
			if (this._disposed || !this._arrowRoot) return;
			time += 0.04;
			// Smoothly lerp towards target position
			Vector3.LerpToRef(this._arrowRoot.position, this._targetLerpPosition, 0.15, this._arrowRoot.position);
			// Bob up and down
			this._arrowRoot.position.y = this._targetLerpPosition.y + Math.sin(time) * 0.04;
			this._arrowRoot.rotation.y += 0.02;
		});
	}

	private _initPointerInteractions(): void {
		this._scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
			if (this._disposed) return;
			if (pointerInfo.type !== PointerEventTypes.POINTERPICK && pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;
			const mesh = pointerInfo.pickInfo?.pickedMesh;
			if (!mesh) return;

			this.handleMeshInteraction(mesh.name, mesh.metadata?.logicalTarget ?? mesh.metadata?.assetId);
		});
	}

	public handleMeshInteraction(meshName: string, logicalTarget?: string): boolean {
		const snapshot = this._app.getSimulationSnapshot();
		if (!snapshot) return false;

		const target = logicalTarget ?? this._resolveLogicalTarget(meshName);
		if (!target) return false;

		// Dispatch interaction corresponding to current step
		return this.executeActiveStepAction(target);
	}

	private _resolveLogicalTarget(meshName: string): string | null {
		if (meshName === "Soap_blinn1_0" || meshName.startsWith("hygiene")) return "hygiene-station";
		if (meshName === "Clipboard_blinn1_0") return "record";
		if (meshName.startsWith("patient-forearm") || meshName.startsWith("patient-arm") || meshName.startsWith("patient-cubital")) return "patient-arm";
		if (meshName.startsWith("patient-wrist")) return "patient-wrist";
		if (meshName.startsWith("patient-")) return "patient";
		if (meshName.startsWith("stethoscope")) return "stethoscope";
		if (meshName.startsWith("measuring-tape")) return "measuring-tape";
		if (meshName.startsWith("cuff")) return "cuffs";
		if (meshName.startsWith("gauge")) return "gauge";
		if (meshName.startsWith("tray") || meshName.startsWith("trolley")) return "tray";
		return null;
	}

	public executeActiveStepAction(targetOverride?: string): boolean {
		const snapshot = this._app.getSimulationSnapshot();
		if (!snapshot) return false;

		const stepId = snapshot.currentStepId;
		const config = snapshot.config;
		const arm = config.arm;
		const targetArmName = `patient-arm`;

		let handled = false;

		switch (stepId) {
			case "initial-hand-hygiene":
			case "hand-hygiene-before-identification":
			case "hand-hygiene-before-measurement":
			case "final-hand-hygiene": {
				if (!targetOverride || targetOverride === "hygiene-station") {
					this._app.dispatchSimulationEvent({ type: "hand-hygiene-performed", target: "hygiene-station", value: true });
					this._showFeedback("Mãos higienizadas com sucesso!");
					handled = true;
				}
				break;
			}
			case "disinfect-stethoscope": {
				if (!targetOverride || targetOverride === "stethoscope") {
					this._app.dispatchSimulationEvent({ type: "chestpiece-disinfected", target: "stethoscope", value: "cotton-alcohol-70" });
					this._app.dispatchSimulationEvent({ type: "earpieces-disinfected", target: "stethoscope", value: "cotton-alcohol-70" });
					this._showFeedback("Estetoscópio desinfetado com algodão e álcool 70%!");
					handled = true;
				}
				break;
			}
			case "prepare-materials": {
				if (!targetOverride || targetOverride === "tray") {
					this._app.dispatchSimulationEvent({ type: "materials-gathered", target: "tray", value: [...requiredMaterials] });
					this._showFeedback("Materiais organizados na bandeja!");
					handled = true;
				}
				break;
			}
			case "identify-patient": {
				if (!targetOverride || targetOverride === "patient" || targetOverride === "record") {
					this._app.dispatchSimulationEvent({ type: "introduced-self", target: "patient", value: true });
					this._app.dispatchSimulationEvent({ type: "name-confirmed", target: "patient", value: config.patient.name });
					this._app.dispatchSimulationEvent({ type: "birth-date-confirmed", target: "patient", value: config.patient.dateOfBirth });
					this._showFeedback(`Identificação confirmada: ${config.patient.name}`);
					handled = true;
				}
				break;
			}
			case "check-readiness": {
				if (!targetOverride || targetOverride === "patient" || targetOverride === "record") {
					this._app.dispatchSimulationEvent({ type: "bladder-checked", target: "patient", value: "empty" });
					this._app.dispatchSimulationEvent({ type: "exercise-history-checked", target: "patient", value: 90 });
					this._app.dispatchSimulationEvent({ type: "intake-history-checked", target: "patient", value: 30 });
					this._showFeedback("Condições prévias verificadas: bexiga vazia, repouso físico e alimentar ok.");
					handled = true;
				}
				break;
			}
			case "explain-and-rest": {
				if (!targetOverride || targetOverride === "patient") {
					this._app.dispatchSimulationEvent({ type: "procedure-explained", target: "patient", value: true });
					this._app.dispatchSimulationEvent({ type: "silence-instructed", target: "patient", value: true });
					this._app.dispatchSimulationEvent({ type: "questions-addressed", target: "patient", value: true });
					this._app.dispatchSimulationEvent({ type: "quiet-rest-started", target: "patient", value: true });
					this._app.dispatchSimulationEvent({ type: "quiet-rest-finished", target: "patient", value: 300 });
					this._showFeedback("Procedimento explicado e 5 minutos de repouso concluídos!");
					handled = true;
				}
				break;
			}
			case "measure-arm-and-select-cuff": {
				if (!targetOverride || targetOverride === "patient-arm" || targetOverride === "measuring-tape" || targetOverride === "cuffs") {
					const selectedCuffId = eligibleCuffs(config.patient.armCircumferenceCm)[0] ?? "adult";
					this._app.dispatchSimulationEvent({ type: "arm-prepared", target: "patient-arm", value: true });
					this._app.dispatchSimulationEvent({ type: "midpoint-located", target: "patient-arm", value: true });
					this._app.dispatchSimulationEvent({ type: "arm-extended", target: "patient-arm", value: true });
					this._app.dispatchSimulationEvent({ type: "circumference-measured", target: "measuring-tape", value: config.patient.armCircumferenceCm });
					this._app.dispatchSimulationEvent({ type: "cuff-selected", target: "cuffs", value: selectedCuffId });
					this._showFeedback(`Braço medido (${config.patient.armCircumferenceCm} cm). Manguito selecionado!`);
					handled = true;
				}
				break;
			}
			case "position-patient": {
				if (!targetOverride || targetOverride === "patient" || targetOverride === "patient-arm") {
					const actions = ["seated", "legs-uncrossed", "feet-supported", "back-supported", "arm-supported", "palm-up", "elbow-flexed"];
					for (const act of actions) {
						this._app.dispatchSimulationEvent({ type: act, target: "patient", value: true });
					}
					this._showFeedback("Paciente posicionado: dorso apoiado, pés no chão, braço na altura do coração.");
					handled = true;
				}
				break;
			}
			case "align-cuff": {
				if (!targetOverride || targetOverride === "patient-arm" || targetOverride === "cuff") {
					this._app.dispatchSimulationEvent({ type: "brachial-artery-palpated", target: "patient-arm", value: true });
					this._app.dispatchSimulationEvent({ type: "bladder-aligned", target: "cuff", value: true });
					this._showFeedback("Artéria braquial palpada e bolsa centralizada.");
					handled = true;
				}
				break;
			}
			case "fit-cuff": {
				if (!targetOverride || targetOverride === "cuff") {
					this._app.dispatchSimulationEvent({ type: "cuff-fitted", target: "cuff", value: true });
					this._app.dispatchSimulationEvent({ type: "cuff-offset-measured", target: "cuff", value: 2.5 });
					this._showFeedback("Manguito ajustado sem folgas, 2,5 cm acima da fossa cubital.");
					handled = true;
				}
				break;
			}
			case "align-gauge": {
				if (!targetOverride || targetOverride === "gauge") {
					this._app.dispatchSimulationEvent({ type: "eye-level-aligned", target: "gauge", value: true });
					this._showFeedback("Olhos alinhados com o manômetro.");
					handled = true;
				}
				break;
			}
			case "estimate-systolic": {
				if (!targetOverride || targetOverride === "patient-wrist" || targetOverride === "cuff" || targetOverride === "gauge") {
					this._app.dispatchSimulationEvent({ type: "radial-pulse-palpated", target: "patient-wrist", value: true });
					this._app.dispatchSimulationEvent({ type: "pulse-disappeared", target: "cuff", value: config.pressure.systolic });
					this._app.dispatchSimulationEvent({ type: "slow-deflation-performed", target: "cuff", value: true });
					this._app.dispatchSimulationEvent({ type: "pulse-reappearance-recorded", target: "gauge", value: config.pressure.systolic });
					this._app.dispatchSimulationEvent({ type: "estimation-air-released", target: "cuff", value: 0 });
					this._app.dispatchSimulationEvent({ type: "estimation-wait-finished", target: "cuff", value: 60 });
					this._showFeedback(`Pressão sistólica estimada: ${config.pressure.systolic} mmHg. Repouso de 1 min concluído.`);
					handled = true;
				}
				break;
			}
			case "place-earpieces": {
				if (!targetOverride || targetOverride === "stethoscope") {
					this._app.dispatchSimulationEvent({ type: "earpieces-placed", target: "stethoscope", value: true });
					this._showFeedback("Olivas do estetoscópio posicionadas nos ouvidos.");
					handled = true;
				}
				break;
			}
			case "place-bell": {
				if (!targetOverride || targetOverride === "patient-arm" || targetOverride === "stethoscope") {
					this._app.dispatchSimulationEvent({ type: "cubital-artery-palpated", target: "patient-arm", value: true });
					this._app.dispatchSimulationEvent({ type: "chestpiece-placed", target: "stethoscope", value: "bell" });
					this._showFeedback("Campânula/diafragma posicionado levemente sobre a artéria braquial.");
					handled = true;
				}
				break;
			}
			case "inflate-for-auscultation": {
				if (!targetOverride || targetOverride === "cuff" || targetOverride === "bulb") {
					const targetPressure = config.pressure.systolic + 25;
					this._app.dispatchSimulationEvent({ type: "rapid-inflation-increment", target: "cuff", value: targetPressure });
					this._showFeedback(`Insuflado até ${targetPressure} mmHg (20–30 mmHg acima da estimativa).`);
					handled = true;
				}
				break;
			}
			case "start-deflation": {
				if (!targetOverride || targetOverride === "cuff" || targetOverride === "bulb") {
					this._app.dispatchSimulationEvent({ type: "deflation-started", target: "cuff", value: 2 });
					this._showFeedback("Deflação iniciada a 2 mmHg/segundo.");
					handled = true;
				}
				break;
			}
			case "identify-systolic": {
				if (!targetOverride || targetOverride === "gauge" || targetOverride === "stethoscope") {
					this._app.dispatchSimulationEvent({ type: "first-sound-recorded", target: "gauge", value: config.pressure.systolic });
					this._app.dispatchSimulationEvent({ type: "regular-beats-confirmed", target: "stethoscope", value: true });
					this._showFeedback(`Sistólica identificada (Fase I de Korotkoff): ${config.pressure.systolic} mmHg.`);
					handled = true;
				}
				break;
			}
			case "identify-diastolic": {
				if (!targetOverride || targetOverride === "gauge") {
					this._app.dispatchSimulationEvent({ type: "sound-disappearance-recorded", target: "gauge", value: config.pressure.diastolic });
					this._showFeedback(`Diastólica identificada (Fase V - desaparecimento): ${config.pressure.diastolic} mmHg.`);
					handled = true;
				}
				break;
			}
			case "confirm-disappearance": {
				if (!targetOverride || targetOverride === "stethoscope" || targetOverride === "cuff") {
					this._app.dispatchSimulationEvent({ type: "disappearance-confirmed", target: "stethoscope", value: true });
					this._app.dispatchSimulationEvent({ type: "remaining-air-released", target: "cuff", value: 0 });
					this._showFeedback("Desaparecimento confirmado por 20–30 mmHg e ar liberado.");
					handled = true;
				}
				break;
			}
			case "persistent-sounds": {
				if (!targetOverride || targetOverride === "gauge" || targetOverride === "record") {
					const record: MeasurementRecord = {
						systolic: config.pressure.systolic,
						diastolic: config.pressure.diastolic,
						zero: 0,
						dateTime: new Date().toISOString().slice(0, 16),
						arm: config.arm,
						position: "sentado",
						professional: "Enf. Fictício - COREN 123456",
						performed: true,
					};
					this._app.dispatchSimulationEvent({ type: "muffling-recorded", target: "gauge", value: config.pressure.diastolic });
					this._app.dispatchSimulationEvent({ type: "sounds-at-zero-confirmed", target: "stethoscope", value: 0 });
					this._app.dispatchSimulationEvent({ type: "three-values-recorded", target: "record", value: record });
					this._showFeedback("Sons persistentes registrados (sistólica/abafamento/zero).");
					handled = true;
				}
				break;
			}
			case "inform-patient": {
				if (!targetOverride || targetOverride === "patient") {
					const record: MeasurementRecord = {
						systolic: config.pressure.systolic,
						diastolic: config.pressure.diastolic,
						...(config.persistentSounds ? { zero: 0 } : {}),
						dateTime: new Date().toISOString().slice(0, 16),
						arm: config.arm,
						position: "sentado",
						professional: "Enf. Fictício - COREN 123456",
						performed: true,
					};
					this._app.dispatchSimulationEvent({ type: "results-communicated", target: "patient", value: record });
					this._showFeedback(`Valores informados ao paciente: ${config.pressure.systolic}/${config.pressure.diastolic} mmHg.`);
					handled = true;
				}
				break;
			}
			case "remove-cuff": {
				if (!targetOverride || targetOverride === "cuff") {
					this._app.dispatchSimulationEvent({ type: "cuff-removed", target: "cuff", value: true });
					this._showFeedback("Manguito retirado com segurança.");
					handled = true;
				}
				break;
			}
			case "document-measurement": {
				if (!targetOverride || targetOverride === "record") {
					const record: MeasurementRecord = {
						systolic: config.pressure.systolic,
						diastolic: config.pressure.diastolic,
						...(config.persistentSounds ? { zero: 0 } : {}),
						dateTime: new Date().toISOString().slice(0, 16),
						arm: config.arm,
						position: "sentado",
						professional: "Enf. Fictício - COREN 123456",
						performed: true,
					};
					this._app.dispatchSimulationEvent({ type: "measurement-documented", target: "record", value: record });
					this._showFeedback("Medição documentada no prontuário com sucesso! Procedimento concluído!");
					handled = true;
				}
				break;
			}
			default:
				break;
		}

		if (handled) {
			this._playChime();
			this._updateFromCurrentStep();
		}

		return handled;
	}

	private _getStepHint(stepId: string | null): StepHint {
		switch (stepId) {
			case "initial-hand-hygiene":
				return {
					checklistNumber: 1,
					title: "Higienize as mãos",
					instruction: "Higienize as mãos no dispensador de sabão/álcool no balcão.",
					targetName: "Dispensador de Sabão",
					targetPosition: [-0.792, 1.48, -2.391],
					actionLabel: "Higienizar as mãos",
					stationName: "hygiene",
				};
			case "disinfect-stethoscope":
				return {
					checklistNumber: 2,
					title: "Desinfetar estetoscópio",
					instruction: "Desinfete a campânula, diafragma e olivas com algodão e álcool a 70%.",
					targetName: "Estetoscópio na mesa",
					targetPosition: [0.98, 1.05, 0.62],
					actionLabel: "Desinfetar estetoscópio",
				};
			case "prepare-materials":
				return {
					checklistNumber: 3,
					title: "Separar materiais",
					instruction: "Organize todos os materiais necessários na bandeja clínica.",
					targetName: "Bandeja na mesa",
					targetPosition: [1.1, 1.05, 0.65],
					actionLabel: "Separar materiais",
				};
			case "hand-hygiene-before-identification":
				return {
					checklistNumber: 4,
					title: "Higienizar as mãos",
					instruction: "Higienize as mãos novamente antes de tocar o paciente.",
					targetName: "Dispensador de Sabão",
					targetPosition: [-0.792, 1.48, -2.391],
					actionLabel: "Higienizar as mãos",
					stationName: "hygiene",
				};
			case "identify-patient":
				return {
					checklistNumber: 5,
					title: "Identificar o paciente",
					instruction: "Apresente-se e confirme dois identificadores (nome e data de nascimento).",
					targetName: "Paciente / Prontuário",
					targetPosition: [0, 1.55, 0.35],
					actionLabel: "Confirmar identificação",
				};
			case "check-readiness":
				return {
					checklistNumber: 6,
					title: "Condições de preparo",
					instruction: "Verifique bexiga vazia, 90 min sem exercícios e 30 min sem café/fumo/álcool.",
					targetName: "Paciente",
					targetPosition: [0, 1.55, 0.35],
					actionLabel: "Verificar preparo",
				};
			case "explain-and-rest":
				return {
					checklistNumber: 7,
					title: "Repouso e orientações",
					instruction: "Explique o procedimento, oriente silêncio e aguarde 5 minutos de repouso.",
					targetName: "Paciente",
					targetPosition: [0, 1.55, 0.35],
					actionLabel: "Orientar e repousar",
				};
			case "hand-hygiene-before-measurement":
				return {
					checklistNumber: 8,
					title: "Higienizar as mãos",
					instruction: "Higienize as mãos antes de iniciar a medição.",
					targetName: "Dispensador de Sabão",
					targetPosition: [-0.792, 1.48, -2.391],
					actionLabel: "Higienizar as mãos",
					stationName: "hygiene",
				};
			case "measure-arm-and-select-cuff":
				return {
					checklistNumber: 9,
					title: "Medir braço e selecionar manguito",
					instruction: "Posicione o braço, localize o ponto médio, meça a circunferência e escolha o manguito.",
					targetName: "Braço do paciente",
					targetPosition: [0.36, 1.25, 0.25],
					actionLabel: "Medir e selecionar manguito",
					stationName: "esquerdo",
				};
			case "position-patient":
				return {
					checklistNumber: 10,
					title: "Posicionar paciente",
					instruction: "Confirme pés no chão, dorso apoiado, pernas descruzadas e braço na altura do coração.",
					targetName: "Paciente",
					targetPosition: [0, 1.55, 0.35],
					actionLabel: "Ajustar posicionamento",
				};
			case "align-cuff":
				return {
					checklistNumber: 11,
					title: "Alinhar o manguito",
					instruction: "Palpe a artéria braquial e centralize o meio da bolsa sobre a artéria.",
					targetName: "Braço do paciente",
					targetPosition: [0.36, 1.25, 0.25],
					actionLabel: "Alinhar bolsa inflável",
					stationName: "esquerdo",
				};
			case "fit-cuff":
				return {
					checklistNumber: 12,
					title: "Ajustar o manguito",
					instruction: "Coloque o manguito sem folgas, 2 a 3 cm acima da fossa cubital.",
					targetName: "Manguito no braço",
					targetPosition: [0.36, 1.25, 0.25],
					actionLabel: "Ajustar manguito",
					stationName: "esquerdo",
				};
			case "align-gauge":
				return {
					checklistNumber: 13,
					title: "Alinhar manômetro",
					instruction: "Posicione os olhos no mesmo nível do mostrador do manômetro.",
					targetName: "Manômetro",
					targetPosition: [0.78, 1.50, 0.44],
					actionLabel: "Alinhar com manômetro",
				};
			case "estimate-systolic":
				return {
					checklistNumber: 14,
					title: "Estimar sistólica (palpação)",
					instruction: "Palpe o pulso radial, infle até sumir, desinfle lentamente e anote o retorno.",
					targetName: "Pulso radial",
					targetPosition: [0.36, 1.10, 0.08],
					actionLabel: "Estimar sistólica",
					stationName: "esquerdo",
				};
			case "place-earpieces":
				return {
					checklistNumber: 15,
					title: "Colocar estetoscópio",
					instruction: "Coloque as olivas do estetoscópio voltadas para a frente nos ouvidos.",
					targetName: "Estetoscópio",
					targetPosition: [0.98, 1.05, 0.62],
					actionLabel: "Colocar olivas nos ouvidos",
				};
			case "place-bell":
				return {
					checklistNumber: 16,
					title: "Posicionar campânula/diafragma",
					instruction: "Palpe a artéria na fossa cubital e coloque a campânula levemente sobre ela.",
					targetName: "Fossa cubital",
					targetPosition: [0.36, 1.20, 0.22],
					actionLabel: "Posicionar campânula",
					stationName: "esquerdo",
				};
			case "inflate-for-auscultation":
				return {
					checklistNumber: 17,
					title: "Insuflar para ausculta",
					instruction: "Infle rapidamente em passos de 10 mmHg até 20–30 mmHg acima da estimativa.",
					targetName: "Pera do manguito",
					targetPosition: [0.36, 1.15, 0.25],
					actionLabel: "Insuflar manguito",
				};
			case "start-deflation":
				return {
					checklistNumber: 18,
					title: "Iniciar deflação",
					instruction: "Abra a válvula para esvaziar a uma velocidade constante de 2 mmHg/s.",
					targetName: "Válvula da pera",
					targetPosition: [0.36, 1.15, 0.25],
					actionLabel: "Iniciar deflação a 2 mmHg/s",
				};
			case "identify-systolic":
				return {
					checklistNumber: 19,
					title: "Identificar sistólica",
					instruction: "Registre o primeiro som claro de Korotkoff (fase I) com batidas regulares.",
					targetName: "Manômetro",
					targetPosition: [0.78, 1.50, 0.44],
					actionLabel: "Registrar sistólica",
				};
			case "identify-diastolic":
				return {
					checklistNumber: 20,
					title: "Identificar diastólica",
					instruction: "Registre o desaparecimento total dos sons auscultados (fase V).",
					targetName: "Manômetro",
					targetPosition: [0.78, 1.50, 0.44],
					actionLabel: "Registrar diastólica",
				};
			case "confirm-disappearance":
				return {
					checklistNumber: 21,
					title: "Confirmar desaparecimento",
					instruction: "Continue auscultando por mais 20–30 mmHg e libere todo o ar restante.",
					targetName: "Válvula / Estetoscópio",
					targetPosition: [0.78, 1.50, 0.44],
					actionLabel: "Confirmar e esvaziar",
				};
			case "persistent-sounds":
				return {
					checklistNumber: 22,
					title: "Sons persistentes (ramo)",
					instruction: "Caso os sons continuem até zero, registre sistólica, abafamento e zero.",
					targetName: "Prontuário",
					targetPosition: [0.072, 1.05, -1.824],
					actionLabel: "Registrar 3 valores",
					stationName: "prontuario",
				};
			case "inform-patient":
				return {
					checklistNumber: 23,
					title: "Informar o paciente",
					instruction: "Comunique com clareza os valores obtidos da pressão arterial ao paciente.",
					targetName: "Paciente",
					targetPosition: [0, 1.55, 0.35],
					actionLabel: "Informar valores",
				};
			case "remove-cuff":
				return {
					checklistNumber: 24,
					title: "Retirar o manguito",
					instruction: "Desinfle totalmente e remova o manguito do braço do paciente.",
					targetName: "Manguito",
					targetPosition: [0.36, 1.25, 0.25],
					actionLabel: "Remover manguito",
					stationName: "esquerdo",
				};
			case "final-hand-hygiene":
				return {
					checklistNumber: 25,
					title: "Higienizar as mãos",
					instruction: "Higienize as mãos após concluir a medição e os cuidados ao paciente.",
					targetName: "Dispensador de Sabão",
					targetPosition: [-0.792, 1.48, -2.391],
					actionLabel: "Higienizar as mãos",
					stationName: "hygiene",
				};
			case "document-measurement":
				return {
					checklistNumber: 26,
					title: "Registrar no prontuário",
					instruction: "Registre no prontuário: data, hora, braço, posição, valores exatos e assinatura.",
					targetName: "Prontuário no balcão",
					targetPosition: [0.072, 1.05, -1.824],
					actionLabel: "Registrar medição no prontuário",
					stationName: "prontuario",
				};
			default:
				return {
					checklistNumber: 26,
					title: "Procedimento concluído",
					instruction: "Parabéns! Todas as etapas da medição de pressão arterial foram concluídas.",
					targetName: "Prontuário",
					targetPosition: [0.072, 1.05, -1.824],
					actionLabel: "Procedimento concluído",
					stationName: "prontuario",
				};
		}
	}

	private _initGuidanceHUD(): void {
		const existing = document.getElementById("step-guidance-hud");
		if (existing) existing.remove();

		const card = document.createElement("section");
		card.id = "step-guidance-hud";
		card.className = "step-guidance-hud";
		card.setAttribute("aria-label", "Instruções do passo atual");
		card.innerHTML = `
			<div class="guidance-header">
				<span class="step-counter-badge" id="hud-step-badge">Passo 1 de 26</span>
				<span class="step-target-badge" id="hud-target-badge">🎯 Dispensador de Sabão</span>
			</div>
			<h3 class="step-headline" id="hud-step-title">Higienize as mãos</h3>
			<p class="step-detail" id="hud-step-instruction">Higienize as mãos no dispensador de sabão/álcool no balcão.</p>
			<div class="step-actions-row">
				<button id="hud-action-button" class="button primary step-action-button" type="button">
					<span id="hud-action-label">Higienizar as mãos</span>
					<span aria-hidden="true">✓</span>
				</button>
				<button id="hud-goto-station-button" class="button secondary" type="button" title="Ir até o local">
					📍 Ir até alvo
				</button>
			</div>
			<div class="step-progress-container">
				<div class="step-progress-track">
					<div class="step-progress-fill" id="hud-progress-fill" style="width: 3.8%;"></div>
				</div>
			</div>
			<div class="step-toast-feedback" id="hud-toast" hidden></div>
		`;

		document.body.appendChild(card);
		this._guidanceCard = card;

		const actionBtn = card.querySelector("#hud-action-button") as HTMLButtonElement;
		actionBtn?.addEventListener("click", () => {
			this.executeActiveStepAction();
		});

		const gotoBtn = card.querySelector("#hud-goto-station-button") as HTMLButtonElement;
		gotoBtn?.addEventListener("click", () => {
			const snapshot = this._app.getSimulationSnapshot();
			const hint = this._getStepHint(snapshot?.currentStepId ?? null);
			if (hint.stationName) {
				this._app.moveToStation(hint.stationName);
			}
		});
	}

	private _updateFromCurrentStep(): void {
		const snapshot = this._app.getSimulationSnapshot();
		const stepId = snapshot?.currentStepId ?? "initial-hand-hygiene";
		const hint = this._getStepHint(stepId);

		this._targetLerpPosition.set(...hint.targetPosition);

		if (this._guidanceCard) {
			const badge = this._guidanceCard.querySelector("#hud-step-badge");
			const targetBadge = this._guidanceCard.querySelector("#hud-target-badge");
			const title = this._guidanceCard.querySelector("#hud-step-title");
			const instruction = this._guidanceCard.querySelector("#hud-step-instruction");
			const actionLabel = this._guidanceCard.querySelector("#hud-action-label");
			const progressFill = this._guidanceCard.querySelector("#hud-progress-fill") as HTMLElement;

			if (badge) badge.textContent = `Passo ${hint.checklistNumber} de 26`;
			if (targetBadge) targetBadge.textContent = `🎯 ${hint.targetName}`;
			if (title) title.textContent = hint.title;
			if (instruction) instruction.textContent = hint.instruction;
			if (actionLabel) actionLabel.textContent = hint.actionLabel;

			const percent = Math.min(100, Math.round((hint.checklistNumber / 26) * 100));
			if (progressFill) progressFill.style.width = `${percent}%`;
		}
	}

	private _showFeedback(message: string): void {
		if (!this._guidanceCard) return;
		const toast = this._guidanceCard.querySelector("#hud-toast") as HTMLElement;
		if (!toast) return;
		toast.textContent = `✓ ${message}`;
		toast.hidden = false;
		toast.classList.remove("toast-fade-out");
		setTimeout(() => {
			toast.hidden = true;
		}, 3200);
	}

	private _playChime(): void {
		try {
			const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!AudioContextClass) return;
			if (!this._audioCtx) this._audioCtx = new AudioContextClass();
			if (this._audioCtx.state === "suspended") void this._audioCtx.resume();

			const ctx = this._audioCtx;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(ctx.destination);

			// Pleasant medical confirmation double-tone (E5 -> A5)
			osc.frequency.setValueAtTime(659.25, ctx.currentTime);
			osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
			gain.gain.setValueAtTime(0.08, ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

			osc.start(ctx.currentTime);
			osc.stop(ctx.currentTime + 0.28);
		} catch {
			// audio context blocked or unsupported
		}
	}

	public dispose(): void {
		this._disposed = true;
		this._guidanceCard?.remove();
		this._guidanceCard = null;
		this._arrowRoot?.dispose();
		this._arrowRoot = null;
		this._audioCtx?.close().catch(() => {});
		this._audioCtx = null;
	}
}
