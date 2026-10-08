import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { PointerEventTypes, PointerInfo } from "@babylonjs/core/Events/pointerEvents";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Nullable } from "@babylonjs/core/types";
import type { App } from "../App";
import { auscultatoryScenario } from "../simulation/auscultatoryScenario";
import { eligibleCuffs, requiredMaterials } from "../simulation/clinicalParameters";
import type { ActionDefinition, CommunicationRecord, InteractionEvent, MeasurementRecord, SessionState, StepDefinition } from "../simulation/types";

interface TargetMeta {
	label: string;
	icon: string;
	station: "overview" | "hygiene" | "prontuario" | "mesa" | "cadeira" | "esquerdo" | "direito";
}

const targetInfo: Record<string, TargetMeta> = {
	"hygiene-station": { label: "Dispensador de Higiene das Mãos", icon: "🧴", station: "mesa" },
	"stethoscope": { label: "Estetoscópio", icon: "🩺", station: "mesa" },
	"tray": { label: "Bandeja de Instrumentos", icon: "📥", station: "mesa" },
	"patient": { label: "Paciente", icon: "👤", station: "cadeira" },
	"patient-arm": { label: "Braço do Paciente", icon: "💪", station: "direito" },
	"patient-wrist": { label: "Pulso Radial", icon: "✋", station: "direito" },
	"cuffs": { label: "Manguitos na Bandeja", icon: "🩹", station: "cadeira" },
	"cuff": { label: "Manguito de Pressão no Braço", icon: "🩹", station: "direito" },
	"gauge": { label: "Manômetro Aneroide", icon: "⏱️", station: "mesa" },
	"measuring-tape": { label: "Fita Métrica", icon: "📏", station: "mesa" },
	"record": { label: "Prontuário no Balcão", icon: "📋", station: "prontuario" },
	"dialogue-trigger": { label: "Diálogo com o Paciente", icon: "💬", station: "cadeira" },
};

export class InteractionManager {
	private _scene: Scene;
	private _app: App;
	private _arrowRoot: TransformNode | null = null;
	private _targetLerpPosition = new Vector3(0, 1.5, 0);
	private _xrSlateRoot: TransformNode | null = null;
	private _xrSlatePlane: Mesh | null = null;
	private _xrSlateTexture: DynamicTexture | null = null;
	private _dialogueTriggerRoot: TransformNode | null = null;
	private _dialogueTriggerMesh: Mesh | null = null;
	private _guidanceCard: HTMLElement | null = null;
	private _dialogueOpen = false;
	private _lastDialogueText: string | null = null;
	private _disposed = false;
	private _audioCtx: AudioContext | null = null;
	private _pointerObserver: Nullable<Observer<PointerInfo>> = null;
	private _renderObserver: Nullable<Observer<Scene>> = null;
	private _feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

	public constructor(scene: Scene, app: App) {
		this._scene = scene;
		this._app = app;
		this._initTargetArrow();
		this._initXrSlate();
		this._initDialogueTrigger();
		this._initGuidanceHUD();
		this._initPointerInteractions();
		this._updateGuidance();
	}

	private _initTargetArrow(): void {
		const root = new TransformNode("target-indicator-arrow-root", this._scene);
		const material = new StandardMaterial("target-arrow-material", this._scene);
		material.diffuseColor = Color3.FromHexString("#00E5FF");
		material.emissiveColor = Color3.FromHexString("#00B0FF");
		material.specularColor = Color3.White();

		const cone = CreateCylinder("target-arrow-cone", {
			diameterTop: 0,
			diameterBottom: 0.14,
			height: 0.20,
			tessellation: 20,
		}, this._scene);
		cone.material = material;
		cone.rotation.x = Math.PI;
		cone.position.y = 0.10;
		cone.isPickable = false;
		cone.parent = root;

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
		this._renderObserver = this._scene.onBeforeRenderObservable.add(() => {
			if (this._disposed) return;
			time += 0.04;

			if (this._arrowRoot) {
				Vector3.LerpToRef(this._arrowRoot.position, this._targetLerpPosition, 0.12, this._arrowRoot.position);
				this._arrowRoot.position.y = this._targetLerpPosition.y + Math.sin(time) * 0.04;
				this._arrowRoot.rotation.y += 0.02;
			}

			if (this._dialogueTriggerRoot) {
				this._dialogueTriggerRoot.position.y = 1.35 + Math.sin(time * 0.7) * 0.025;
				const camera = this._scene.activeCamera;
				if (camera) {
					this._dialogueTriggerRoot.lookAt(camera.position, Math.PI);
				}
			}

			if (this._xrSlateRoot) {
				Vector3.LerpToRef(this._xrSlateRoot.position, new Vector3(
					this._targetLerpPosition.x + 0.35,
					this._targetLerpPosition.y + 0.25,
					this._targetLerpPosition.z
				), 0.10, this._xrSlateRoot.position);
				const camera = this._scene.activeCamera;
				if (camera) {
					this._xrSlateRoot.lookAt(camera.position, Math.PI);
				}
			}
		});
	}

	private _initXrSlate(): void {
		const slateRoot = new TransformNode("xr-guidance-slate-root", this._scene);
		const plane = CreatePlane("xr-guidance-slate", { width: 0.85, height: 0.42 }, this._scene);
		plane.parent = slateRoot;
		plane.isPickable = false;

		const texture = new DynamicTexture("xr-guidance-texture", { width: 1024, height: 512 }, this._scene, false);
		texture.hasAlpha = false;

		const mat = new StandardMaterial("xr-guidance-slate-mat", this._scene);
		mat.diffuseTexture = texture;
		mat.emissiveColor = Color3.White();
		mat.specularColor = Color3.Black();
		mat.backFaceCulling = false;
		plane.material = mat;

		this._xrSlateRoot = slateRoot;
		this._xrSlatePlane = plane;
		this._xrSlateTexture = texture;
	}

	private _initDialogueTrigger(): void {
		const triggerRoot = new TransformNode("patient-dialogue-trigger-root", this._scene);
		triggerRoot.position.set(-0.80, 1.35, -1.15);

		const disc = CreateCylinder("patient-dialogue-trigger", {
			diameter: 0.22,
			height: 0.04,
			tessellation: 32,
		}, this._scene);
		disc.rotation.x = Math.PI / 2;
		disc.parent = triggerRoot;
		disc.isPickable = true;
		disc.metadata = { assetId: "patient-dialogue-trigger", logicalTarget: "dialogue-trigger" };

		const mat = new StandardMaterial("patient-dialogue-trigger-mat", this._scene);
		mat.diffuseColor = Color3.FromHexString("#00E5FF");
		mat.emissiveColor = Color3.FromHexString("#00838F");
		mat.specularColor = Color3.White();
		disc.material = mat;

		this._dialogueTriggerRoot = triggerRoot;
		this._dialogueTriggerMesh = disc;
	}

	private _initPointerInteractions(): void {
		this._pointerObserver = this._scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
			if (this._disposed) return;
			if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
			const mesh = pointerInfo.pickInfo?.pickedMesh as Mesh | undefined;
			if (!mesh) return;

			this.handleMeshInteraction(mesh);
		});
	}

	public handleMeshInteraction(mesh: Mesh): boolean {
		const snapshot = this._app.getSimulationSnapshot();
		const currentAction = this._app.getCurrentSimulationAction();
		if (!snapshot || !currentAction) return false;

		const logicalTarget = mesh.metadata?.logicalTarget ?? this._resolveLogicalTarget(mesh.name);
		if (!logicalTarget) return false;

		// Lateral dialogue trigger or direct click on the patient model
		if (logicalTarget === "dialogue-trigger" || logicalTarget === "patient" || mesh.name === "patient-dialogue-trigger") {
			this.openDialogueModal();
			return true;
		}

		// Check if the interaction target matches the active physical action requirement
		if (logicalTarget !== currentAction.target) {
			const expectedName = targetInfo[currentAction.target]?.label ?? currentAction.target;
			this._showFeedback(`Alvo incorreto: a etapa atual requer interação com: ${expectedName}. Siga a seta indicadora.`, false);
			this._playChime(false);
			return false;
		}

		// Target matches: execute corresponding step logic
		return this.executeActiveActionFromScene(mesh);
	}

	private _resolveLogicalTarget(meshName: string): string | null {
		if (meshName.includes("dialogue")) return "dialogue-trigger";
		if (meshName.startsWith("Soap") || meshName.startsWith("sanitizer") || meshName.includes("hygiene")) return "hygiene-station";
		if (meshName.startsWith("Clipboard") || meshName.includes("record")) return "record";
		if (meshName === "fitted-cuff-sleeve" || meshName.startsWith("cuff-sleeve")) return "cuff";
		if (meshName.includes("wrist")) return "patient-wrist";
		if (meshName.includes("forearm") || meshName.includes("arm")) return "patient-arm";
		if (meshName.startsWith("patient")) return "patient";
		if (meshName.startsWith("stethoscope")) return "stethoscope";
		if (meshName.startsWith("measuring-tape")) return "measuring-tape";
		if (meshName.startsWith("cuff-") || meshName === "cuff-set") return "cuffs";
		if (meshName.startsWith("sphygmo") || meshName.startsWith("gauge")) return "gauge";
		if (meshName.startsWith("tray")) return "tray";
		return null;
	}

	private _resolveTargetPosition(targetKey: string): Vector3 {
		switch (targetKey) {
			case "hygiene-station": {
				const sanitizer = this._scene.getTransformNodeByName("sanitizer-root");
				if (sanitizer) return sanitizer.position.clone().addInPlace(new Vector3(0, 0.20, 0));
				const soap = this._scene.getMeshByName("Soap_blinn1_0");
				if (soap) return soap.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.25, 0));
				break;
			}
			case "stethoscope": {
				const steth = this._scene.getTransformNodeByName("stethoscope-root");
				if (steth) return steth.position.clone().addInPlace(new Vector3(0, 0.18, 0));
				break;
			}
			case "tray": {
				const tray = this._scene.getMeshByName("tray");
				if (tray) return tray.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.15, 0));
				break;
			}
			case "patient": {
				const patient = this._scene.getTransformNodeByName("patient-root");
				if (patient) return patient.position.clone().addInPlace(new Vector3(0, 0.85, 0));
				break;
			}
			case "dialogue-trigger": {
				if (this._dialogueTriggerRoot) return this._dialogueTriggerRoot.position.clone();
				break;
			}
			case "patient-arm": {
				const arm = this._scene.getMeshByName("patient-forearm-direito");
				if (arm) return arm.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.15, 0));
				break;
			}
			case "cuff": {
				const sleeve = this._scene.getMeshByName("fitted-cuff-sleeve");
				if (sleeve) return sleeve.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.16, 0));
				const arm = this._scene.getMeshByName("patient-forearm-direito");
				if (arm) return arm.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.16, 0));
				break;
			}
			case "patient-wrist": {
				const wrist = this._scene.getMeshByName("patient-wrist-direito");
				if (wrist) return wrist.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.16, 0));
				break;
			}
			case "cuffs": {
				const cuffSet = this._scene.getTransformNodeByName("cuff-set");
				if (cuffSet) return cuffSet.position.clone().addInPlace(new Vector3(0, 0.22, 0));
				break;
			}
			case "gauge": {
				const sphygmo = this._scene.getTransformNodeByName("sphygmo-root");
				if (sphygmo) return sphygmo.position.clone().addInPlace(new Vector3(0, 0.22, 0));
				break;
			}
			case "record": {
				const clip = this._scene.getMeshByName("Clipboard_blinn1_0");
				if (clip) return clip.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.22, 0));
				break;
			}
		}

		return new Vector3(0, 1.5, 0);
	}

	public executeActiveActionFromScene(mesh?: Mesh): boolean {
		const action = this._app.getCurrentSimulationAction();
		const snapshot = this._app.getSimulationSnapshot();
		if (!action || !snapshot) return false;

		const config = snapshot.config;
		let event: InteractionEvent | null = null;

		switch (action.type) {
			case "hand-hygiene-performed":
				event = { type: action.type, target: "hygiene-station", value: true };
				break;
			case "chestpiece-disinfected":
			case "earpieces-disinfected":
				event = { type: action.type, target: "stethoscope", value: "cotton-alcohol-70" };
				break;
			case "materials-gathered":
				event = { type: action.type, target: "tray", value: [...requiredMaterials] };
				break;
			case "cuff-selected": {
				const selectedCuff = mesh?.metadata?.cuffId ?? eligibleCuffs(config.patient.armCircumferenceCm)[0] ?? "adult";
				event = { type: action.type, target: "cuffs", value: selectedCuff };
				break;
			}
			case "circumference-measured":
				event = { type: action.type, target: "measuring-tape", value: config.patient.armCircumferenceCm };
				break;
			case "cuff-offset-measured":
				event = { type: action.type, target: "cuff", value: 2.5 };
				break;
			case "eye-level-aligned":
				event = { type: action.type, target: "gauge", value: true };
				break;
			case "radial-pulse-palpated":
				event = { type: action.type, target: "patient-wrist", value: true };
				break;
			case "pulse-disappeared":
				event = { type: action.type, target: "cuff", value: config.pressure.systolic };
				break;
			case "slow-deflation-performed":
				event = { type: action.type, target: "cuff", value: true };
				break;
			case "pulse-reappearance-recorded":
				event = { type: action.type, target: "gauge", value: config.pressure.systolic };
				break;
			case "estimation-air-released":
			case "remaining-air-released":
			case "sounds-at-zero-confirmed":
				event = { type: action.type, target: action.target, value: 0 };
				break;
			case "estimation-wait-finished":
				this._app.advanceSimulatedTime(60000);
				event = { type: action.type, target: "cuff", value: true };
				break;
			case "quiet-rest-finished":
				this._app.advanceSimulatedTime(300000);
				event = { type: action.type, target: "patient", value: true };
				break;
			case "earpieces-placed":
				event = { type: action.type, target: "stethoscope", value: true };
				break;
			case "cubital-artery-palpated":
				event = { type: action.type, target: "patient-arm", value: true };
				break;
			case "chestpiece-placed":
				event = { type: action.type, target: "stethoscope", value: "bell" };
				break;
			case "rapid-inflation-increment": {
				const targetPressure = snapshot.instruments.cuffPressure + 10;
				event = { type: action.type, target: "cuff", value: targetPressure };
				break;
			}
			case "deflation-started":
				event = { type: action.type, target: "cuff", value: 2 };
				break;
			case "first-sound-recorded":
				event = { type: action.type, target: "gauge", value: config.pressure.systolic };
				break;
			case "regular-beats-confirmed":
				event = { type: action.type, target: "stethoscope", value: true };
				break;
			case "sound-disappearance-recorded":
			case "muffling-recorded":
				event = { type: action.type, target: "gauge", value: config.pressure.diastolic };
				break;
			case "disappearance-confirmed": {
				const confirmDrop = config.pressure.diastolic - 25;
				event = { type: action.type, target: "stethoscope", value: confirmDrop };
				break;
			}
			case "cuff-removed":
				event = { type: action.type, target: "cuff", value: true };
				break;
			case "three-values-recorded":
			case "measurement-documented": {
				const record: MeasurementRecord = {
					systolic: config.pressure.systolic,
					diastolic: config.pressure.diastolic,
					...(config.persistentSounds ? { zero: 0 } : {}),
					dateTime: new Date().toISOString().slice(0, 16),
					arm: config.arm,
					position: "sentado",
					professional: "Enf. Vinicius - COREN 123456",
					performed: true,
				};
				event = { type: action.type, target: "record", value: record };
				break;
			}
			default:
				event = { type: action.type, target: action.target, value: true };
				break;
		}

		if (event) {
			return this.dispatchAction(event);
		}
		return false;
	}

	public dispatchAction(event: InteractionEvent): boolean {
		const result = this._app.dispatchSimulationEvent(event);
		if (!result) return false;

		if (result.accepted) {
			this._showFeedback(result.feedback || "Ação realizada corretamente.", true);
			this._playChime(true);
			this._updateGuidance();
			return true;
		} else {
			this._showFeedback(result.feedback || "Ação não aceita.", false);
			this._playChime(false);
			return false;
		}
	}

	public openDialogueModal(): void {
		this._dialogueOpen = true;
		this._updateGuidance();
	}

	public closeDialogueModal(): void {
		this._dialogueOpen = false;
		this._updateGuidance();
	}

	public triggerDialogueTopic(topicId: "identify-patient" | "check-readiness" | "explain-and-rest" | "inform-patient"): void {
		if (topicId === "explain-and-rest") {
			this._app.advanceSimulatedTime(300000);
		}

		const result = this._app.dispatchLateralDialogue(topicId);
		if (!result) return;

		this._lastDialogueText = result.dialogueText;

		if (result.accepted) {
			this._showFeedback(result.feedback, true);
			this._playChime(true);
		} else {
			this._showFeedback(result.feedback, false);
			this._playChime(false);
		}

		this._updateGuidance();
	}

	private _initGuidanceHUD(): void {
		const existing = document.getElementById("step-guidance-hud");
		if (existing) existing.remove();

		const card = document.createElement("section");
		card.id = "step-guidance-hud";
		card.className = "step-guidance-hud";
		card.setAttribute("aria-label", "Instruções do procedimento");

		document.body.appendChild(card);
		this._guidanceCard = card;
	}

	public refreshGuidance(): void {
		this._updateGuidance();
	}

	private _updateGuidance(): void {
		const snapshot = this._app.getSimulationSnapshot();
		if (!snapshot || !this._guidanceCard) return;

		if (snapshot.completed) {
			this._renderCompletionHUD();
			return;
		}

		if (this._dialogueOpen) {
			this._renderDialogueHUD(snapshot);
			return;
		}

		this._renderPhysicalGuidanceHUD(snapshot);
	}

	private _renderPhysicalGuidanceHUD(snapshot: SessionState): void {
		if (!this._guidanceCard) return;

		const step = auscultatoryScenario.find(s => s.id === snapshot.currentStepId);
		const action = this._app.getCurrentSimulationAction();
		if (!step || !action) return;

		const target = targetInfo[action.target] ?? { label: action.target, icon: "🎯", station: "overview" };
		const targetPos = this._resolveTargetPosition(action.target);
		this._targetLerpPosition.copyFrom(targetPos);

		const stepNumber = step.checklistNumber;
		const progressPercent = Math.min(100, Math.round((stepNumber / 26) * 100));

		let timerHtml = "";
		if (action.rule === "estimation-wait") {
			timerHtml = `
				<div class="step-actions-row">
					<button id="hud-timer-button" class="step-action-button" type="button">
						⏳ Concluir intervalo de 1 min (tempo simulado)
					</button>
				</div>
			`;
		}

		this._guidanceCard.innerHTML = `
			<div class="guidance-header">
				<span class="step-counter-badge">Passo ${stepNumber} de 26</span>
				<span class="step-target-badge">${target.icon} ${target.label}</span>
			</div>
			<h3 class="step-headline">${step.prompt}</h3>
			<p class="step-detail">${action.prompt}</p>

			${timerHtml}

			<div class="step-actions-row">
				<button id="hud-open-dialogue-btn" class="button secondary" type="button" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
					💬 Diálogo com o Paciente (Ações Não-Bloqueantes)
				</button>
			</div>

			<div class="step-actions-row">
				<button id="hud-goto-station-button" class="button secondary" type="button" style="width: 100%; font-size: 13px;">
					📍 Ir até a estação (${target.station})
				</button>
			</div>

			<div class="step-progress-container">
				<div class="step-progress-track">
					<div class="step-progress-fill" style="width: ${progressPercent}%;"></div>
				</div>
			</div>
			<div class="step-toast-feedback" id="hud-toast" hidden></div>
		`;

		const dialogueBtn = this._guidanceCard.querySelector("#hud-open-dialogue-btn") as HTMLButtonElement | null;
		dialogueBtn?.addEventListener("click", () => {
			this.openDialogueModal();
		});

		const timerBtn = this._guidanceCard.querySelector("#hud-timer-button") as HTMLButtonElement | null;
		timerBtn?.addEventListener("click", () => {
			this._app.advanceSimulatedTime(60000);
			this.dispatchAction({ type: "estimation-wait-finished", target: "cuff", value: true });
		});

		const gotoBtn = this._guidanceCard.querySelector("#hud-goto-station-button") as HTMLButtonElement | null;
		gotoBtn?.addEventListener("click", () => {
			this._app.moveToStation(target.station);
		});

		// Update in-headset 3D slate
		this._renderXrSlate(stepNumber, step.prompt, action.prompt, target.label, target.station);
	}

	private _renderDialogueHUD(snapshot: SessionState): void {
		if (!this._guidanceCard) return;

		const isStepDone = (id: string) => snapshot.steps[id]?.status === "completed";
		const done5 = isStepDone("identify-patient");
		const done6 = isStepDone("check-readiness");
		const done7 = isStepDone("explain-and-rest");
		const done23 = isStepDone("inform-patient");

		this._guidanceCard.innerHTML = `
			<div class="guidance-header">
				<span class="step-counter-badge" style="background: #0288d1;">Comunicação Clínica</span>
				<span class="step-target-badge">💬 Paciente</span>
			</div>
			<div class="dialogue-header-row">
				<h3 class="step-headline">Diálogo e Anamnese com o Paciente</h3>
				<button id="hud-close-dialogue" class="dialogue-close-btn" type="button" aria-label="Fechar">✕</button>
			</div>
			<p class="step-detail">Identifique o momento clínico apropriado para cada pergunta. Estas ações não bloqueiam o procedimento e seu timing será avaliado no debriefing.</p>

			<div class="dialogue-topics-list">
				<button class="dialogue-topic-button ${done5 ? 'completed' : ''}" data-topic="identify-patient">
					<div class="topic-header">
						<span class="topic-title">👤 1. Identificação do Paciente (Passo 5)</span>
						<span class="topic-status-badge ${done5 ? 'badge-done' : 'badge-pending'}">${done5 ? '✓ Realizado' : 'Pendente'}</span>
					</div>
					<p class="topic-description">Apresentar-se e confirmar nome completo e data de nascimento no leito.</p>
				</button>

				<button class="dialogue-topic-button ${done6 ? 'completed' : ''}" data-topic="check-readiness">
					<div class="topic-header">
						<span class="topic-title">📋 2. Condições de Preparo (Passo 6)</span>
						<span class="topic-status-badge ${done6 ? 'badge-done' : 'badge-pending'}">${done6 ? '✓ Realizado' : 'Pendente'}</span>
					</div>
					<p class="topic-description">Verificar bexiga vazia, repouso de 90 min de exercícios e 30 min sem café/fumo.</p>
				</button>

				<button class="dialogue-topic-button ${done7 ? 'completed' : ''}" data-topic="explain-and-rest">
					<div class="topic-header">
						<span class="topic-title">⏳ 3. Orientações e Repouso (Passo 7)</span>
						<span class="topic-status-badge ${done7 ? 'badge-done' : 'badge-pending'}">${done7 ? '✓ Realizado' : 'Pendente'}</span>
					</div>
					<p class="topic-description">Explicar o exame, instruir silêncio e realizar repouso calmo de 5 minutos.</p>
				</button>

				<button class="dialogue-topic-button ${done23 ? 'completed' : ''}" data-topic="inform-patient">
					<div class="topic-header">
						<span class="topic-title">📢 4. Comunicação de Resultados (Passo 23)</span>
						<span class="topic-status-badge ${done23 ? 'badge-done' : 'badge-pending'}">${done23 ? '✓ Realizado' : 'Pendente'}</span>
					</div>
					<p class="topic-description">Informar os valores de pressão arterial aferidos e condutas ao paciente.</p>
				</button>
			</div>

			${this._lastDialogueText ? `
				<div class="dialogue-speech-box">
					<div class="speech-role">🧑 Paciente respondeu:</div>
					<div class="speech-text">"${this._lastDialogueText}"</div>
				</div>
			` : ''}

			<div class="step-actions-row">
				<button id="hud-back-to-step" class="button secondary" type="button" style="width: 100%;">
					⬅ Continuar Procedimento Físico
				</button>
			</div>
			<div class="step-toast-feedback" id="hud-toast" hidden></div>
		`;

		const closeBtn = this._guidanceCard.querySelector("#hud-close-dialogue") as HTMLButtonElement | null;
		closeBtn?.addEventListener("click", () => this.closeDialogueModal());

		const backBtn = this._guidanceCard.querySelector("#hud-back-to-step") as HTMLButtonElement | null;
		backBtn?.addEventListener("click", () => this.closeDialogueModal());

		const topicBtns = this._guidanceCard.querySelectorAll<HTMLButtonElement>(".dialogue-topic-button");
		topicBtns.forEach(btn => {
			btn.addEventListener("click", () => {
				const topic = btn.getAttribute("data-topic") as "identify-patient" | "check-readiness" | "explain-and-rest" | "inform-patient" | null;
				if (topic) {
					this.triggerDialogueTopic(topic);
				}
			});
		});

		// Render XR slate dialogue mode
		this._renderXrSlateDialogue(done5, done6, done7, done23);
	}

	private _renderCompletionHUD(): void {
		if (!this._guidanceCard) return;

		const records = this._app.getCommunicationEvaluation();
		const findRecord = (id: string) => records.find(r => r.stepId === id);

		const r5 = findRecord("identify-patient");
		const r6 = findRecord("check-readiness");
		const r7 = findRecord("explain-and-rest");
		const r23 = findRecord("inform-patient");

		let commScore = 100;
		for (const r of [r5, r6, r7, r23]) {
			if (!r || r.status === "omitted") commScore -= 25;
			else if (r.timing === "late" || r.timing === "early") commScore -= 10;
		}
		commScore = Math.max(0, commScore);

		const totalScore = Math.round(50 + (commScore * 0.5));

		const formatBadge = (r?: CommunicationRecord) => {
			if (!r || r.status === "omitted") return `<span class="debrief-badge omitted">❌ Omitido</span>`;
			if (r.timing === "ideal") return `<span class="debrief-badge ideal">✓ Momento Ideal</span>`;
			if (r.timing === "late") return `<span class="debrief-badge late">⚠ Tardio</span>`;
			return `<span class="debrief-badge early">⚠ Precoce</span>`;
		};

		this._guidanceCard.innerHTML = `
			<div class="guidance-header">
				<span class="step-counter-badge" style="background: #2e7d32;">Concluído</span>
				<span class="step-target-badge">📊 Debriefing Formativo</span>
			</div>
			<div class="debrief-score-card">
				<div class="debrief-score-num">${totalScore} / 100</div>
				<div class="debrief-score-label">Pontuação Geral de Competência Clínica</div>
			</div>

			<div class="debrief-section">
				<h4 class="debrief-section-title">🩺 Procedimento Físico (22 Etapas Concluídas)</h4>
				<ul class="debrief-list">
					<li>✓ Higiene das mãos cumprida nos 4 momentos essenciais (Passos 1, 4, 8, 25).</li>
					<li>✓ Assepsia e desinfecção do estetoscópio com álcool 70% (Passo 2).</li>
					<li>✓ Separação e preparo de materiais na bandeja e olhos alinhados ao manômetro (Passos 3, 13).</li>
					<li>✓ Estimativa prévia da sistólica por palpação radial (Passo 14).</li>
					<li>✓ Ausculta braquial, deflação a 2 mmHg/s e identificação de fases I e V (Passos 16–21).</li>
					<li>✓ Remoção do manguito e documentação completa no prontuário (Passos 24, 26).</li>
				</ul>
			</div>

			<div class="debrief-section">
				<h4 class="debrief-section-title">💬 Comunicação e Anamnese (Ícone Lateral)</h4>
				<div class="debrief-item">
					<div class="debrief-item-header">
						<strong>Passo 5: Identificação do Paciente</strong>
						${formatBadge(r5)}
					</div>
					<p class="debrief-item-detail">${r5?.feedback ?? "Não realizado."}</p>
				</div>
				<div class="debrief-item">
					<div class="debrief-item-header">
						<strong>Passo 6: Condições de Preparo</strong>
						${formatBadge(r6)}
					</div>
					<p class="debrief-item-detail">${r6?.feedback ?? "Não realizado."}</p>
				</div>
				<div class="debrief-item">
					<div class="debrief-item-header">
						<strong>Passo 7: Orientações e Repouso 5 min</strong>
						${formatBadge(r7)}
					</div>
					<p class="debrief-item-detail">${r7?.feedback ?? "Não realizado."}</p>
				</div>
				<div class="debrief-item">
					<div class="debrief-item-header">
						<strong>Passo 23: Comunicação de Resultados</strong>
						${formatBadge(r23)}
					</div>
					<p class="debrief-item-detail">${r23?.feedback ?? "Não realizado."}</p>
				</div>
			</div>

			<div class="step-actions-row" style="margin-top: 10px;">
				<button id="debrief-restart-btn" class="button primary" type="button" style="flex: 1;">
					<span>Reiniciar Simulação</span>
					<span>🔄</span>
				</button>
			</div>
			<div class="step-actions-row">
				<button id="debrief-menu-btn" class="button secondary" type="button" style="width: 100%;">
					Voltar ao Menu Principal
				</button>
			</div>
		`;

		const restartBtn = this._guidanceCard.querySelector("#debrief-restart-btn") as HTMLButtonElement | null;
		restartBtn?.addEventListener("click", () => {
			void this._app.restartSimulation();
		});

		const menuBtn = this._guidanceCard.querySelector("#debrief-menu-btn") as HTMLButtonElement | null;
		menuBtn?.addEventListener("click", () => {
			this._app.returnToMenu();
		});

		// Render XR slate debrief mode
		this._renderXrSlateDebrief(
			totalScore,
			r5 ? (r5.timing === "ideal" ? "Ideal" : r5.timing === "late" ? "Tardio" : "Omitido") : "Omitido",
			r6 ? (r6.timing === "ideal" ? "Ideal" : r6.timing === "late" ? "Tardio" : "Omitido") : "Omitido",
			r7 ? (r7.timing === "ideal" ? "Ideal" : r7.timing === "late" ? "Tardio" : "Omitido") : "Omitido",
			r23 ? (r23.timing === "ideal" ? "Ideal" : "Omitido") : "Omitido"
		);
	}

	private _renderXrSlate(stepNumber: number, title: string, instruction: string, targetName: string, station: string): void {
		if (!this._xrSlateTexture) return;
		const ctx = this._xrSlateTexture.getContext();
		const w = 1024;
		const h = 512;

		ctx.clearRect(0, 0, w, h);

		ctx.fillStyle = "rgba(16, 46, 37, 0.94)";
		ctx.strokeStyle = "rgba(0, 229, 255, 0.8)";
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.roundRect(10, 10, w - 20, h - 20, 28);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = "#00E5FF";
		ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
		ctx.fillText(`PASSO ${stepNumber} DE 26 • ESTAÇÃO: ${station.toUpperCase()}`, 40, 70);

		ctx.fillStyle = "#81C784";
		ctx.font = "bold 28px 'Segoe UI', Arial, sans-serif";
		ctx.fillText(`🎯 Alvo: ${targetName}`, 40, 120);

		ctx.fillStyle = "#FFFFFF";
		ctx.font = "bold 38px 'Segoe UI', Arial, sans-serif";
		this._drawWrappedText(ctx, title, 40, 185, 940, 46);

		ctx.fillStyle = "#E0E0E0";
		ctx.font = "30px 'Segoe UI', Arial, sans-serif";
		this._drawWrappedText(ctx, instruction, 40, 310, 940, 40);

		ctx.fillStyle = "#FFD54F";
		ctx.font = "italic 26px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("Interaja com o objeto 3D • Use o ícone de diálogo para falar com o paciente", 40, 465);

		this._xrSlateTexture.update();
	}

	private _renderXrSlateDialogue(d5: boolean, d6: boolean, d7: boolean, d23: boolean): void {
		if (!this._xrSlateTexture) return;
		const ctx = this._xrSlateTexture.getContext();
		const w = 1024;
		const h = 512;

		ctx.clearRect(0, 0, w, h);

		ctx.fillStyle = "rgba(10, 35, 45, 0.96)";
		ctx.strokeStyle = "rgba(0, 229, 255, 0.9)";
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.roundRect(10, 10, w - 20, h - 20, 28);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = "#00E5FF";
		ctx.font = "bold 34px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("💬 DIÁLOGO E ANAMNESE COM O PACIENTE", 40, 75);

		ctx.fillStyle = "#FFFFFF";
		ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("Tópicos de Diálogo (Ações Não-Bloqueantes):", 40, 130);

		ctx.font = "24px 'Segoe UI', Arial, sans-serif";
		ctx.fillStyle = d5 ? "#81C784" : "#E0E0E0";
		ctx.fillText(`1. Identificação (Passo 5): ${d5 ? '✓ Concluído' : 'Pendente'}`, 40, 180);

		ctx.fillStyle = d6 ? "#81C784" : "#E0E0E0";
		ctx.fillText(`2. Condições de Preparo (Passo 6): ${d6 ? '✓ Concluído' : 'Pendente'}`, 40, 225);

		ctx.fillStyle = d7 ? "#81C784" : "#E0E0E0";
		ctx.fillText(`3. Orientações e Repouso 5 min (Passo 7): ${d7 ? '✓ Concluído' : 'Pendente'}`, 40, 270);

		ctx.fillStyle = d23 ? "#81C784" : "#E0E0E0";
		ctx.fillText(`4. Informar Valores (Passo 23): ${d23 ? '✓ Concluído' : 'Pendente'}`, 40, 315);

		if (this._lastDialogueText) {
			ctx.fillStyle = "#FFD54F";
			ctx.font = "italic 24px 'Segoe UI', Arial, sans-serif";
			this._drawWrappedText(ctx, `Paciente: "${this._lastDialogueText}"`, 40, 385, 940, 34);
		}

		ctx.fillStyle = "#81D4FA";
		ctx.font = "22px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("Clique no ícone lateral ou no painel para selecionar os tópicos", 40, 480);

		this._xrSlateTexture.update();
	}

	private _renderXrSlateDebrief(score: number, p5: string, p6: string, p7: string, p23: string): void {
		if (!this._xrSlateTexture) return;
		const ctx = this._xrSlateTexture.getContext();
		const w = 1024;
		const h = 512;

		ctx.clearRect(0, 0, w, h);

		ctx.fillStyle = "rgba(16, 46, 37, 0.96)";
		ctx.strokeStyle = "rgba(0, 229, 255, 0.8)";
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.roundRect(10, 10, w - 20, h - 20, 28);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = "#00E5FF";
		ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
		ctx.fillText(`RELATÓRIO DE DEBRIEFING CLÍNICO • CONCLUÍDO`, 40, 70);

		ctx.fillStyle = "#81C784";
		ctx.font = "bold 34px 'Segoe UI', Arial, sans-serif";
		ctx.fillText(`PONTUAÇÃO GERAL: ${score} / 100`, 40, 125);

		ctx.fillStyle = "#FFFFFF";
		ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("Avaliação da Comunicação (Ícone Lateral):", 40, 180);

		ctx.font = "24px 'Segoe UI', Arial, sans-serif";
		ctx.fillStyle = "#E0E0E0";
		ctx.fillText(`• Identificação (Passo 5): ${p5}`, 40, 225);
		ctx.fillText(`• Condições de Preparo (Passo 6): ${p6}`, 40, 270);
		ctx.fillText(`• Orientações e Repouso 5 min (Passo 7): ${p7}`, 40, 315);
		ctx.fillText(`• Comunicação de Resultados (Passo 23): ${p23}`, 40, 360);

		ctx.fillStyle = "#FFD54F";
		ctx.font = "italic 24px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("✓ Procedimento físico concluído conforme as diretrizes!", 40, 430);
		ctx.fillText("Utilize o menu para reiniciar ou retornar.", 40, 470);

		this._xrSlateTexture.update();
	}

	private _drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
		const words = text.split(" ");
		let line = "";
		let currentY = y;

		for (const word of words) {
			const testLine = line + word + " ";
			const metrics = ctx.measureText(testLine);
			if (metrics.width > maxWidth && line !== "") {
				ctx.fillText(line, x, currentY);
				line = word + " ";
				currentY += lineHeight;
			} else {
				line = testLine;
			}
		}
		ctx.fillText(line, x, currentY);
	}

	private _showFeedback(message: string, isSuccess: boolean): void {
		if (!this._guidanceCard) return;
		const toast = this._guidanceCard.querySelector("#hud-toast") as HTMLElement | null;
		if (!toast) return;

		if (this._feedbackTimeout) {
			clearTimeout(this._feedbackTimeout);
			this._feedbackTimeout = null;
		}

		toast.textContent = (isSuccess ? "✓ " : "⚠ ") + message;
		toast.className = `step-toast-feedback ${isSuccess ? "step-toast-success" : "step-toast-warning"}`;
		toast.hidden = false;

		this._feedbackTimeout = setTimeout(() => {
			if (toast) toast.hidden = true;
		}, 3800);
	}

	private _playChime(isSuccess: boolean): void {
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

			if (isSuccess) {
				osc.frequency.setValueAtTime(659.25, ctx.currentTime);
				osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
				gain.gain.setValueAtTime(0.08, ctx.currentTime);
				gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
				osc.start(ctx.currentTime);
				osc.stop(ctx.currentTime + 0.28);
			} else {
				osc.type = "sine";
				osc.frequency.setValueAtTime(261.63, ctx.currentTime);
				gain.gain.setValueAtTime(0.08, ctx.currentTime);
				gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
				osc.start(ctx.currentTime);
				osc.stop(ctx.currentTime + 0.22);
			}
		} catch {
			// Audio context blocked or unsupported
		}
	}

	public dispose(): void {
		this._disposed = true;
		if (this._pointerObserver) {
			this._scene.onPointerObservable.remove(this._pointerObserver);
			this._pointerObserver = null;
		}
		if (this._renderObserver) {
			this._scene.onBeforeRenderObservable.remove(this._renderObserver);
			this._renderObserver = null;
		}
		if (this._feedbackTimeout) {
			clearTimeout(this._feedbackTimeout);
			this._feedbackTimeout = null;
		}
		this._guidanceCard?.remove();
		this._guidanceCard = null;
		this._arrowRoot?.dispose();
		this._arrowRoot = null;
		this._dialogueTriggerMesh?.dispose();
		this._dialogueTriggerMesh = null;
		this._dialogueTriggerRoot?.dispose();
		this._dialogueTriggerRoot = null;
		this._xrSlatePlane?.dispose();
		this._xrSlatePlane = null;
		this._xrSlateTexture?.dispose();
		this._xrSlateTexture = null;
		this._xrSlateRoot?.dispose();
		this._xrSlateRoot = null;
		this._audioCtx?.close().catch(() => {});
		this._audioCtx = null;
	}
}
