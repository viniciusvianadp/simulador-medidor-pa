export type StepStatus = "pending" | "active" | "completed" | "skipped";
export type ActionValue = string | number | boolean | string[] | MeasurementRecord;

export interface MeasurementRecord {
	systolic: number;
	diastolic: number;
	zero?: 0;
	dateTime: string;
	arm: "esquerdo" | "direito";
	position: "sentado";
	professional: string;
	performed: boolean;
}

export interface InteractionEvent {
	type: string;
	target: string;
	value?: ActionValue;
}

export type ValidationRule =
	| "equals" | "materials" | "patient-name" | "patient-birth"
	| "exercise" | "intake" | "start-timer" | "rest" | "circumference"
	| "cuff" | "offset" | "pulse-disappearance" | "systolic" | "diastolic"
	| "release-start-timer" | "estimation-wait" | "inflate" | "deflation"
	| "confirmation" | "readings" | "documentation" | "chestpiece";

// Only equality has a literal expected value; other rules derive requirements from state.
export type ActionCondition =
	| { rule: "equals"; expected: string | number | boolean }
	| { rule: Exclude<ValidationRule, "equals">; expected?: never };

export type ActionDefinition = ActionCondition & {
	type: string;
	target: string;
	prompt: string;
	feedback: string;
};

export interface StepDefinition {
	id: string;
	checklistNumber: number;
	prompt: string;
	prerequisites: string[];
	targets: string[];
	completionConditions: ActionDefinition[];
	source: string;
}

export interface ScenarioConfig {
	patient: { name: string; dateOfBirth: string; armCircumferenceCm: number };
	pressure: { systolic: number; diastolic: number };
	persistentSounds: boolean;
	arm: "esquerdo" | "direito";
}

export interface Attempt {
	timestamp: number;
	stepId: string | null;
	event: InteractionEvent;
	accepted: boolean;
	feedback: string;
}

export type CommunicationTiming = "ideal" | "late" | "early" | "omitted";

export interface CommunicationRecord {
	stepId: string;
	title: string;
	status: "completed" | "omitted";
	timing: CommunicationTiming;
	physicalStepAtExecution: string | null;
	feedback: string;
}

export interface SessionState {
	config: ScenarioConfig;
	currentStepId: string | null;
	actionIndex: number;
	steps: Record<string, { status: StepStatus; reason?: string }>;
	observations: Record<string, ActionValue>;
	instruments: { cuffPressure: number; cuffAttached: boolean; selectedCuff: string | null };
	timerStartedAt: number | null;
	attempts: Attempt[];
	completed: boolean;
	communicationRecords?: Record<string, CommunicationRecord>;
}
