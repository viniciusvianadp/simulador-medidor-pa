import dialoguePhrases from "./dialoguePhrases.json";
import { DialogueAudio } from "./DialogueAudio";
import { HandInstruments, type InstrumentHandFrame } from "./HandInstruments";
import { connectCuffInstrument } from "../scene/connectCuffInstrument";
import { Scene } from "@babylonjs/core/scene";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { PointerEventTypes, PointerInfo } from "@babylonjs/core/Events/pointerEvents";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Nullable } from "@babylonjs/core/types";
import type { App } from "../App";
import { splitSphygmomanometer } from "../scene/splitSphygmomanometer";
import { clinicalLayout, type StationId } from "../scene/clinicalLayout";
import { SimulationAudio } from "./SimulationAudio";
import { RestartPanel } from "./RestartPanel";
import { renderDebriefHtml, timingLabel } from "./debriefView";
import { buildDebrief, type DebriefReport } from "../simulation/debrief";
import { auscultatoryScenario } from "../simulation/auscultatoryScenario";
import { clinicalParameters, eligibleCuffs, requiredMaterials } from "../simulation/clinicalParameters";
import type { ActionDefinition, CommunicationRecord, InteractionEvent, MeasurementRecord, SessionState, StepDefinition } from "../simulation/types";

interface TargetMeta {
	label: string;
	icon: string;
	station: StationId;
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

const spokenTopics = ["identify-patient", "check-readiness", "explain-and-rest", "inform-patient"] as const;
type SpokenTopic = typeof spokenTopics[number];

const unguidedHeadline = "Modo sem orientação";
const unguidedDetail = "Realize a próxima etapa do procedimento conforme o checklist.";

const pressureInteractionSteps = [
	"inflate-for-auscultation", "start-deflation", "identify-systolic", "identify-diastolic", "confirm-disappearance", "persistent-sounds",
];

export class InteractionManager {
	private _visualMotions: Array<{ node: TransformNode | Mesh; from: Vector3; to: Vector3; startedAt: number; duration: number }> = [];
	private _scene: Scene;
	private _app: App;
	private _arrowRoot: TransformNode | null = null;
	private _targetLerpPosition = new Vector3(0, 1.5, 0);
	private _xrSlateRoot: TransformNode | null = null;
	private _xrSlatePlane: Mesh | null = null;
	private _xrSlateTexture: DynamicTexture | null = null;
	private _xrConfirmationTarget: Mesh | null = null;
	private _xrInflateTarget: Mesh | null = null;
	private _xrDeflationPauseTarget: Mesh | null = null;
	private _xrPressureBoardRoot: TransformNode | null = null;
	private _xrPressureBoardTexture: DynamicTexture | null = null;
	private _xrPressureConfirmTarget: Mesh | null = null;
	private _xrPressureInflateTarget: Mesh | null = null;
	private _xrPressurePauseTarget: Mesh | null = null;
	private _xrPressureBoardActive = false;
	private _xrPressureBoardInstruction = "";
	private _xrPressureBoardCanInflate = false;
	private _xrPressureBoardConfirmation: string | null = null;
	private _xrPressureBoardDeflationControl: string | null = null;
	private _xrPressureBoardLastPressure = Number.NaN;
	private _sphygmomanometerPositioned = false;
	private _instrumentControls: Mesh[] = [];
	private _instrumentFeedback: { mesh: Mesh; rest: Vector3; rotation: Quaternion; startedAt: number } | null = null;
	private _measurementStand: TransformNode | null = null;
	private _cuffHoses: TransformNode | null = null;
	private _handInstruments: HandInstruments | null = null;
	private _xrDialogueTargets: Mesh[] = [];
	private _dialogueTriggerRoot: TransformNode | null = null;
	private _dialogueTriggerMesh: Mesh | null = null;
	private _guidanceCard: HTMLElement | null = null;
	private _dialogueOpen = false;
	private _speaking = false;
	private _spokenSubtitle = "";
	private _speechTimer: ReturnType<typeof setTimeout> | null = null;
	private _speechUtterance: SpeechSynthesisUtterance | null = null;
	private _cancelSpeech: (() => void) | null = null;
	private _slateRestPosition: Vector3 | null = null;
	private _slateRestRotation: Vector3 | null = null;
	private _lastDialogueText: string | null = null;
	private _disposed = false;
	private _audio = new SimulationAudio();
	private _dialogueAudio = new DialogueAudio();
	private _restartPanel: RestartPanel | null = null;
	private _pointerObserver: Nullable<Observer<PointerInfo>> = null;
	private _renderObserver: Nullable<Observer<Scene>> = null;
	private _feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

	public constructor(scene: Scene, app: App) {
		this._scene = scene;
		this._app = app;
		this._initTargetArrow();
		this._initXrSlate();
		this._initXrPressureBoard();
		if (this._isEvaluationMode()) this._initDialogueTrigger();
		this._initGuidanceHUD();
		// Defer the reset: it disposes this manager, which is still handling the pick.
		this._restartPanel = new RestartPanel(scene, app.getGuidanceMode(),
			mode => setTimeout(() => this._app.resetSession(mode), 0));
		this._initPointerInteractions();
		this._moveSphygmomanometerNearPatient();
		this._updateGuidance();
	}

	private _isEvaluationMode(): boolean {
		return this._app.getGuidanceMode() === "evaluation";
	}

	public updatePressureDisplay(pressure: number): void {
		this._audio.updateKorotkoff(this._app.getSimulationSnapshot(), pressure);
		const rounded = Math.round(pressure * 4) / 4;
		if (!Number.isFinite(this._xrPressureBoardLastPressure) || Math.abs(rounded - this._xrPressureBoardLastPressure) >= 0.25) {
			this._xrPressureBoardLastPressure = rounded;
			this._renderXrPressureBoard(rounded);
		}
		const liveValue = this._guidanceCard?.querySelector("#hud-cuff-pressure-value");
		if (liveValue) liveValue.textContent = `${Math.round(pressure)} mmHg`;
	}

	private _animatePosition(node: TransformNode | Mesh, destination: Vector3): void {
		this._visualMotions = this._visualMotions.filter(motion => motion.node !== node);
		this._visualMotions.push({ node, from: node.position.clone(), to: destination, startedAt: performance.now(), duration: 900 });
	}

	private _updateVisualMotions(): void {
		const now = performance.now();
		this._visualMotions = this._visualMotions.filter(motion => {
			const progress = Math.min(1, (now - motion.startedAt) / motion.duration);
			const eased = progress * progress * (3 - 2 * progress);
			Vector3.LerpToRef(motion.from, motion.to, eased, motion.node.position);
			return progress < 1;
		});
	}

	private _applyAcceptedVisual(event: InteractionEvent): void {
		const stethoscope = this._scene.getTransformNodeByName("stethoscope-root");
		switch (event.type) {
			case "cuff-removed":
				this._scene.getMeshByName("fitted-cuff-sleeve")?.setEnabled(false);
				this._cuffHoses?.setEnabled(false);
				break;
			case "earpieces-placed":
				// The learner wears the earpieces; there is no learner avatar to render them on.
				stethoscope?.setEnabled(false);
				break;
		}
	}

	private _moveSphygmomanometerNearPatient(): void {
		if (this._sphygmomanometerPositioned) return;
		const snapshot = this._app.getSimulationSnapshot();
		const sphygmomanometer = this._scene.getTransformNodeByName("sphygmo-root");
		const arm = snapshot && this._scene.getMeshByName(`patient-forearm-${snapshot.config.arm}`);
		if (!sphygmomanometer || !arm) return;
		arm.computeWorldMatrix(true);

		// Place the model's visible bounds, rather than its offset GLB origin.
		// The stand is forward of the supported arm, clear of the wrist approach.
		const center = arm.getAbsolutePosition().add(Vector3.FromArray(clinicalLayout.measurementStandOffset));
		sphygmomanometer.rotation.y = 0;
		sphygmomanometer.computeWorldMatrix(true);
		const bounds = sphygmomanometer.getHierarchyBoundingVectors(true);
		sphygmomanometer.position.addInPlace(new Vector3(
			center.x - (bounds.min.x + bounds.max.x) / 2,
			center.y - bounds.min.y,
			center.z - (bounds.min.z + bounds.max.z) / 2,
		));
		sphygmomanometer.computeWorldMatrix(true);
		const stand = new TransformNode("measurement-stand", this._scene);
		stand.position.copyFrom(center);
		const material = new StandardMaterial("measurement-stand-material", this._scene);
		material.diffuseColor = Color3.FromHexString("#b9c7c7");
		const top = CreateBox("measurement-stand-top", { width: 0.34, height: 0.025, depth: 0.30 }, this._scene);
		top.parent = stand;
		top.position.y = -0.014;
		top.material = material;
		top.isPickable = true;
		top.metadata = { logicalTarget: "instrument-work-surface" };
		const post = CreateCylinder("measurement-stand-post", { diameter: 0.035, height: center.y - 0.06 }, this._scene);
		post.parent = stand;
		post.position.y = -(center.y + 0.06) / 2;
		post.material = material;
		post.isPickable = false;
		const foot = CreateCylinder("measurement-stand-foot", { diameter: 0.24, height: 0.025 }, this._scene);
		foot.parent = stand;
		foot.position.y = 0.025 - center.y;
		foot.material = material;
		foot.isPickable = false;
		const readoutPost = CreateCylinder("measurement-readout-post", { diameter: 0.018, height: 0.276 }, this._scene);
		readoutPost.parent = stand;
		readoutPost.position.set(0, 0.138, -0.10);
		readoutPost.material = material;
		readoutPost.isPickable = false;
		this._measurementStand = stand;
		this._sphygmomanometerPositioned = true;
		this._instrumentControls = splitSphygmomanometer(sphygmomanometer);
		const bulb = this._instrumentControls.find(mesh => mesh.name === "instrument-bulb");
		const valve = this._instrumentControls.find(mesh => mesh.name === "instrument-valve");
		if (bulb && valve) this._handInstruments = new HandInstruments(
			bulb, valve, () => this._useInstrumentControl("instrument-bulb"),
			() => this._useInstrumentControl("instrument-valve"),
			() => Boolean(this._app.getSimulationSnapshot() && !this._app.getSimulationSnapshot()?.completed && this._app.getCurrentSimulationAction()?.type !== "earpieces-placed"),
			() => this._finishInstrumentFeedback(),
		);
		const cuff = this._scene.getMeshByName("fitted-cuff-sleeve");
		if (cuff instanceof Mesh) {
			cuff.setEnabled(true);
			this._cuffHoses = connectCuffInstrument(cuff, sphygmomanometer);
		}
	}

	public handleInstrumentHandFrame(frame: InstrumentHandFrame): boolean {
		return this._handInstruments?.update(frame) ?? false;
	}

	public handleInstrumentHandLost(handId: string): void {
		this._handInstruments?.handLost(handId);
	}

	private _finishInstrumentFeedback(): void {
		if (!this._instrumentFeedback) return;
		this._instrumentFeedback.mesh.scaling.copyFrom(this._instrumentFeedback.rest);
		this._instrumentFeedback.mesh.rotationQuaternion = this._instrumentFeedback.rotation.clone();
		this._instrumentFeedback = null;
	}

	private _useInstrumentControl(target: string): boolean {
		const action = this._app.getCurrentSimulationAction();
		if (!action) return false;
		let accepted = false;
		if (target === "instrument-bulb") {
			if (action.rule === "inflate" || action.rule === "inflate-stop") accepted = this._dispatchInflationIncrement();
			else if (action.type === "pulse-disappeared") accepted = this.executeActiveActionFromScene();
		} else {
			if (["inflation-stopped", "deflation-started", "slow-deflation-performed", "estimation-air-released", "remaining-air-released"].includes(action.type)) {
				accepted = this.executeActiveActionFromScene();
				// Opening the valve after inflation both accepts the stopping
				// point and starts the already configured controlled deflation.
				if (accepted && action.type === "inflation-stopped" && this._app.getCurrentSimulationAction()?.type === "deflation-started") {
					accepted = this.executeActiveActionFromScene();
				}
			} else if (this._app.isPressureDeflationActive()) {
				this._app.togglePressureDeflation();
				accepted = true;
			}
		}
		if (accepted) {
			const control = this._instrumentControls.find(mesh => mesh.metadata?.logicalTarget === target);
			if (control) {
				if (this._instrumentFeedback) {
					this._instrumentFeedback.mesh.scaling.copyFrom(this._instrumentFeedback.rest);
					this._instrumentFeedback.mesh.rotationQuaternion = this._instrumentFeedback.rotation.clone();
				}
				this._instrumentFeedback = {
					mesh: control, rest: control.scaling.clone(),
					rotation: control.rotationQuaternion?.clone() ?? Quaternion.FromEulerVector(control.rotation),
					startedAt: performance.now(),
				};
				if (target === "instrument-bulb") control.scaling.y *= 0.65;
			}
		} else this._showFeedback("Este controle não está disponível nesta etapa. Aperte a pera para inflar; abra a válvula junto à mangueira da pera para desinflar, após atingir a faixa indicada.", false);
		return accepted;
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
			this._updateVisualMotions();
			this._updateSpokenDialogue();
			if (this._instrumentFeedback) {
				const { mesh, rest, rotation, startedAt } = this._instrumentFeedback;
				const progress = Math.min(1, (performance.now() - startedAt) / 180);
				if (mesh.metadata?.logicalTarget === "instrument-bulb") mesh.scaling.y = rest.y * (0.65 + 0.35 * progress);
				else mesh.rotationQuaternion = rotation.multiply(Quaternion.RotationAxis(Vector3.Up(), 0.35 * (1 - progress)));
				if (progress === 1) this._instrumentFeedback = null;
			}
			this._facePressureBoardToLearner();

			if (this._arrowRoot) {
				Vector3.LerpToRef(this._arrowRoot.position, this._targetLerpPosition, 0.12, this._arrowRoot.position);
				this._arrowRoot.position.y = this._targetLerpPosition.y + Math.sin(time) * 0.04;
				this._arrowRoot.rotation.y += 0.02;
			}

			if (this._dialogueTriggerRoot) {
				this._dialogueTriggerRoot.position.y = clinicalLayout.dialogueTrigger[1] + Math.sin(time * 0.7) * 0.025;
				const camera = this._scene.activeCamera;
				if (camera) {
					this._dialogueTriggerRoot.lookAt(camera.position, Math.PI);
				}
			}
		});
	}

	private _initXrSlate(): void {
		const slateRoot = new TransformNode("xr-guidance-slate-root", this._scene);
		// Offset it into the room so the wall mesh cannot occlude the slate.
		slateRoot.position.fromArray(clinicalLayout.xrSlate);
		// CreatePlane's front normal is local -Z, so rotate that normal toward +X
		// (into the room) rather than turning the text away from the learner.
		slateRoot.rotation.y = -Math.PI / 2;
		const plane = CreatePlane("xr-guidance-slate", { width: 0.95, height: 0.50 }, this._scene);
		plane.parent = slateRoot;
		plane.isPickable = false;

		const texture = new DynamicTexture("xr-guidance-texture", { width: 1024, height: 512 }, this._scene, false);
		texture.hasAlpha = true;

		const mat = new StandardMaterial("xr-guidance-slate-mat", this._scene);
		mat.diffuseTexture = texture;
		mat.useAlphaFromDiffuseTexture = true;
		mat.emissiveColor = Color3.White();
		mat.specularColor = Color3.Black();
		mat.backFaceCulling = false;
		plane.material = mat;

		this._xrSlateRoot = slateRoot;
		this._xrSlatePlane = plane;
		this._xrSlateTexture = texture;
		const confirmTarget = CreatePlane("xr-guidance-confirm-action", { width: 0.20, height: 0.065 }, this._scene);
		confirmTarget.parent = slateRoot;
		confirmTarget.position.set(0.11, -0.125, -0.004);
		const confirmMaterial = new StandardMaterial("xr-guidance-confirm-action-material", this._scene);
		confirmMaterial.diffuseColor = Color3.White();
		confirmMaterial.emissiveColor = Color3.White();
		confirmMaterial.alpha = 0.001;
		confirmMaterial.disableDepthWrite = true;
		confirmTarget.material = confirmMaterial;
		confirmTarget.isPickable = true;
		confirmTarget.metadata = { logicalTarget: "confirm-action" };
		confirmTarget.setEnabled(false);
		this._xrConfirmationTarget = confirmTarget;
		const inflateTarget = CreatePlane("xr-guidance-inflate-action", { width: 0.20, height: 0.065 }, this._scene);
		inflateTarget.parent = slateRoot;
		inflateTarget.position.set(-0.11, -0.125, -0.004);
		inflateTarget.material = confirmMaterial;
		inflateTarget.isPickable = true;
		inflateTarget.metadata = { logicalTarget: "inflate-action" };
		inflateTarget.setEnabled(false);
		this._xrInflateTarget = inflateTarget;
		const deflationPauseTarget = CreatePlane("xr-guidance-deflation-pause-action", { width: 0.20, height: 0.065 }, this._scene);
		deflationPauseTarget.parent = slateRoot;
		deflationPauseTarget.position.set(0, -0.125, -0.004);
		deflationPauseTarget.material = confirmMaterial;
		deflationPauseTarget.isPickable = true;
		deflationPauseTarget.metadata = { logicalTarget: "deflation-pause-action" };
		deflationPauseTarget.setEnabled(false);
		this._xrDeflationPauseTarget = deflationPauseTarget;
		this._initXrDialogueTargets(slateRoot);
	}

	private _initXrPressureBoard(): void {
		const root = new TransformNode("xr-pressure-board-root", this._scene);
		// The plane's front points along local -Z. Face it toward the right-arm
		// station and keep the board orientation fixed there.
		root.rotation.y = 0;
		root.setEnabled(true);
		const frame = CreateBox("xr-pressure-board-frame", { width: 0.58, height: 0.40, depth: 0.025 }, this._scene);
		frame.parent = root;
		const frameMaterial = new StandardMaterial("xr-pressure-board-frame-material", this._scene);
		frameMaterial.diffuseColor = Color3.FromHexString("#1B5947");
		frameMaterial.emissiveColor = Color3.FromHexString("#102E25");
		frame.material = frameMaterial;
		frame.isPickable = false;

		const surface = CreatePlane("xr-pressure-board-surface", { width: 0.54, height: 0.36 }, this._scene);
		surface.parent = root;
		// Put the readable surface on the learner-facing side of the frame.
		surface.position.z = -0.014;
		surface.isPickable = false;
		const texture = new DynamicTexture("xr-pressure-board-texture", { width: 768, height: 512 }, this._scene, false);
		const surfaceMaterial = new StandardMaterial("xr-pressure-board-surface-material", this._scene);
		surfaceMaterial.diffuseTexture = texture;
		surfaceMaterial.emissiveColor = Color3.White();
		surfaceMaterial.backFaceCulling = false;
		surface.material = surfaceMaterial;

		const targetMaterial = new StandardMaterial("xr-pressure-board-target-material", this._scene);
		targetMaterial.diffuseColor = Color3.White();
		targetMaterial.emissiveColor = Color3.White();
		targetMaterial.alpha = 0.001;
		targetMaterial.disableDepthWrite = true;
		const makeTarget = (name: string, logicalTarget: string): Mesh => {
			const target = CreatePlane(name, { width: 0.24, height: 0.065 }, this._scene);
			target.parent = root;
			target.position.set(0, -0.122, -0.022);
			target.material = targetMaterial;
			target.isPickable = true;
			target.metadata = { logicalTarget };
			target.setEnabled(false);
			return target;
		};

		this._xrPressureBoardRoot = root;
		this._xrPressureBoardTexture = texture;
		this._xrPressureConfirmTarget = makeTarget("xr-pressure-board-confirm", "confirm-action");
		this._xrPressureInflateTarget = makeTarget("xr-pressure-board-inflate", "inflate-action");
		this._xrPressurePauseTarget = makeTarget("xr-pressure-board-pause", "deflation-pause-action");
	}

	private _positionXrPressureBoard(): void {
		const root = this._xrPressureBoardRoot;
		if (!root) return;
		const stand = this._measurementStand;
		if (!stand) return;
		root.scaling.setAll(0.32);
		// Keep the complete panel above the back edge of the stand, not the arm.
		root.position.copyFrom(stand.position).addInPlace(new Vector3(0, 0.34, -0.10));
		this._facePressureBoardToLearner();
	}

	private _facePressureBoardToLearner(): void {
		const root = this._xrPressureBoardRoot;
		const camera = this._scene.activeCamera;
		if (!root || !camera || !root.isEnabled()) return;
		const direction = camera.globalPosition.subtract(root.position);
		if (direction.x * direction.x + direction.z * direction.z > 0.01) {
			// The readable plane faces local -Z. Rotate the frame with it.
			root.rotation.y = Math.atan2(-direction.x, -direction.z);
		}
	}

	private _renderXrPressureBoard(pressure: number): void {
		const texture = this._xrPressureBoardTexture;
		if (!texture) return;
		this._xrPressureBoardLastPressure = Math.round(pressure * 4) / 4;
		const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
		ctx.clearRect(0, 0, 768, 512);
		ctx.fillStyle = "#FFFFFF";
		ctx.fillRect(0, 0, 768, 512);
		ctx.strokeStyle = "#1B5947";
		ctx.lineWidth = 8;
		ctx.strokeRect(8, 8, 752, 496);
		ctx.fillStyle = "#17252b";
		ctx.beginPath();
		ctx.roundRect(20, 18, 728, 476, 22);
		ctx.fill();
		ctx.strokeStyle = "#dce6e8";
		ctx.lineWidth = 5;
		ctx.stroke();
		ctx.fillStyle = "#ffffff";
		ctx.textAlign = "center";
		ctx.font = "bold 30px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("PRESSÃO NO MANGUITO", 384, 58);
		const cx = 384, cy = 285, radius = 180;
		ctx.strokeStyle = "#c8d8dc";
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.arc(cx, cy, radius, Math.PI, Math.PI * 2);
		ctx.stroke();
		for (let i = 0; i <= 30; i++) {
			const angle = Math.PI + (i / 30) * Math.PI;
			const inner = radius - (i % 5 === 0 ? 22 : 11);
			ctx.beginPath();
			ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
			ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
			ctx.stroke();
		}
		ctx.fillStyle = "#ffffff";
		ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("0", cx - radius + 12, 310);
		ctx.fillText("150", cx, 310);
		ctx.fillText("300", cx + radius - 12, 310);
		const value = Math.max(0, Math.min(300, pressure));
		const needleAngle = Math.PI + (value / 300) * Math.PI;
		ctx.strokeStyle = "#ff5b55";
		ctx.lineWidth = 9;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + Math.cos(needleAngle) * (radius - 28), cy + Math.sin(needleAngle) * (radius - 28));
		ctx.stroke();
		ctx.fillStyle = "#ff5b55";
		ctx.beginPath();
		ctx.arc(cx, cy, 13, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#ffffff";
		ctx.font = "bold 30px 'Segoe UI', Arial, sans-serif";
		ctx.fillText(`${Math.round(value)} mmHg`, cx, 355);
		ctx.textAlign = "left";
		ctx.fillStyle = "#ffffff";
		ctx.font = "20px 'Segoe UI', Arial, sans-serif";
		this._drawWrappedText(ctx, this._xrPressureBoardInstruction || "Acompanhe a pressão do manguito.", 36, 390, 696, 25);

		const pairedControls = Boolean(
			(this._xrPressureBoardCanInflate && this._xrPressureBoardConfirmation)
			|| (this._xrPressureBoardDeflationControl && this._xrPressureBoardConfirmation)
		);
		const controls: Array<{ label: string; x: number; width: number }> = [];
		if (this._xrPressureBoardCanInflate) controls.push({ label: "＋ Inflar +10", x: pairedControls ? 36 : 169, width: pairedControls ? 330 : 430 });
		if (this._xrPressureBoardDeflationControl) {
			controls.push({ label: this._xrPressureBoardDeflationControl, x: pairedControls ? 36 : 169, width: pairedControls ? 330 : 430 });
		}
		if (this._xrPressureBoardConfirmation) {
			controls.push({ label: `✓ ${this._xrPressureBoardConfirmation}`, x: pairedControls ? 402 : 169, width: pairedControls ? 330 : 430 });
		}
		ctx.font = "bold 23px 'Segoe UI', Arial, sans-serif";
		for (const control of controls) {
			ctx.fillStyle = "#08765A";
			ctx.beginPath();
			ctx.roundRect(control.x, 414, control.width, 66, 12);
			ctx.fill();
			ctx.fillStyle = "#FFFFFF";
			ctx.textAlign = "center";
			ctx.fillText(control.label, control.x + control.width / 2, 455, control.width - 16);
		}
		ctx.textAlign = "left";
		texture.update();

		this._xrPressureInflateTarget?.setEnabled(this._xrPressureBoardCanInflate);
		this._xrPressureConfirmTarget?.setEnabled(Boolean(this._xrPressureBoardConfirmation));
		this._xrPressurePauseTarget?.setEnabled(Boolean(this._xrPressureBoardDeflationControl));
		if (this._xrPressureInflateTarget) {
			this._xrPressureInflateTarget.position.x = pairedControls ? -0.13 : 0;
			this._xrPressureInflateTarget.scaling.x = pairedControls ? 1 : 1.25;
		}
		if (this._xrPressureConfirmTarget) {
			this._xrPressureConfirmTarget.position.x = pairedControls ? 0.13 : 0;
			this._xrPressureConfirmTarget.scaling.x = pairedControls ? 1 : 1.25;
		}
		if (this._xrPressurePauseTarget) {
			this._xrPressurePauseTarget.position.x = pairedControls ? -0.13 : 0;
			this._xrPressurePauseTarget.scaling.x = pairedControls ? 1 : 1.25;
		}
	}

	private _initXrDialogueTargets(slateRoot: TransformNode): void {
		const topics = [
			{ id: "identify-patient", y: 180 },
			{ id: "check-readiness", y: 225 },
			{ id: "explain-and-rest", y: 270 },
			{ id: "inform-patient", y: 315 },
		] as const;
		const targetMaterial = new StandardMaterial("xr-dialogue-target-material", this._scene);
		targetMaterial.diffuseColor = Color3.White();
		targetMaterial.emissiveColor = Color3.White();
		targetMaterial.alpha = 0.001;
		targetMaterial.disableDepthWrite = true;

		for (const topic of topics) {
			const target = CreatePlane(`xr-dialogue-topic-${topic.id}`, { width: 0.79, height: 0.034 }, this._scene);
			target.parent = slateRoot;
			target.position.set(0, 0.21 - (topic.y / 512) * 0.42, -0.003);
			target.material = targetMaterial;
			target.isPickable = true;
			target.metadata = { logicalTarget: "dialogue-topic", topicId: topic.id };
			this._xrDialogueTargets.push(target);
		}

		const closeTarget = CreatePlane("xr-dialogue-close-target", { width: 0.12, height: 0.06 }, this._scene);
		closeTarget.parent = slateRoot;
		closeTarget.position.set(0.32, 0.152, -0.003);
		closeTarget.material = targetMaterial;
		closeTarget.isPickable = true;
		closeTarget.metadata = { logicalTarget: "dialogue-close" };
		this._xrDialogueTargets.push(closeTarget);
	}

	private _initDialogueTrigger(): void {
		const triggerRoot = new TransformNode("patient-dialogue-trigger-root", this._scene);
		triggerRoot.position.fromArray(clinicalLayout.dialogueTrigger);

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
			const doubleTap = pointerInfo.type === PointerEventTypes.POINTERDOUBLETAP;
			if (pointerInfo.type !== PointerEventTypes.POINTERPICK && !doubleTap) return;
			const mesh = pointerInfo.pickInfo?.pickedMesh as Mesh | undefined;
			if (!mesh) return;

			// The valve is small and its tube belongs to the surrounding mesh.
			// Accept a narrow margin on the real parts, without visible proxy controls.
			const point = pointerInfo.pickInfo?.pickedPoint;
			const logicalTarget = mesh.metadata?.logicalTarget ?? this._resolveLogicalTarget(mesh.name);
			// A closed pumping hand can also emit XR pinch-ray picks. The held
			// assembly uses grip cycles/free-hand contact, avoiding duplicate actions.
			if (this._handInstruments?.isHolding && ["instrument-bulb", "instrument-valve"].includes(logicalTarget)) return;
			if (this._handInstruments && performance.now() - this._handInstruments.lastValveTouch < 300 && logicalTarget === "instrument-valve") return;
			// A rapid second press is a double tap rather than POINTERPICK.
			// Count it for pressure controls only; confirmations keep single-click semantics.
			if (doubleTap && !["instrument-bulb", "instrument-valve", "inflate-action", "gauge", "instrument-work-surface", "restart-session"].includes(logicalTarget)) return;
			if (point && ["gauge", "instrument-work-surface"].includes(logicalTarget)) {
				const nearby = this._instrumentControls.map(part => {
					part.computeWorldMatrix(true);
					const box = part.getBoundingInfo().boundingBox;
					const closest = Vector3.Clamp(point, box.minimumWorld, box.maximumWorld);
					return { part, distance: Vector3.Distance(point, closest), centerDistance: Vector3.Distance(point, box.centerWorld) };
				}).filter(candidate => candidate.distance <= 0.012)
					.sort((a, b) => a.centerDistance - b.centerDistance)[0];
				if (nearby) {
					if (this._handInstruments?.isHolding || (this._handInstruments && performance.now() - this._handInstruments.lastValveTouch < 300)) return;
					this.handleMeshInteraction(nearby.part);
					return;
				}
			}
			if (doubleTap && ["gauge", "instrument-work-surface"].includes(logicalTarget)) return;
			this.handleMeshInteraction(mesh);
		});
	}

	public handleMeshInteraction(mesh: Mesh): boolean {
		if (this._restartPanel?.handlePick(mesh)) return true;
		const logicalTarget = mesh.metadata?.logicalTarget ?? this._resolveLogicalTarget(mesh.name);
		if (logicalTarget === "instrument-bulb" || logicalTarget === "instrument-valve") return this._useInstrumentControl(logicalTarget);
		if (logicalTarget === "dialogue-topic") {
			if (!this._dialogueOpen) return false;
			const topicId = mesh.metadata?.topicId as "identify-patient" | "check-readiness" | "explain-and-rest" | "inform-patient" | undefined;
			if (!topicId) return false;
			this.triggerDialogueTopic(topicId);
			return true;
		}
		if (logicalTarget === "dialogue-close") {
			if (!this._dialogueOpen) return false;
			this.closeDialogueModal();
			return true;
		}
		if (logicalTarget === "confirm-action") {
			if (!this._getConfirmationLabel(this._app.getCurrentSimulationAction()?.type)) return false;
			return this.executeActiveActionFromScene();
		}
		if (logicalTarget === "inflate-action") return this._dispatchInflationIncrement();
		if (logicalTarget === "deflation-pause-action") {
			this._app.togglePressureDeflation();
			return true;
		}

		const snapshot = this._app.getSimulationSnapshot();
		const currentAction = this._app.getCurrentSimulationAction();
		if (!snapshot || !currentAction) return false;
		if (currentAction.rule === "inflate" || currentAction.rule === "inflate-stop") {
			this._showFeedback("Aperte a pera para inflar; use a válvula para iniciar a deflação. Os botões do painel também estão disponíveis.", false);
			return false;
		}

		if (!logicalTarget) return false;
		const meshArm = mesh.metadata?.arm as "esquerdo" | "direito" | undefined;
		if (["patient-arm", "patient-wrist", "cuff"].includes(logicalTarget)
			&& meshArm && meshArm !== snapshot.config.arm) {
			this._showFeedback(`Use o braço ${snapshot.config.arm} durante toda esta medição.`, false);
			this._audio.playChime(false);
			return false;
		}

		// Keep communication on its explicit overhead trigger, away from instrument work.
		if (logicalTarget === "dialogue-trigger" || mesh.name === "patient-dialogue-trigger") {
			this.openDialogueModal();
			return true;
		}

		// Check if the interaction target matches the active physical action requirement
		if (logicalTarget !== currentAction.target) {
			if (this._isEvaluationMode()) {
				// Without guidance, choosing the wrong object is part of the assessment:
				// submit it so the controller records a rejected attempt for the debrief.
				this._app.dispatchSimulationEvent({ type: currentAction.type, target: logicalTarget, value: true });
				this._showFeedback("Esta não é a próxima etapa do procedimento.", false);
			} else {
				const expectedName = targetInfo[currentAction.target]?.label ?? currentAction.target;
				this._showFeedback(`Alvo incorreto: a etapa atual requer interação com: ${expectedName}. Siga a seta indicadora.`, false);
			}
			this._audio.playChime(false);
			return false;
		}
		if (currentAction.type === "earpieces-placed"
			&& this._scene.activeCamera?.name.toLowerCase().includes("webxr")) {
			this._showFeedback("Feche a mão perto do estetoscópio para pegá-lo. Leve-o até a cabeça e abra a mão para colocá-lo.", true);
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

	private _resolveTargetPosition(targetKey: string, actionType?: string): Vector3 {
		if (actionType === "cubital-artery-palpated" || actionType === "chestpiece-placed") {
			const armSide = this._app.getSimulationSnapshot()?.config.arm ?? "direito";
			const arm = this._scene.getMeshByName(`patient-forearm-${armSide}`);
			const wrist = this._scene.getMeshByName(`patient-wrist-${armSide}`);
			if (arm && wrist) {
				// The cubital fossa sits just distal to the elbow, between the arm and wrist anchors.
				return Vector3.Lerp(arm.getAbsolutePosition(), wrist.getAbsolutePosition(), 0.3)
					.addInPlace(new Vector3(0, 0.025, 0));
			}
		}

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
				if (patient) return patient.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.85, 0));
				break;
			}
			case "dialogue-trigger": {
				if (this._dialogueTriggerRoot) return this._dialogueTriggerRoot.position.clone();
				break;
			}
			case "patient-arm": {
				const armSide = this._app.getSimulationSnapshot()?.config.arm ?? "direito";
				const arm = this._scene.getMeshByName(`patient-forearm-${armSide}`);
				if (arm) return arm.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.15, 0));
				break;
			}
			case "cuff": {
				const armSide = this._app.getSimulationSnapshot()?.config.arm ?? "direito";
				const sleeve = this._scene.getMeshByName("fitted-cuff-sleeve");
				if (sleeve) return sleeve.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.16, 0));
				const arm = this._scene.getMeshByName(`patient-forearm-${armSide}`);
				if (arm) return arm.getAbsolutePosition().clone().addInPlace(new Vector3(0, 0.16, 0));
				break;
			}
			case "patient-wrist": {
				const armSide = this._app.getSimulationSnapshot()?.config.arm ?? "direito";
				const wrist = this._scene.getMeshByName(`patient-wrist-${armSide}`);
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
				if (sphygmo) {
					const bounds = sphygmo.getHierarchyBoundingVectors(true);
					return new Vector3((bounds.min.x + bounds.max.x) / 2, bounds.max.y + 0.08, (bounds.min.z + bounds.max.z) / 2);
				}
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
				event = { type: action.type, target: action.target, value: "bell" };
				break;
			case "inflation-stopped":
				event = { type: action.type, target: "cuff", value: true };
				break;
			case "rapid-inflation-increment": {
				const targetPressure = snapshot.instruments.cuffPressure + clinicalParameters.inflation.increment;
				event = { type: action.type, target: "cuff", value: targetPressure };
				break;
			}
			case "deflation-started":
				event = { type: action.type, target: "cuff", value: 2 };
				break;
			case "first-sound-recorded":
				event = { type: action.type, target: "gauge", value: this._roundedReading(snapshot.instruments.cuffPressure) };
				break;
			case "regular-beats-confirmed":
				event = { type: action.type, target: "stethoscope", value: true };
				break;
			case "sound-disappearance-recorded":
			case "muffling-recorded":
				event = { type: action.type, target: "gauge", value: this._roundedReading(snapshot.instruments.cuffPressure) };
				break;
			case "disappearance-confirmed": {
				event = { type: action.type, target: "stethoscope", value: this._roundedReading(snapshot.instruments.cuffPressure) };
				break;
			}
			case "cuff-removed":
				event = { type: action.type, target: "cuff", value: true };
				break;
			case "three-values-recorded":
			case "measurement-documented": {
				const measuredSystolic = Number(snapshot.observations["identify-systolic:first-sound-recorded"] ?? config.pressure.systolic);
				const diastolicObservation = config.persistentSounds
					? "persistent-sounds:muffling-recorded"
					: "identify-diastolic:sound-disappearance-recorded";
				const measuredDiastolic = Number(snapshot.observations[diastolicObservation] ?? config.pressure.diastolic);
				const record: MeasurementRecord = {
					systolic: measuredSystolic,
					diastolic: measuredDiastolic,
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

	private _roundedReading(pressure: number): number {
		return Math.round(pressure / 2) * 2;
	}

	private _dispatchInflationIncrement(): boolean {
		const snapshot = this._app.getSimulationSnapshot();
		const action = this._app.getCurrentSimulationAction();
		if (!snapshot || !action || (action.rule !== "inflate" && action.rule !== "inflate-stop")) return false;
		const nextPressure = snapshot.instruments.cuffPressure + clinicalParameters.inflation.increment;
		return this.dispatchAction({ type: "rapid-inflation-increment", target: "cuff", value: nextPressure });
	}

	public canGrabStethoscope(): boolean {
		const action = this._app.getCurrentSimulationAction();
		return action?.type === "earpieces-placed";
	}

	public handleHandGrabInteraction(position: Vector3): boolean {
		// Bulb/valve use the dedicated held-grip/contact path; this fallback
		// remains for the other clinical targets and the stethoscope workflow.
		const action = this._app.getCurrentSimulationAction();
		if (!action || action.type === "earpieces-placed"
			|| action.rule === "inflate" || action.rule === "inflate-stop" || action.rule === "deflation") return false;

		const targetPosition = this._resolveTargetPosition(action.target, action.type);
		if (Vector3.Distance(position, targetPosition) > 0.45) return false;

		const targetMesh = this._scene.meshes.find((mesh): mesh is Mesh =>
			mesh instanceof Mesh
			&& (mesh.metadata?.logicalTarget ?? this._resolveLogicalTarget(mesh.name)) === action.target
			&& mesh.isPickable
		);
		if (!targetMesh) return false;

		return this.handleMeshInteraction(targetMesh);
	}

	public handleStethoscopeRelease(position: Vector3): boolean {
		const action = this._app.getCurrentSimulationAction();
		if (!action || !this.canGrabStethoscope()) return false;

		const camera = this._scene.activeCamera;
		const destination = camera?.globalPosition ?? null;
		const tolerance = 0.65;
		if (!destination || Vector3.Distance(position, destination) > tolerance) {
			this._showFeedback("Leve o estetoscópio até o local indicado antes de soltá-lo.", false);
			this._audio.playChime(false);
			return false;
		}

		const stethoscope = this._scene.getTransformNodeByName("stethoscope-root");
		const mesh = stethoscope?.getChildMeshes().find(child => child instanceof Mesh);
		return this.executeActiveActionFromScene(mesh as Mesh | undefined);
	}

	public dispatchAction(event: InteractionEvent): boolean {
		if (this._isSpokenStep()) return false;
		const result = this._app.dispatchSimulationEvent(event);
		if (!result) return false;

		if (result.accepted) {
			this._applyAcceptedVisual(event);
			this._showFeedback(result.feedback || "Ação realizada corretamente.", true);
			this._audio.playChime(true);
			this._updateGuidance();
			return true;
		} else {
			const feedback = event.type === "first-sound-recorded"
				? `Leitura de ${event.value ?? "—"} mmHg não aceita. Pause ao ouvir a primeira batida; se ela já passou, reinicie a sessão para tentar novamente.`
				: result.feedback || "Ação não aceita.";
			this._showFeedback(feedback, false);
			this._audio.playChime(false);
			return false;
		}
	}

	public openDialogueModal(): void {
		if (!this._isEvaluationMode()) return;
		this._dialogueOpen = true;
		this._updateGuidance();
	}

	public closeDialogueModal(): void {
		this._dialogueOpen = false;
		this._updateGuidance();
	}

	public triggerDialogueTopic(topicId: "identify-patient" | "check-readiness" | "explain-and-rest" | "inform-patient"): void {
		if (!this._isEvaluationMode()) return;
		if (topicId === "explain-and-rest") {
			this._app.advanceSimulatedTime(300000);
		}

		const result = this._app.dispatchLateralDialogue(topicId);
		if (!result) return;

		this._lastDialogueText = result.dialogueText;

		if (result.accepted) {
			this._showFeedback(result.feedback, true);
			this._audio.playChime(true);
		} else {
			this._showFeedback(result.feedback, false);
			this._audio.playChime(false);
		}

		this._updateGuidance();
	}

	private _isSpokenStep(): boolean {
		return !this._isEvaluationMode() && spokenTopics.includes(this._app.getSimulationSnapshot()?.currentStepId as SpokenTopic);
	}

	private _renderSpokenDialogue(): void {
		if (!this._guidanceCard) return;
		this._guidanceCard.classList.add("spoken-dialogue-hud");
		const text = this._spokenSubtitle || "Vá à frente do paciente para iniciar a conversa automaticamente.";
		this._guidanceCard.innerHTML = '<h3>Modo de diálogo</h3><p aria-live="polite"></p><small>Áudio em português • legendas automáticas</small>';
		this._guidanceCard.querySelector("p")!.textContent = text;
		this._arrowRoot?.setEnabled(false);
		this._xrDialogueTargets.forEach(target => target.setEnabled(false));
		this._xrPressureBoardRoot?.setEnabled(false);
		this._renderXrSlate(0, "Modo de diálogo", text, "Paciente", "Paciente", null);
		if (this._xrSlateTexture) {
			const ctx = this._xrSlateTexture.getContext() as unknown as CanvasRenderingContext2D;
			ctx.clearRect(0, 0, 1024, 512);
			ctx.fillStyle = "#f4f6f1";
			ctx.strokeStyle = "#1b5947";
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.roundRect(4, 4, 1016, 504, 28);
			ctx.fill();
			ctx.stroke();
			// Green header and soft inset card echo the restart panel's controls.
			ctx.save();
			ctx.beginPath();
			ctx.roundRect(7, 7, 1010, 498, 24);
			ctx.clip();
			ctx.fillStyle = "#1b5947";
			ctx.fillRect(7, 7, 1010, 78);
			ctx.restore();
			ctx.fillStyle = "#ffffff";
			ctx.font = "bold 25px 'Segoe UI', Arial, sans-serif";
			ctx.fillText("CONVERSA COM O PACIENTE", 40, 55);
			const topic = this._app.getSimulationSnapshot()?.currentStepId as SpokenTopic;
			const topicIndex = spokenTopics.indexOf(topic);
			if (topicIndex < 3) {
				for (let index = 0; index < 3; index++) {
					ctx.fillStyle = index <= topicIndex ? "#e2eee5" : "#538171";
					ctx.beginPath();
					ctx.roundRect(820 + index * 52, 36, 40, 10, 5);
					ctx.fill();
				}
			}
			ctx.fillStyle = "#173c34";
			ctx.font = "bold 38px 'Segoe UI', Arial, sans-serif";
			const titles: Record<SpokenTopic, string> = {
				"identify-patient": "1 de 3 · Identificação",
				"check-readiness": "2 de 3 · Condições de preparo",
				"explain-and-rest": "3 de 3 · Orientações e repouso",
				"inform-patient": "Comunicação do resultado",
			};
			ctx.fillText(this._spokenSubtitle ? titles[this._app.getSimulationSnapshot()?.currentStepId as SpokenTopic] ?? "Conversa com o paciente" : "Vamos conversar?", 40, 140);
			ctx.fillStyle = "#e7eee5";
			ctx.beginPath();
			ctx.roundRect(32, 162, 960, 264, 20);
			ctx.fill();
			const isPatient = text.startsWith("Paciente:");
			const speaker = text.startsWith("Profissional:") ? "PROFISSIONAL" : isPatient ? "PACIENTE" : "ORIENTAÇÃO";
			ctx.fillStyle = "#1b5947";
			ctx.font = "bold 23px 'Segoe UI', Arial, sans-serif";
			ctx.fillText(speaker, 54, 204);
			ctx.fillStyle = "#304e43";
			ctx.font = "32px 'Segoe UI', Arial, sans-serif";
			this._drawWrappedText(ctx, text.replace(/^(Profissional|Paciente):\s*/, ""), 54, 252, 916, 38);
			ctx.strokeStyle = "#c7d4ca";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(40, 448);
			ctx.lineTo(984, 448);
			ctx.stroke();
			ctx.fillStyle = "#51685e";
			ctx.font = "25px 'Segoe UI', Arial, sans-serif";
			ctx.fillText(this._spokenSubtitle ? "Vozes sintetizadas • acompanhe as legendas" : "Aproxime-se e olhe para o paciente • início automático", 40, 485);
			this._xrSlateTexture.update();
		}
		if (this._xrSlatePlane) {
			this._xrSlatePlane.scaling.setAll(0.55);
			this._xrSlatePlane.renderingGroupId = 3;
		}
	}

	private _updateSpokenDialogue(): void {
		const root = this._xrSlateRoot;
		const camera = this._scene.activeCamera;
		if (!root || !camera) return;
		if (!this._isSpokenStep()) {
			if (this._slateRestPosition) {
				root.position.copyFrom(this._slateRestPosition);
				if (this._xrSlatePlane) {
					this._xrSlatePlane.scaling.setAll(1);
					this._xrSlatePlane.renderingGroupId = 0;
				}
				root.rotationQuaternion = null;
				root.rotation.copyFrom(this._slateRestRotation!);
				this._slateRestPosition = null;
			}
			return;
		}
		if (!this._slateRestPosition) {
			this._slateRestPosition = root.position.clone();
			this._slateRestRotation = root.rotation.clone();
		}
		root.position.copyFrom(camera.globalPosition.add(camera.getForwardRay().direction.scale(0.85))
			.add(camera.getDirection(Vector3.Down()).scale(0.12)));
		root.rotationQuaternion = Quaternion.FromRotationMatrix(camera.getWorldMatrix());
		const patient = this._scene.getTransformNodeByName("patient-root");
		if (!patient || this._speaking) return;
		const bounds = patient.getHierarchyBoundingVectors(true);
		const center = bounds.min.add(bounds.max).scale(0.5);
		const towardPatient = center.subtract(camera.globalPosition);
		towardPatient.y = 0;
		if (towardPatient.length() > clinicalLayout.dialogueApproachRadius) return;
		const forward = camera.getForwardRay().direction.clone();
		forward.y = 0;
		// Accept natural approach positions around the patient, not a hidden station waypoint.
		if (towardPatient.length() > 0.25 && Vector3.Dot(forward.normalize(), towardPatient.normalize()) < 0.35) return;
		void this._playSpokenTopic(this._app.getSimulationSnapshot()!.currentStepId as SpokenTopic);
	}

	private _speak(text: string, useRecording = true): Promise<void> {
		const recording = useRecording ? this._dialogueAudio.getClip(text, this._app.getSimulationSnapshot()?.config.patient.voiceProfile ?? "male") : undefined;
		if (recording) {
			this._spokenSubtitle = text;
			this._renderSpokenDialogue();
			return this._dialogueAudio.play(recording).then(played => {
				if (!played && !this._disposed) return this._speak(text, false);
			});
		}
		this._spokenSubtitle = text;
		this._renderSpokenDialogue();
		return new Promise(resolve => {
			let finished = false;
			let usingSubtitles = false;
			let timer: ReturnType<typeof setTimeout> | null = null;
			let utterance: SpeechSynthesisUtterance | null = null;
			const clearTimer = () => {
				if (timer !== null) clearTimeout(timer);
				if (this._speechTimer === timer) this._speechTimer = null;
				timer = null;
			};
			const detachSpeech = () => {
				if (!utterance) return;
				utterance.onend = null;
				utterance.onerror = null;
			};
			const finish = () => {
				if (finished) return;
				finished = true;
				clearTimer();
				detachSpeech();
				if (this._speechUtterance === utterance) this._speechUtterance = null;
				if (this._cancelSpeech === finish) this._cancelSpeech = null;
				resolve();
			};
			this._cancelSpeech = finish;
			const fallback = () => {
				if (finished || usingSubtitles || this._disposed) return;
				usingSubtitles = true;
				// Retire the speech watchdog before starting the subtitle reading timer.
				clearTimer();
				detachSpeech();
				if (utterance) window.speechSynthesis.cancel();
				this._spokenSubtitle = text + " (Áudio indisponível; acompanhe a legenda.)";
				this._renderSpokenDialogue();
				timer = setTimeout(finish, Math.max(3500, text.length * 65));
				this._speechTimer = timer;
			};
			if (!("speechSynthesis" in window)) { fallback(); return; }
			utterance = new SpeechSynthesisUtterance(text);
			this._speechUtterance = utterance;
			utterance.lang = "pt-BR";
			utterance.rate = 0.95;
			utterance.voice = window.speechSynthesis.getVoices().find(voice => voice.lang === "pt-BR") ?? null;
			utterance.onend = finish;
			utterance.onerror = fallback;
			// Some browsers neither start nor reject speech without user activation.
			timer = setTimeout(fallback, Math.max(15000, text.length * 160));
			this._speechTimer = timer;
			try {
				window.speechSynthesis.speak(utterance);
			} catch {
				fallback();
			}
		});
	}

	private async _playSpokenTopic(topic: SpokenTopic): Promise<void> {
		this._speaking = true;
		const snapshot = this._app.getSimulationSnapshot()!;
		const config = snapshot.config;
		const systolic = snapshot.observations["identify-systolic:first-sound-recorded"];
		const diastolic = snapshot.observations[config.persistentSounds ? "persistent-sounds:muffling-recorded" : "identify-diastolic:sound-disappearance-recorded"];
		const exchanges: Record<SpokenTopic, [string, string]> = {
			"identify-patient": [dialoguePhrases["identification-professional"], `Paciente: Meu nome é ${config.patient.name} e nasci em ${config.patient.dateOfBirth}.`],
			"check-readiness": [dialoguePhrases["readiness-professional"], dialoguePhrases["readiness-patient"]],
			"explain-and-rest": [dialoguePhrases["explanation-professional"], dialoguePhrases["explanation-patient"]],
			"inform-patient": [`Profissional: Sua pressão medida foi ${systolic} por ${diastolic} milímetros de mercúrio.${config.persistentSounds ? " Os sons persistiram até zero; o abafamento foi registrado." : ""}`, config.patient.voiceProfile === "female" ? dialoguePhrases["results-patient"].replace("Obrigado", "Obrigada") : dialoguePhrases["results-patient"]],
		};
		for (const line of exchanges[topic]) {
			await this._speak(line);
			if (this._disposed) return;
		}
		if (topic === "explain-and-rest") {
			await this._speak(dialoguePhrases["rest-narrator"]);
			if (this._disposed) return;
			this._app.advanceSimulatedTime(300000);
		}
		this._app.completeSpokenDialogue(topic);
		if (this._isSpokenStep()) {
			// Continue the initial exchange without flashing the approach prompt again.
			await this._playSpokenTopic(this._app.getSimulationSnapshot()!.currentStepId as SpokenTopic);
			return;
		}
		this._speaking = false;
		this._spokenSubtitle = "";
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
		this._guidanceCard.classList.remove("spoken-dialogue-hud");

		if (snapshot.completed) {
			this._renderCompletionHUD(snapshot);
			return;
		}

		if (this._isSpokenStep()) {
			this._renderSpokenDialogue();
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

		if (action.target === "gauge") this._moveSphygmomanometerNearPatient();
		const confirmationLabel = this._getConfirmationLabel(action.type);
		const isInflationStep = action.rule === "inflate" || action.rule === "inflate-stop";
		const target = { ...(targetInfo[action.target] ?? { label: action.target, icon: "🎯", station: "overview" as const }) };
		if (isInflationStep) {
			target.label = "Controles de pressão";
			target.icon = "🎛️";
		}
		if (action.target === "patient-arm" || action.target === "patient-wrist" || action.target === "cuff") {
			target.station = snapshot.config.arm;
		}
		if (action.target === "gauge" && this._sphygmomanometerPositioned) {
			target.station = snapshot.config.arm;
		}
		if (confirmationLabel && ["regular-beats-confirmed", "disappearance-confirmed", "sounds-at-zero-confirmed"].includes(action.type)) {
			target.label = "Ausculta";
			target.icon = "👂";
			target.station = snapshot.config.arm;
		}
		const targetPos = this._resolveTargetPosition(
			confirmationLabel && target.label === "Ausculta" ? "patient-arm" : action.target,
			action.type
		);
		this._targetLerpPosition.copyFrom(targetPos);
		const guided = !this._isEvaluationMode();
		this._arrowRoot?.setEnabled(guided && !isInflationStep);

		const progressPercent = this._getProgressPercent(snapshot);
		// Multi-action steps show which action is current so learners can tell
		// that an accepted action registered (B3).
		const actionCount = step.completionConditions.length;
		const actionProgress = actionCount > 1 ? `Ação ${snapshot.actionIndex + 1} de ${actionCount}` : "";
		this._xrConfirmationTarget?.setEnabled(Boolean(confirmationLabel));
		const confirmationHtml = confirmationLabel ? `
			<div class="step-actions-row">
				<button id="hud-confirm-action" class="step-action-button" type="button">✓ ${confirmationLabel}</button>
			</div>
		` : "";
		const firstSoundHint = action.type === "first-sound-recorded"
			? `<p class="step-detail">Ao ouvir a primeira batida, pause a deflação para manter a leitura e então registre a pressão exibida.</p>`
			: "";
		const pressureNow = snapshot.instruments.cuffPressure;
		const estimate = Number(snapshot.observations["estimate-systolic:pulse-reappearance-recorded"] ?? 0);
		const minimumStopPressure = estimate + clinicalParameters.inflation.minAboveEstimate;
		const canInflate = isInflationStep && pressureNow + clinicalParameters.inflation.increment
			<= estimate + clinicalParameters.inflation.maxAboveEstimate;
		const inflationGuidanceHtml = isInflationStep ? `
			<p class="step-detail step-pressure-guidance">
				Estimativa registrada: ${estimate} mmHg. Faixa-alvo: ${minimumStopPressure}–${estimate + clinicalParameters.inflation.maxAboveEstimate} mmHg.
				${action.rule === "inflate-stop"
					? "A leitura atual está dentro da faixa; inicie a deflação. O próximo incremento de 10 mmHg ultrapassaria o limite."
					: "Infle em incrementos de 10 mmHg e inicie a deflação ao atingir a faixa."
			}</p>
		` : "";
		const inflationHtml = canInflate ? `
			<div class="step-actions-row">
				<button id="hud-inflate-button" class="step-action-button" type="button">＋ Inflar +10 mmHg</button>
			</div>
		` : "";
		const canControlDeflation = this._app.isPressureDeflationActive() && pressureNow > 0;
		const deflationControlLabel = canControlDeflation
			? (this._app.isPressureDeflationPaused() ? "▶ Retomar deflação" : "⏸ Pausar deflação")
			: null;
		const deflationControlHtml = deflationControlLabel ? `
			<div class="step-actions-row">
				<button id="hud-deflation-control" class="step-action-button secondary" type="button">${deflationControlLabel}</button>
			</div>
		` : "";
		const pressureHtml = pressureInteractionSteps.includes(step.id) ? `
			<p class="step-detail">Pressão no manguito: <strong id="hud-cuff-pressure-value">${Math.round(pressureNow)} mmHg</strong></p>
		` : "";
		const pressureBoardActive = pressureInteractionSteps.includes(step.id);
		this._xrPressureBoardActive = pressureBoardActive;
		this._xrPressureBoardRoot?.setEnabled(pressureBoardActive);
		this._xrPressureBoardInstruction = pressureBoardActive
			? (isInflationStep ? "Segure a pera; afrouxe e aperte para inflar." : "Toque a válvula com o indicador da mão livre.")
			: "Acompanhe a leitura do manguito durante a medição.";
		if (pressureBoardActive) {
			this._positionXrPressureBoard();
			this._xrPressureBoardCanInflate = canInflate;
			this._xrPressureBoardConfirmation = confirmationLabel;
			this._xrPressureBoardDeflationControl = deflationControlLabel;
			this._renderXrPressureBoard(pressureNow);
		} else {
			this._positionXrPressureBoard();
			this._xrPressureBoardCanInflate = false;
			this._xrPressureBoardConfirmation = null;
			this._xrPressureBoardDeflationControl = null;
			this._xrPressureConfirmTarget?.setEnabled(false);
			this._xrPressureInflateTarget?.setEnabled(false);
			this._xrPressurePauseTarget?.setEnabled(false);
			this._renderXrPressureBoard(pressureNow);
		}

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

		// Evaluation mode keeps the controls needed to operate the instruments but
		// hides the step, its target and the shortcut to the right station.
		const headline = guided ? step.prompt : unguidedHeadline;
		const detail = guided ? action.prompt : unguidedDetail;
		this._guidanceCard.innerHTML = `
			<div class="guidance-header">
				<span class="step-counter-badge">Progresso geral: ${progressPercent}%</span>
				<span class="step-target-badge">${guided ? `${target.icon} ${target.label}` : "🎓 Sem orientação"}</span>
			</div>
			<h3 class="step-headline">${headline}</h3>
			${guided && actionProgress ? `<p class="step-action-progress">${actionProgress}</p>` : ""}
			<p class="step-detail">${detail}</p>

			${pressureHtml}
			${this._sphygmomanometerPositioned && (pressureInteractionSteps.includes(step.id) || step.id === "estimate-systolic") ? `<p class="step-detail">Em XR, feche a mão perto da pera para pegá-la; afrouxe e aperte os dedos para bombear (+10 mmHg). Abra a mão por um instante para devolvê-la à mesa. Toque a válvula metálica com o indicador da mão livre para iniciar, pausar ou retomar a deflação. No computador, clique na pera ou na válvula.</p>` : ""}
			${firstSoundHint}
			${inflationHtml}
			${deflationControlHtml}
			${inflationGuidanceHtml}
			${timerHtml}
			${confirmationHtml}

			<div class="step-actions-row">
				<button id="hud-open-dialogue-btn" class="button secondary" type="button" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
					💬 Diálogo com o Paciente (Ações Não-Bloqueantes)
				</button>
			</div>

			${guided ? `<div class="step-actions-row">
				<button id="hud-goto-station-button" class="button secondary" type="button" style="width: 100%; font-size: 13px;">
					📍 Ir até a estação (${target.station})
				</button>
			</div>` : ""}

			<div class="step-progress-container">
				<div class="step-progress-track">
					<div class="step-progress-fill" style="width: ${progressPercent}%;"></div>
				</div>
			</div>
			<div class="step-toast-feedback" id="hud-toast" hidden></div>
		`;

		if (!this._isEvaluationMode()) this._guidanceCard.querySelector("#hud-open-dialogue-btn")?.remove();
		const dialogueBtn = this._guidanceCard.querySelector("#hud-open-dialogue-btn") as HTMLButtonElement | null;
		dialogueBtn?.addEventListener("click", () => {
			this.openDialogueModal();
		});

		const timerBtn = this._guidanceCard.querySelector("#hud-timer-button") as HTMLButtonElement | null;
		timerBtn?.addEventListener("click", () => {
			this._app.advanceSimulatedTime(60000);
			this.dispatchAction({ type: "estimation-wait-finished", target: "cuff", value: true });
		});
		const confirmBtn = this._guidanceCard.querySelector("#hud-confirm-action") as HTMLButtonElement | null;
		confirmBtn?.addEventListener("click", () => this.executeActiveActionFromScene());
		const inflateBtn = this._guidanceCard.querySelector("#hud-inflate-button") as HTMLButtonElement | null;
		inflateBtn?.addEventListener("click", () => this._dispatchInflationIncrement());
		const deflationControlBtn = this._guidanceCard.querySelector("#hud-deflation-control") as HTMLButtonElement | null;
		deflationControlBtn?.addEventListener("click", () => this._app.togglePressureDeflation());

		const gotoBtn = this._guidanceCard.querySelector("#hud-goto-station-button") as HTMLButtonElement | null;
		gotoBtn?.addEventListener("click", () => {
			this._app.moveToStation(target.station);
		});

		// Update in-headset 3D slate
		if (guided) {
			const xrInstruction = actionProgress ? `${actionProgress} • ${action.prompt}` : action.prompt;
			this._renderXrSlate(progressPercent, step.prompt, xrInstruction, target.label, target.station, confirmationLabel, canInflate, deflationControlLabel, pressureBoardActive);
		} else {
			this._renderXrSlate(progressPercent, unguidedHeadline, unguidedDetail, "—", "—", confirmationLabel, canInflate, deflationControlLabel, pressureBoardActive);
		}
	}

	private _getConfirmationLabel(actionType?: string): string | null {
		switch (actionType) {
			case "inflation-stopped": return "Iniciar deflação";
			case "deflation-started": return "Iniciar deflação";
			case "estimation-air-released": return "Liberar todo o ar";
			case "remaining-air-released": return "Liberar o ar restante";
			case "regular-beats-confirmed": return "Confirmar batidas regulares";
			case "disappearance-confirmed": return "Confirmar desaparecimento dos sons";
			case "sounds-at-zero-confirmed": return "Confirmar sons até zero";
			case "pulse-reappearance-recorded": return "Registrar estimativa sistólica";
			case "first-sound-recorded": return "Registrar primeiro som";
			case "sound-disappearance-recorded": return "Registrar pressão diastólica";
			case "muffling-recorded": return "Registrar pressão de abafamento";
			default: return null;
		}
	}

	private _getProgressPercent(snapshot: SessionState): number {
		const completedCount = Object.values(snapshot.steps).filter(step =>
			step.status === "completed" || step.status === "skipped"
		).length;
		return Math.round((completedCount / auscultatoryScenario.length) * 100);
	}

	private _renderDialogueHUD(snapshot: SessionState): void {
		if (!this._guidanceCard) return;
		this._xrConfirmationTarget?.setEnabled(false);
		const progressPercent = this._getProgressPercent(snapshot);

		const isStepDone = (id: string) => snapshot.steps[id]?.status === "completed";
		const done5 = isStepDone("identify-patient");
		const done6 = isStepDone("check-readiness");
		const done7 = isStepDone("explain-and-rest");
		const done23 = isStepDone("inform-patient");

		this._guidanceCard.innerHTML = `
			<div class="guidance-header">
				<span class="step-counter-badge" style="background: #0288d1;">Progresso geral: ${progressPercent}%</span>
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
						<span class="topic-title">👤 Identificação do Paciente</span>
						<span class="topic-status-badge ${done5 ? 'badge-done' : 'badge-pending'}">${done5 ? '✓ Realizado' : 'Pendente'}</span>
					</div>
					<p class="topic-description">Apresentar-se e confirmar nome completo e data de nascimento no leito.</p>
				</button>

				<button class="dialogue-topic-button ${done6 ? 'completed' : ''}" data-topic="check-readiness">
					<div class="topic-header">
						<span class="topic-title">📋 Condições de Preparo</span>
						<span class="topic-status-badge ${done6 ? 'badge-done' : 'badge-pending'}">${done6 ? '✓ Realizado' : 'Pendente'}</span>
					</div>
					<p class="topic-description">Verificar bexiga vazia, repouso de 90 min de exercícios e 30 min sem café/fumo.</p>
				</button>

				<button class="dialogue-topic-button ${done7 ? 'completed' : ''}" data-topic="explain-and-rest">
					<div class="topic-header">
						<span class="topic-title">⏳ Orientações e Repouso</span>
						<span class="topic-status-badge ${done7 ? 'badge-done' : 'badge-pending'}">${done7 ? '✓ Realizado' : 'Pendente'}</span>
					</div>
					<p class="topic-description">Explicar o exame, instruir silêncio e realizar repouso calmo de 5 minutos.</p>
				</button>

				<button class="dialogue-topic-button ${done23 ? 'completed' : ''}" data-topic="inform-patient">
					<div class="topic-header">
						<span class="topic-title">📢 Comunicação de Resultados</span>
						<span class="topic-status-badge ${done23 ? 'badge-done' : 'badge-pending'}">${done23 ? '✓ Realizado' : 'Pendente'}</span>
					</div>
					<p class="topic-description">Informar os valores de pressão arterial aferidos e condutas ao paciente.</p>
				</button>
			</div>
			<div class="step-progress-container">
				<div class="step-progress-track">
					<div class="step-progress-fill" style="width: ${progressPercent}%;"></div>
				</div>
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
		this._renderXrSlateDialogue(done5, done6, done7, done23, progressPercent);
	}

	private _renderCompletionHUD(snapshot: SessionState): void {
		if (!this._guidanceCard) return;
		this._xrConfirmationTarget?.setEnabled(false);

		const report = buildDebrief(snapshot);
		this._guidanceCard.innerHTML = renderDebriefHtml(report);

		const restartBtn = this._guidanceCard.querySelector("#debrief-restart-btn") as HTMLButtonElement | null;
		restartBtn?.addEventListener("click", () => {
			void this._app.restartSimulation();
		});

		const menuBtn = this._guidanceCard.querySelector("#debrief-menu-btn") as HTMLButtonElement | null;
		menuBtn?.addEventListener("click", () => {
			this._app.returnToMenu();
		});

		this._renderXrSlateDebrief(report);
	}

	private _renderXrSlate(progressPercent: number, title: string, instruction: string, targetName: string, station: string, confirmationLabel: string | null, canInflate = false, deflationControlLabel: string | null = null, pressureBoardActive = false): void {
		if (!this._xrSlateTexture) return;
		const ctx = this._xrSlateTexture.getContext() as unknown as CanvasRenderingContext2D;
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
		ctx.fillText(`PROGRESSO GERAL: ${progressPercent}% • ESTAÇÃO: ${station.toUpperCase()}`, 40, 70);

		ctx.fillStyle = "#81C784";
		ctx.font = "bold 28px 'Segoe UI', Arial, sans-serif";
		ctx.fillText(`🎯 Alvo: ${targetName}`, 40, 120);

		ctx.fillStyle = "#FFFFFF";
		ctx.font = "bold 38px 'Segoe UI', Arial, sans-serif";
		this._drawWrappedText(ctx, title, 40, 185, 940, 46);

		ctx.fillStyle = "#E0E0E0";
		ctx.font = "30px 'Segoe UI', Arial, sans-serif";
		this._drawWrappedText(ctx, instruction, 40, 310, 940, 40);

		if (pressureBoardActive) {
			ctx.fillStyle = "#80DEEA";
			ctx.font = "italic 26px 'Segoe UI', Arial, sans-serif";
			ctx.fillText("Segure a pera; afrouxe e aperte a mão para bombear.", 40, 440);
			ctx.fillText("Toque a válvula com o indicador da mão livre.", 40, 472);
		} else if (canInflate) {
			ctx.fillStyle = "#08765A";
			ctx.beginPath();
			ctx.roundRect(confirmationLabel ? 270 : 300, 390, confirmationLabel ? 220 : 424, 62, 14);
			ctx.fill();
			ctx.fillStyle = "#FFFFFF";
			ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
			ctx.textAlign = "center";
			ctx.fillText("＋ Inflar +10 mmHg", confirmationLabel ? 380 : 512, 430);
			ctx.textAlign = "left";
		}
		if (!pressureBoardActive && deflationControlLabel) {
			const paired = Boolean(confirmationLabel);
			const buttonX = paired ? 40 : 300;
			const buttonWidth = paired ? 430 : 424;
			ctx.fillStyle = "#08765A";
			ctx.beginPath();
			ctx.roundRect(buttonX, 390, buttonWidth, 62, 14);
			ctx.fill();
			ctx.fillStyle = "#FFFFFF";
			ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(deflationControlLabel, buttonX + buttonWidth / 2, 430);
			if (confirmationLabel) {
				ctx.fillStyle = "#08765A";
				ctx.beginPath();
				ctx.roundRect(554, 390, 430, 62, 14);
				ctx.fill();
				ctx.fillStyle = "#FFFFFF";
				ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
				ctx.fillText(`✓ ${confirmationLabel}`, 769, 430);
			}
			ctx.textAlign = "left";
		}
		if (!pressureBoardActive && confirmationLabel && !deflationControlLabel) {
			ctx.fillStyle = "#08765A";
			ctx.beginPath();
			ctx.roundRect(canInflate ? 520 : 300, 390, canInflate ? 250 : 424, 62, 14);
			ctx.fill();
			ctx.fillStyle = "#FFFFFF";
			ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(`✓ ${confirmationLabel}`, canInflate ? 645 : 512, 430);
			ctx.textAlign = "left";
		} else if (!pressureBoardActive && !canInflate && !deflationControlLabel) {
			ctx.fillStyle = "#FFD54F";
			ctx.font = "italic 26px 'Segoe UI', Arial, sans-serif";
			ctx.fillText("Interaja com o objeto 3D • Use o ícone de diálogo para falar com o paciente", 40, 465);
		}

		ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
		ctx.font = "18px 'Segoe UI', Arial, sans-serif";
		ctx.textAlign = "right";
		ctx.fillText("Mover: aponte para o chão e mantenha a pinça por 3 s", w - 40, 492);
		ctx.textAlign = "left";

		this._xrSlateTexture.update();
		this._xrConfirmationTarget?.setEnabled(Boolean(confirmationLabel) && !pressureBoardActive);
		this._xrInflateTarget?.setEnabled(canInflate && !pressureBoardActive);
		this._xrDeflationPauseTarget?.setEnabled(Boolean(deflationControlLabel) && !pressureBoardActive);
		if (this._xrConfirmationTarget) {
			this._xrConfirmationTarget.position.x = deflationControlLabel && confirmationLabel ? 0.213 : canInflate && confirmationLabel ? 0.20 : 0;
			this._xrConfirmationTarget.scaling.x = deflationControlLabel && confirmationLabel ? 2.0 : 1;
		}
		if (this._xrInflateTarget) this._xrInflateTarget.position.x = canInflate && confirmationLabel ? -0.20 : 0;
		if (this._xrDeflationPauseTarget) {
			this._xrDeflationPauseTarget.position.x = deflationControlLabel && confirmationLabel ? -0.213 : 0;
			this._xrDeflationPauseTarget.scaling.x = deflationControlLabel && confirmationLabel ? 2.0 : 1;
		}
	}

	private _renderXrSlateDialogue(d5: boolean, d6: boolean, d7: boolean, d23: boolean, progressPercent: number): void {
		if (!this._xrSlateTexture) return;
		const ctx = this._xrSlateTexture.getContext() as unknown as CanvasRenderingContext2D;
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
		ctx.fillText("Toque ou aponte e selecione um tópico:", 40, 130);

		ctx.font = "24px 'Segoe UI', Arial, sans-serif";
		ctx.fillStyle = "rgba(0, 229, 255, 0.12)";
		for (const y of [154, 199, 244, 289]) {
			ctx.beginPath();
			ctx.roundRect(28, y, 968, 38, 8);
			ctx.fill();
		}
		ctx.fillStyle = d5 ? "#81C784" : "#E0E0E0";
		ctx.fillText(`Identificação: ${d5 ? '✓ Concluído' : 'Pendente'}`, 40, 180);

		ctx.fillStyle = d6 ? "#81C784" : "#E0E0E0";
		ctx.fillText(`Condições de Preparo: ${d6 ? '✓ Concluído' : 'Pendente'}`, 40, 225);

		ctx.fillStyle = d7 ? "#81C784" : "#E0E0E0";
		ctx.fillText(`Orientações e Repouso 5 min: ${d7 ? '✓ Concluído' : 'Pendente'}`, 40, 270);

		ctx.fillStyle = d23 ? "#81C784" : "#E0E0E0";
		ctx.fillText(`Informar Valores: ${d23 ? '✓ Concluído' : 'Pendente'}`, 40, 315);

		ctx.fillStyle = "#80DEEA";
		ctx.font = "20px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("Fechar diálogo", 820, 70);

		if (this._lastDialogueText) {
			ctx.fillStyle = "#FFD54F";
			ctx.font = "italic 24px 'Segoe UI', Arial, sans-serif";
			this._drawWrappedText(ctx, `Paciente: "${this._lastDialogueText}"`, 40, 385, 940, 34);
		}

		ctx.fillStyle = "#81D4FA";
		ctx.font = "22px 'Segoe UI', Arial, sans-serif";
		ctx.fillText(`PROGRESSO GERAL: ${progressPercent}%`, 40, 475);
		ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
		ctx.fillRect(340, 457, 640, 18);
		ctx.fillStyle = "#00E5FF";
		ctx.fillRect(340, 457, 640 * (progressPercent / 100), 18);

		this._xrSlateTexture.update();
	}

	private _renderXrSlateDebrief(report: DebriefReport): void {
		if (!this._xrSlateTexture) return;
		const ctx = this._xrSlateTexture.getContext() as unknown as CanvasRenderingContext2D;
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
		ctx.font = "bold 30px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("RELATÓRIO DE DEBRIEFING CLÍNICO • CONCLUÍDO", 40, 64);

		ctx.fillStyle = "#81C784";
		ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
		ctx.fillText(`PONTUAÇÃO GERAL: ${report.totalScore} / 100`, 40, 112);
		ctx.font = "22px 'Segoe UI', Arial, sans-serif";
		ctx.fillText(`Procedimento ${report.physicalScore} • Comunicação ${report.communicationScore} • ${report.flawlessStepCount}/${report.physicalStepCount} etapas sem erros`, 40, 146);

		const { readings } = report;
		const reading = (value: number | null) => value === null ? "—" : `${value}`;
		ctx.fillStyle = "#FFFFFF";
		ctx.font = "22px 'Segoe UI', Arial, sans-serif";
		ctx.fillText(`Registrado: ${reading(readings.recordedSystolic)}/${reading(readings.recordedDiastolic)} mmHg • Referência do caso: ${readings.referenceSystolic}/${readings.referenceDiastolic} mmHg`, 40, 190);

		ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
		ctx.fillText("Comunicação:", 40, 236);
		ctx.font = "22px 'Segoe UI', Arial, sans-serif";
		ctx.fillStyle = "#E0E0E0";
		report.communication.forEach((record, index) => {
			ctx.fillText(`• ${record.title}: ${timingLabel(record)}`, 40, 266 + index * 28);
		});

		ctx.fillStyle = "#FFD54F";
		ctx.font = "italic 22px 'Segoe UI', Arial, sans-serif";
		if (report.stepsWithErrors.length) {
			const steps = report.stepsWithErrors.map(step => `Passo ${step.checklistNumber} (${step.errors}×)`).join(", ");
			this._drawWrappedText(ctx, `Tentativas incorretas: ${steps}`, 40, 400, 940, 28);
		} else {
			ctx.fillText("✓ Todas as etapas físicas sem tentativas incorretas.", 40, 400);
		}
		ctx.fillText("Utilize o menu para reiniciar ou retornar.", 40, 466);

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

	public dispose(): void {
		this._disposed = true;
		this._dialogueAudio.dispose();
		const hadSpeech = this._speechUtterance !== null;
		this._cancelSpeech?.();
		if (hadSpeech) window.speechSynthesis?.cancel();
		if (this._speechTimer) clearTimeout(this._speechTimer);
		if (this._speechUtterance) {
			this._speechUtterance.onend = null;
			this._speechUtterance.onerror = null;
			window.speechSynthesis?.cancel();
		}
		this._visualMotions = [];
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
		this._finishInstrumentFeedback();
		this._handInstruments?.dispose();
		this._handInstruments = null;
		// The physical instrument is scene-owned and reused by the XR restart panel.
		this._instrumentControls = [];
		this._measurementStand?.dispose(false, true);
		this._measurementStand = null;
		this._cuffHoses?.dispose(false, true);
		this._cuffHoses = null;
		this._arrowRoot?.dispose();
		this._arrowRoot = null;
		this._dialogueTriggerMesh?.dispose();
		this._dialogueTriggerMesh = null;
		this._dialogueTriggerRoot?.dispose();
		this._dialogueTriggerRoot = null;
		this._xrSlatePlane?.dispose();
		this._xrSlatePlane = null;
		this._xrConfirmationTarget?.dispose();
		this._xrConfirmationTarget = null;
		this._xrInflateTarget?.dispose();
		this._xrInflateTarget = null;
		this._xrDeflationPauseTarget?.dispose();
		this._xrDeflationPauseTarget = null;
		this._xrPressureConfirmTarget?.dispose();
		this._xrPressureConfirmTarget = null;
		this._xrPressureInflateTarget?.dispose();
		this._xrPressureInflateTarget = null;
		this._xrPressurePauseTarget?.dispose();
		this._xrPressurePauseTarget = null;
		this._xrDialogueTargets.forEach(target => target.dispose());
		this._xrDialogueTargets = [];
		this._xrSlateTexture?.dispose();
		this._xrSlateTexture = null;
		this._xrPressureBoardTexture?.dispose();
		this._xrPressureBoardTexture = null;
		this._xrPressureBoardRoot?.dispose();
		this._xrPressureBoardRoot = null;
		this._xrSlateRoot?.dispose();
		this._xrSlateRoot = null;
		this._audio.dispose();
		this._restartPanel?.dispose();
		this._restartPanel = null;
	}
}
