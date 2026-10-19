import { auscultatoryScenario, defaultConfig } from "./auscultatoryScenario.js";
import { clinicalParameters as parameters, eligibleCuffs, requiredMaterials } from "./clinicalParameters.js";
import type { ActionDefinition, CommunicationRecord, CommunicationTiming, InteractionEvent, MeasurementRecord, ScenarioConfig, SessionState } from "./types.js";

export const CONVERSATION_STEP_IDS = [
	"identify-patient",
	"check-readiness",
	"explain-and-rest",
	"inform-patient",
];

export const PRE_ESTABLISHED_STEP_IDS = [
	"measure-arm-and-select-cuff",
	"position-patient",
	"align-cuff",
	"fit-cuff",
];

export class SimulationController {
	private _state!: SessionState;
	private _initialConfig: ScenarioConfig;
	private _clock: () => number;
	private _decoupledFlow: boolean;
	private _deflationStartedAt: number | null = null;
	private _deflationPausedAt: number | null = null;
	private _deflationStartingPressure = 0;

	public constructor(config: ScenarioConfig = defaultConfig, clock: () => number = () => performance.now(), decoupledFlow = false) {
		if (!Number.isFinite(config.pressure.systolic) || !Number.isFinite(config.pressure.diastolic)
			|| config.pressure.systolic <= config.pressure.diastolic || config.pressure.diastolic < parameters.confirmation.minDrop
			|| eligibleCuffs(config.patient.armCircumferenceCm).length === 0 || !config.patient.name.trim() || !config.patient.dateOfBirth.trim()) {
			throw new Error("Configuração do cenário inválida ou fora das faixas suportadas.");
		}
		this._initialConfig = structuredClone(config);
		this._clock = clock;
		this._decoupledFlow = decoupledFlow;
		this.restart();
	}

	public restart(): void {
		this._deflationStartedAt = null;
		this._deflationPausedAt = null;
		this._deflationStartingPressure = 0;
		this._state = {
			config: structuredClone(this._initialConfig), currentStepId: auscultatoryScenario[0].id,
			actionIndex: 0, steps: Object.fromEntries(auscultatoryScenario.map((step, index) => [step.id, { status: index === 0 ? "active" : "pending" }])),
			observations: {}, instruments: { cuffPressure: 0, cuffAttached: false, selectedCuff: null },
			timerStartedAt: null, attempts: [], completed: false,
			communicationRecords: {
				"identify-patient": {
					stepId: "identify-patient",
					title: "Identificação do paciente (Passo 5)",
					status: "omitted",
					timing: "omitted",
					physicalStepAtExecution: null,
					feedback: "Identificação do paciente não foi realizada (risco de erro de paciente).",
				},
				"check-readiness": {
					stepId: "check-readiness",
					title: "Condições de preparo / Anamnese (Passo 6)",
					status: "omitted",
					timing: "omitted",
					physicalStepAtExecution: null,
					feedback: "Condições prévias de preparo (bexiga vazia, repouso físico e ingestão) não foram checadas.",
				},
				"explain-and-rest": {
					stepId: "explain-and-rest",
					title: "Orientações e repouso de 5 min (Passo 7)",
					status: "omitted",
					timing: "omitted",
					physicalStepAtExecution: null,
					feedback: "Orientações do procedimento e repouso de 5 minutos não foram cumpridos antes da medição.",
				},
				"inform-patient": {
					stepId: "inform-patient",
					title: "Comunicação de resultados (Passo 23)",
					status: "omitted",
					timing: "omitted",
					physicalStepAtExecution: null,
					feedback: "Valores pressóricos aferidos não foram comunicados ao paciente.",
				},
			},
		};
	}

	public getSnapshot(): SessionState { return structuredClone(this._state); }
	public getCuffPressure(): number { return this._state.instruments.cuffPressure; }
	public isDeflationActive(): boolean { return this._deflationStartedAt !== null; }
	public isDeflationPaused(): boolean { return this._deflationPausedAt !== null; }

	public toggleDeflationPause(now = this._clock()): boolean {
		if (this._deflationStartedAt === null) return false;
		if (this._deflationPausedAt === null) {
			this.advancePressure(now);
			this._deflationPausedAt = now;
		} else {
			this._deflationStartedAt += now - this._deflationPausedAt;
			this._deflationPausedAt = null;
		}
		return true;
	}

	public advancePressure(now = this._clock()): boolean {
		if (this._deflationStartedAt === null || this._deflationPausedAt !== null) return false;
		const nextPressure = Math.max(0, this._deflationStartingPressure - ((now - this._deflationStartedAt) / 1000) * parameters.deflation.mmHgPerSecond);
		if (Math.abs(nextPressure - this._state.instruments.cuffPressure) < 0.05) return false;
		this._state.instruments.cuffPressure = nextPressure;
		return true;
	}

	public isDecoupledFlow(): boolean { return this._decoupledFlow; }

	public getCurrentAction(): ActionDefinition | null {
		const step = auscultatoryScenario.find(item => item.id === this._state.currentStepId);
		return step ? structuredClone(step.completionConditions[this._state.actionIndex]) : null;
	}

	public dispatch(event: InteractionEvent): { accepted: boolean; feedback: string } {
		const now = this._clock();
		this.advancePressure(now);
		const state = this._state;
		const step = auscultatoryScenario.find(item => item.id === state.currentStepId);
		const action = this.getCurrentAction();
		const prerequisitesMet = step?.prerequisites.every(id => {
			if (this._decoupledFlow && CONVERSATION_STEP_IDS.includes(id)) {
				return true;
			}
			return ["completed", "skipped"].includes(state.steps[id].status);
		});
		const extraInflation = step?.id === "inflate-for-auscultation" && action?.rule === "inflate-stop"
			&& event.type === "rapid-inflation-increment" && event.target === "cuff";
		const accepted = !!action && !!prerequisitesMet && (
			(event.type === action.type && event.target === action.target && this._validate(action, event, now))
			|| (extraInflation && this._validate({ ...action, type: "rapid-inflation-increment", rule: "inflate" }, event, now))
		);
		const feedback = accepted ? "Ação realizada corretamente." : action?.feedback ?? "A simulação já foi concluída. Reinicie para tentar novamente.";
		state.attempts.push({ timestamp: now, stepId: state.currentStepId, event: structuredClone(event), accepted, feedback });
		if (!accepted || !step || !action) return { accepted, feedback };

    // Assign the event value to the observations
		state.observations[`${step.id}:${event.type}`] = structuredClone(event.value ?? true);
		if (action.rule === "start-timer" || action.rule === "release-start-timer") state.timerStartedAt = now;
		if (action.rule === "rest" || action.rule === "estimation-wait") state.timerStartedAt = null;
		if (action.rule === "cuff") state.instruments.selectedCuff = event.value as string;
		if (event.type === "cuff-fitted") state.instruments.cuffAttached = true;
		if (event.type === "cuff-removed") state.instruments.cuffAttached = false;
		if (action.rule === "inflate" || extraInflation || ["pulse-disappearance", "release-start-timer"].includes(action.rule)
			|| event.type === "remaining-air-released" || event.type === "sounds-at-zero-confirmed") state.instruments.cuffPressure = event.value as number;
		if (event.type === "deflation-started") {
			this._deflationStartedAt = now;
			this._deflationPausedAt = null;
			this._deflationStartingPressure = state.instruments.cuffPressure;
		}
		if (event.type === "remaining-air-released" || event.type === "sounds-at-zero-confirmed" || action.rule === "release-start-timer") {
			this._deflationStartedAt = null;
			this._deflationPausedAt = null;
			this._deflationStartingPressure = 0;
		}
		if (action.rule === "inflate") {
			if (state.instruments.cuffPressure < this._estimate() + parameters.inflation.minAboveEstimate) return { accepted, feedback };
			state.actionIndex++;
			return { accepted, feedback };
		}
		if (extraInflation) return { accepted, feedback };
		state.actionIndex++;
		if (state.actionIndex === step.completionConditions.length) this._completeStep(step.checklistNumber);
		return { accepted, feedback };
	}

	public dispatchLateralDialogue(topicId: "identify-patient" | "check-readiness" | "explain-and-rest" | "inform-patient"): { accepted: boolean; feedback: string; dialogueText: string } {
		const state = this._state;
		const config = state.config;
		const currentPhysicalStep = state.currentStepId;

		if (topicId === "identify-patient") {
			state.observations["identify-patient:introduced-self"] = true;
			state.observations["identify-patient:name-confirmed"] = config.patient.name;
			state.observations["identify-patient:birth-date-confirmed"] = config.patient.dateOfBirth;
			state.steps["identify-patient"].status = "completed";

			const isIdeal = ["initial-hand-hygiene", "disinfect-stethoscope", "prepare-materials", "hand-hygiene-before-identification", "hand-hygiene-before-measurement"].includes(currentPhysicalStep ?? "");
			const timing: CommunicationTiming = isIdeal ? "ideal" : "late";
			const feedback = isIdeal
				? "Identificação confirmada no momento ideal (antes dos procedimentos no paciente)."
				: "Identificação realizada tardiamente (após início dos procedimentos).";

			if (state.communicationRecords) {
				state.communicationRecords["identify-patient"] = {
					stepId: "identify-patient",
					title: "Identificação do paciente (Passo 5)",
					status: "completed",
					timing,
					physicalStepAtExecution: currentPhysicalStep,
					feedback,
				};
			}

			const dialogueText = `Olá enfermeiro(a), meu nome é ${config.patient.name} e nasci em ${config.patient.dateOfBirth}.`;
			return { accepted: true, feedback, dialogueText };
		}

		if (topicId === "check-readiness") {
			state.observations["check-readiness:bladder-checked"] = "empty";
			state.observations["check-readiness:exercise-history-checked"] = 90;
			state.observations["check-readiness:intake-history-checked"] = 30;
			state.steps["check-readiness"].status = "completed";

			const measurementSteps = [
				"estimate-systolic", "place-earpieces", "place-bell", "inflate-for-auscultation",
				"start-deflation", "identify-systolic", "identify-diastolic", "confirm-disappearance",
				"persistent-sounds", "inform-patient", "remove-cuff", "final-hand-hygiene", "document-measurement",
			];
			const isIdeal = !measurementSteps.includes(currentPhysicalStep ?? "");
			const timing: CommunicationTiming = isIdeal ? "ideal" : "late";
			const feedback = isIdeal
				? "Condições de preparo (bexiga, exercício ≥90 min, ingestão ≥30 min) checadas no momento ideal."
				: "Condições de preparo checadas tardiamente (após iniciar medição).";

			if (state.communicationRecords) {
				state.communicationRecords["check-readiness"] = {
					stepId: "check-readiness",
					title: "Condições de preparo / Anamnese (Passo 6)",
					status: "completed",
					timing,
					physicalStepAtExecution: currentPhysicalStep,
					feedback,
				};
			}

			const dialogueText = "Minha bexiga está vazia, não pratiquei exercícios nas últimas 2 horas e não consumi café, álcool ou tabaco recentemente.";
			return { accepted: true, feedback, dialogueText };
		}

		if (topicId === "explain-and-rest") {
			state.observations["explain-and-rest:procedure-explained"] = true;
			state.observations["explain-and-rest:silence-instructed"] = true;
			state.observations["explain-and-rest:questions-addressed"] = true;
			state.observations["explain-and-rest:quiet-rest-started"] = true;
			state.observations["explain-and-rest:quiet-rest-finished"] = true;
			state.steps["explain-and-rest"].status = "completed";

			const measurementSteps = [
				"estimate-systolic", "place-earpieces", "place-bell", "inflate-for-auscultation",
				"start-deflation", "identify-systolic", "identify-diastolic", "confirm-disappearance",
				"persistent-sounds", "inform-patient", "remove-cuff", "final-hand-hygiene", "document-measurement",
			];
			const isIdeal = !measurementSteps.includes(currentPhysicalStep ?? "");
			const timing: CommunicationTiming = isIdeal ? "ideal" : "late";
			const feedback = isIdeal
				? "Orientações explicadas e repouso de 5 minutos cumprido antes da medição."
				: "Orientações e repouso realizados tardiamente (após início da medição).";

			if (state.communicationRecords) {
				state.communicationRecords["explain-and-rest"] = {
					stepId: "explain-and-rest",
					title: "Orientações e repouso de 5 min (Passo 7)",
					status: "completed",
					timing,
					physicalStepAtExecution: currentPhysicalStep,
					feedback,
				};
			}

			const dialogueText = "Entendido! Manterei repouso calmo e ficarei em silêncio durante todo o exame.";
			return { accepted: true, feedback, dialogueText };
		}

		if (topicId === "inform-patient") {
			state.observations["inform-patient:results-communicated"] = true;
			state.steps["inform-patient"].status = "completed";

			const auscultationDone = state.steps["confirm-disappearance"].status === "completed"
				|| state.steps["persistent-sounds"].status === "completed";
			const timing: CommunicationTiming = auscultationDone ? "ideal" : "early";
			const feedback = auscultationDone
				? "Valores informados no momento ideal (após a conclusão da ausculta)."
				: "Valores informados precocemente (antes do término da ausculta).";

			if (state.communicationRecords) {
				state.communicationRecords["inform-patient"] = {
					stepId: "inform-patient",
					title: "Comunicação de resultados (Passo 23)",
					status: "completed",
					timing,
					physicalStepAtExecution: currentPhysicalStep,
					feedback,
				};
			}

			const systolic = Number(state.observations["identify-systolic:first-sound-recorded"] ?? config.pressure.systolic);
			const diastolicKey = config.persistentSounds ? "persistent-sounds:muffling-recorded" : "identify-diastolic:sound-disappearance-recorded";
			const diastolic = Number(state.observations[diastolicKey] ?? config.pressure.diastolic);
			const zeroPart = config.persistentSounds ? " (sons persistentes até zero)" : "";
			const dialogueText = `Muito obrigado por me informar minha pressão (${systolic}/${diastolic} mmHg${zeroPart}) e pelas orientações!`;
			return { accepted: true, feedback, dialogueText };
		}

		return { accepted: false, feedback: "Tópico de diálogo desconhecido.", dialogueText: "" };
	}

	public getCommunicationEvaluation(): CommunicationRecord[] {
		if (!this._state.communicationRecords) return [];
		return Object.values(this._state.communicationRecords);
	}

	public applyPreEstablishedSetup(): void {
		this._applyPreEstablishedSetup();
	}

	private _estimate(): number {
		return this._state.observations["estimate-systolic:pulse-reappearance-recorded"] as number;
	}

	private _validate(action: ActionDefinition, event: InteractionEvent, now: number): boolean {
		const value = event.value;
		const { config, instruments, timerStartedAt } = this._state;
		const numeric = typeof value === "number" && Number.isFinite(value);
		const elapsed = timerStartedAt === null ? -1 : now - timerStartedAt;
		switch (action.rule) {
			case "equals": return value === action.expected;
			case "materials": return Array.isArray(value) && requiredMaterials.every(material => value.includes(material));
			case "patient-name": return value === config.patient.name;
			case "patient-birth": return value === config.patient.dateOfBirth;
			case "exercise": return numeric && value >= parameters.readiness.exerciseMinutes;
			case "intake": return numeric && value >= parameters.readiness.intakeMinutes;
			case "start-timer": return value === true;
			case "rest": return value === true && elapsed >= parameters.rest.milliseconds;
			case "circumference": return value === config.patient.armCircumferenceCm;
			case "cuff": return typeof value === "string" && eligibleCuffs(config.patient.armCircumferenceCm).includes(value);
			case "offset": return numeric && value >= parameters.cuffOffset.minCm && value <= parameters.cuffOffset.maxCm;
			case "pulse-disappearance": return numeric && value >= config.pressure.systolic;
			case "systolic": return numeric && Math.abs(value - config.pressure.systolic) <= 2;
			case "diastolic": return numeric && Math.abs(value - config.pressure.diastolic) <= 2;
			case "release-start-timer": return value === 0;
			case "estimation-wait": return value === true && elapsed >= parameters.estimationWait.minMs;
			case "chestpiece": return value === "bell" || value === "diaphragm";
			case "inflate": return numeric && value === instruments.cuffPressure + parameters.inflation.increment && value <= this._estimate() + parameters.inflation.maxAboveEstimate;
			case "inflate-stop": return value === true
				&& instruments.cuffPressure >= this._estimate() + parameters.inflation.minAboveEstimate
				&& instruments.cuffPressure <= this._estimate() + parameters.inflation.maxAboveEstimate;
			case "muffling": return numeric && Math.abs(value - config.pressure.diastolic) <= 2;
			case "deflation": return value === parameters.deflation.mmHgPerSecond;
			case "confirmation": return numeric && config.pressure.diastolic - value >= parameters.confirmation.minDrop && config.pressure.diastolic - value <= parameters.confirmation.maxDrop;
			case "readings": return this._validReadings(value);
			case "documentation": {
				if (!this._validReadings(value)) return false;
				const record = value as MeasurementRecord;
				return record.performed === true && record.arm === config.arm && record.position === "sentado"
					&& typeof record.dateTime === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(record.dateTime) && Number.isFinite(Date.parse(record.dateTime))
					&& typeof record.professional === "string" && record.professional.trim().length > 0;
			}
			default: {
					const unhandled: never = action;
					throw new Error(`Condição desconhecida: ${JSON.stringify(unhandled)}`);
				}
		}
	}

	private _validReadings(value: unknown): boolean {
		if (!value || typeof value !== "object") return false;
		const record = value as MeasurementRecord;
		const { pressure, persistentSounds } = this._state.config;
		const systolic = Number(this._state.observations["identify-systolic:first-sound-recorded"] ?? pressure.systolic);
		const diastolicKey = persistentSounds ? "persistent-sounds:muffling-recorded" : "identify-diastolic:sound-disappearance-recorded";
		const diastolic = Number(this._state.observations[diastolicKey] ?? pressure.diastolic);
		return record.systolic === systolic && record.diastolic === diastolic
			&& (persistentSounds ? record.zero === 0 : record.zero === undefined);
	}

	private _completeStep(number: number): void {
		const state = this._state;
		state.steps[auscultatoryScenario[number - 1].id].status = "completed";
		let nextIndex = number;

		if (this._decoupledFlow) {
			if (number === 4) {
				// From step 4 (hand-hygiene-before-identification), advance directly to step 8 (hand-hygiene-before-measurement)
				nextIndex = 7;
			} else if (number === 8) {
				// From step 8 (hand-hygiene-before-measurement), pre-established setup satisfies steps 9-12
				this._applyPreEstablishedSetup();
				nextIndex = 12; // step 13 (align-gauge)
			} else if (number === 19 && state.config.persistentSounds) {
				for (const index of [19, 20]) state.steps[auscultatoryScenario[index].id] = { status: "skipped", reason: "Os sons persistem até zero; utilizar o abafamento e registrar três valores." };
				nextIndex = 21; // step 22 (persistent-sounds)
			} else if (number === 21) {
				state.steps[auscultatoryScenario[21].id] = { status: "skipped", reason: "Os sons desapareceram antes de zero." };
				nextIndex = 23; // step 24 (remove-cuff)
			} else if (number === 22) {
				nextIndex = 23; // step 24 (remove-cuff)
			}
		} else {
			if (number === 19 && state.config.persistentSounds) {
				for (const index of [19, 20]) state.steps[auscultatoryScenario[index].id] = { status: "skipped", reason: "Os sons persistem até zero; utilizar o abafamento e registrar três valores." };
				nextIndex = 21;
			} else if (number === 21) {
				state.steps[auscultatoryScenario[21].id] = { status: "skipped", reason: "Os sons desapareceram antes de zero." };
				nextIndex = 22;
			}
		}

		state.actionIndex = 0;
		state.currentStepId = auscultatoryScenario[nextIndex]?.id ?? null;
		state.completed = state.currentStepId === null;
		if (state.currentStepId) state.steps[state.currentStepId].status = "active";
	}

	private _applyPreEstablishedSetup(): void {
		const state = this._state;
		state.steps["measure-arm-and-select-cuff"].status = "completed";
		state.steps["position-patient"].status = "completed";
		state.steps["align-cuff"].status = "completed";
		state.steps["fit-cuff"].status = "completed";

		const cuff = eligibleCuffs(state.config.patient.armCircumferenceCm)[0] ?? "adult";
		state.instruments.selectedCuff = cuff;
		state.instruments.cuffAttached = true;

		state.observations["measure-arm-and-select-cuff:circumference-measured"] = state.config.patient.armCircumferenceCm;
		state.observations["measure-arm-and-select-cuff:cuff-selected"] = cuff;
		state.observations["position-patient:seated"] = true;
		state.observations["align-cuff:bladder-aligned"] = true;
		state.observations["fit-cuff:cuff-fitted"] = true;
		state.observations["fit-cuff:cuff-offset-measured"] = 2.5;
	}
}
