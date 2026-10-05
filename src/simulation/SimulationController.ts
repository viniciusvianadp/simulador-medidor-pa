import { auscultatoryScenario, defaultConfig } from "./auscultatoryScenario.js";
import { clinicalParameters as parameters, eligibleCuffs, requiredMaterials } from "./clinicalParameters.js";
import type { ActionDefinition, InteractionEvent, MeasurementRecord, ScenarioConfig, SessionState } from "./types.js";

export class SimulationController {
	private _state!: SessionState;
	private _initialConfig: ScenarioConfig;
	private _clock: () => number;

	public constructor(config: ScenarioConfig = defaultConfig, clock: () => number = () => performance.now()) {
		if (!Number.isFinite(config.pressure.systolic) || !Number.isFinite(config.pressure.diastolic)
			|| config.pressure.systolic <= config.pressure.diastolic || config.pressure.diastolic < parameters.confirmation.minDrop
			|| eligibleCuffs(config.patient.armCircumferenceCm).length === 0 || !config.patient.name.trim() || !config.patient.dateOfBirth.trim()) {
			throw new Error("Configuração do cenário inválida ou fora das faixas suportadas.");
		}
		this._initialConfig = structuredClone(config);
		this._clock = clock;
		this.restart();
	}

	public restart(): void {
		this._state = {
			config: structuredClone(this._initialConfig), currentStepId: auscultatoryScenario[0].id,
			actionIndex: 0, steps: Object.fromEntries(auscultatoryScenario.map((step, index) => [step.id, { status: index === 0 ? "active" : "pending" }])),
			observations: {}, instruments: { cuffPressure: 0, cuffAttached: false, selectedCuff: null },
			timerStartedAt: null, attempts: [], completed: false,
		};
	}

	public getSnapshot(): SessionState { return structuredClone(this._state); }

	public getCurrentAction(): ActionDefinition | null {
		const step = auscultatoryScenario.find(item => item.id === this._state.currentStepId);
		return step ? structuredClone(step.completionConditions[this._state.actionIndex]) : null;
	}

	public dispatch(event: InteractionEvent): { accepted: boolean; feedback: string } {
		const state = this._state;
		const step = auscultatoryScenario.find(item => item.id === state.currentStepId);
		const action = this.getCurrentAction();
		const now = this._clock();
		const prerequisitesMet = step?.prerequisites.every(id => ["completed", "skipped"].includes(state.steps[id].status));
		const accepted = !!action && !!prerequisitesMet && event.type === action.type && event.target === action.target && this._validate(action, event, now);
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
		if (["inflate", "pulse-disappearance", "systolic", "diastolic", "confirmation", "release-start-timer"].includes(action.rule)
			|| event.type === "remaining-air-released" || event.type === "sounds-at-zero-confirmed") state.instruments.cuffPressure = event.value as number;
		// Each increment is validated, but the inflation objective remains active until the target is reached.
		if (action.rule === "inflate" && state.instruments.cuffPressure < this._estimate() + parameters.inflation.minAboveEstimate) return { accepted, feedback };
		state.actionIndex++;
		if (state.actionIndex === step.completionConditions.length) this._completeStep(step.checklistNumber);
		return { accepted, feedback };
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
			case "systolic": return value === config.pressure.systolic;
			case "diastolic": return value === config.pressure.diastolic;
			case "release-start-timer": return value === 0;
			case "estimation-wait": return value === true && elapsed >= parameters.estimationWait.minMs;
			case "chestpiece": return value === "bell" || value === "diaphragm";
			case "inflate": return numeric && value === instruments.cuffPressure + parameters.inflation.increment && value <= this._estimate() + parameters.inflation.maxAboveEstimate;
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
		return record.systolic === pressure.systolic && record.diastolic === pressure.diastolic
			&& (persistentSounds ? record.zero === 0 : record.zero === undefined);
	}

	private _completeStep(number: number): void {
		const state = this._state;
		state.steps[auscultatoryScenario[number - 1].id].status = "completed";
		let nextIndex = number;
		if (number === 19 && state.config.persistentSounds) {
			for (const index of [19, 20]) state.steps[auscultatoryScenario[index].id] = { status: "skipped", reason: "Os sons persistem até zero; utilizar o abafamento e registrar três valores." };
			nextIndex = 21;
		} else if (number === 21) {
			state.steps[auscultatoryScenario[21].id] = { status: "skipped", reason: "Os sons desapareceram antes de zero." };
			nextIndex = 22;
		}
		state.actionIndex = 0;
		state.currentStepId = auscultatoryScenario[nextIndex]?.id ?? null;
		state.completed = state.currentStepId === null;
		if (state.currentStepId) state.steps[state.currentStepId].status = "active";
	}
}
