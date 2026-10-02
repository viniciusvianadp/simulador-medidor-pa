import { SimulationController } from "./SimulationController.js";
import { defaultConfig } from "./auscultatoryScenario.js";
import { clinicalParameters as parameters, eligibleCuffs, requiredMaterials } from "./clinicalParameters.js";
import type { ActionValue, InteractionEvent, MeasurementRecord, ScenarioConfig } from "./types.js";

export class MockClock {
	public label = "Tempo simulado";
	private _now = 0;
	public now = (): number => this._now;
	public advance(milliseconds: number): void {
		if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error("Intervalo de tempo inválido.");
		this._now += milliseconds;
	}
}

// Deliberately privileged fixture: expected values are never supplied by the future learner UI.
export function nextMockEvent(controller: SimulationController, clock: MockClock): InteractionEvent {
	const action = controller.getCurrentAction();
	if (!action) throw new Error("Simulação concluída.");
	const state = controller.getSnapshot();
	const { config } = state;
	const record: MeasurementRecord = {
		...config.pressure, ...(config.persistentSounds ? { zero: 0 as const } : {}),
		dateTime: "2026-10-02T10:00:00-03:00", arm: config.arm, position: "sentado",
		professional: "Profissional Exemplo / COREN fictício 000000", performed: true,
	};
	let value: ActionValue;
	switch (action.rule) {
		case "equals": value = action.expected; break;
		case "materials": value = [...requiredMaterials]; break;
		case "start-timer": value = true; break;
		case "release-start-timer": value = 0; break;
		case "patient-name": value = config.patient.name; break;
		case "patient-birth": value = config.patient.dateOfBirth; break;
		case "exercise": value = parameters.readiness.exerciseMinutes; break;
		case "intake": value = parameters.readiness.intakeMinutes; break;
		case "rest": clock.advance(parameters.rest.milliseconds); value = true; break;
		case "estimation-wait": clock.advance(parameters.estimationWait.minMs); value = true; break;
		case "circumference": value = config.patient.armCircumferenceCm; break;
		case "cuff": value = eligibleCuffs(config.patient.armCircumferenceCm)[0]; break;
		case "offset": value = parameters.cuffOffset.minCm; break;
		case "pulse-disappearance": case "systolic": value = config.pressure.systolic; break;
		case "diastolic": value = config.pressure.diastolic; break;
		case "inflate": value = state.instruments.cuffPressure + parameters.inflation.increment; break;
		case "deflation": value = parameters.deflation.mmHgPerSecond; break;
		case "confirmation": value = config.pressure.diastolic - parameters.confirmation.minDrop; break;
		case "readings": case "documentation": value = record; break;
		default: {
			const unhandled: never = action;
			throw new Error(`Condição sem exemplo: ${JSON.stringify(unhandled)}`);
		}
	}
	return { type: action.type, target: action.target, value };
}

export function runMockScenario(config: ScenarioConfig = defaultConfig) {
	const clock = new MockClock();
	const controller = new SimulationController(config, clock.now);
	for (let count = 0; !controller.getSnapshot().completed; count++) {
		if (count > 1000) throw new Error("O cenário não terminou.");
		const result = controller.dispatch(nextMockEvent(controller, clock));
		if (!result.accepted) throw new Error(result.feedback);
	}
	return { timeLabel: clock.label, elapsedMs: clock.now(), session: controller.getSnapshot() };
}
