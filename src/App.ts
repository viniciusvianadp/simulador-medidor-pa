import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { SceneLoaderFlags } from "@babylonjs/core/Loading/sceneLoaderFlags";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import XR from "./scripts/xr";
import { buildCuffSet } from "./scene/buildCuffSet";
import { raiseChairArmrest, posePatientRightArm } from "./scene/adjustChairAndPatientArm";

// Bundle source models independently of the Editor-managed public/scene export.
const clinicalModelUrls = {
	"doctors_office.glb": new URL("../assets/Models/doctors_office.glb", import.meta.url).href,
	"hospital_examination_and_treatment_chair.glb": new URL("../assets/Models/hospital_examination_and_treatment_chair.glb", import.meta.url).href,
	"sphygmomanometer_low_poly.glb": new URL("../assets/Models/sphygmomanometer_low_poly.glb", import.meta.url).href,
	"rigged_stethoscope.glb": new URL("../assets/Models/rigged_stethoscope.glb", import.meta.url).href,
	"hand_sanitizer.glb": new URL("../assets/Models/hand_sanitizer.glb", import.meta.url).href,
	"sitting_mannequin.glb": new URL("../assets/Models/sitting_mannequin.glb", import.meta.url).href,
};

import HavokPhysics from "@babylonjs/havok";

import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Loading/Plugins/babylonFileLoader";

import "@babylonjs/core/Cameras/camera";
import "@babylonjs/core/Collisions/collisionCoordinator";

import "@babylonjs/core/Meshes/groundMesh";

import "@babylonjs/core/Lights/directionalLight";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";

import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Materials/imageProcessingConfiguration";
import "@babylonjs/core/Materials/Node/Blocks";

import "@babylonjs/core/XR/features/WebXRDepthSensing";

import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";

import "@babylonjs/core/Helpers/sceneHelpers";

import "@babylonjs/core/Physics";

import "@babylonjs/materials/sky";
import "@babylonjs/materials/sky/sky.vertex";
import "@babylonjs/materials/sky/sky.fragment";

import "@babylonjs/core/Shaders/postprocess.vertex";
import "@babylonjs/core/Shaders/rgbdDecode.fragment";
import "@babylonjs/core/Shaders/pbr.vertex";
import "@babylonjs/core/Shaders/pbr.fragment";
import "@babylonjs/core/Shaders/shadowMap.vertex";
import "@babylonjs/core/Shaders/shadowMap.fragment";
import "@babylonjs/core/Shaders/lightProxy.vertex";
import "@babylonjs/core/Shaders/lightProxy.fragment";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/color.fragment";
import "@babylonjs/core/Shaders/color.vertex"

import "@babylonjs/core/XR/features/WebXRHandTracking";

import "@babylonjs/loaders/glTF";


import { loadScene } from "babylonjs-editor-tools";

import { scriptsMap } from "./scripts";
import { SimulationController } from "./simulation/SimulationController";
import type { InteractionEvent, ScenarioConfig, SessionState } from "./simulation/types";
import { StartMenu } from "./ui/StartMenu";
import { InteractionManager } from "./interaction/InteractionManager";

export class App {
	private _canvas: HTMLCanvasElement;
	private _engine: Engine | null = null;
	private _scene: Scene | null = null;
	private _simulation: SimulationController | null = null;
	private _interactionManager: InteractionManager | null = null;
	private _xr: XR | null = null;
	private _simulatedOffsetMs = 0;
	private _menu: StartMenu | null = null;
	private _loading = false;
	private _disposed = false;
	private _handleResize = (): void => { this._engine?.resize(); };

	public constructor() {
		const canvasElement = document.getElementById("canvas") as HTMLCanvasElement;
		if (!canvasElement) {
			throw new Error("Canvas element not found");
		}
		this._canvas = canvasElement;
	}

	public init(): void {
		const root = document.getElementById("interface");
		if (!root) throw new Error("Interface element not found");
		this._menu = new StartMenu(root, this._canvas, {
			start: config => this.startSimulation(config),
			restart: () => this.restartSimulation(),
			back: () => this.returnToMenu(),
			moveToStation: station => this.moveToStation(station),
		});
		window.addEventListener("resize", this._handleResize);
	}

	public getSimulationSnapshot(): SessionState | null {
		return this._simulation?.getSnapshot() ?? null;
	}

	public getCurrentSimulationAction() {
		return this._simulation?.getCurrentAction() ?? null;
	}

	public advanceSimulatedTime(ms: number): void {
		this._simulatedOffsetMs += ms;
	}

	public getSimulatedTime(): number {
		return performance.now() + this._simulatedOffsetMs;
	}

	public getInteractionManager(): InteractionManager | null {
		return this._interactionManager;
	}

	// Future scene adapters submit validated interactions through this entry point.
	public dispatchSimulationEvent(event: InteractionEvent) {
		if (this._loading || !this._simulation) return null;
		const result = this._simulation.dispatch(event);
		if (result && result.accepted) {
			this._interactionManager?.refreshGuidance();
		}
		return result;
	}

	public dispatchLateralDialogue(topicId: "identify-patient" | "check-readiness" | "explain-and-rest" | "inform-patient") {
		if (this._loading || !this._simulation) return null;
		const result = this._simulation.dispatchLateralDialogue(topicId);
		if (result && result.accepted) {
			this._interactionManager?.refreshGuidance();
		}
		return result;
	}

	public getCommunicationEvaluation() {
		return this._simulation?.getCommunicationEvaluation() ?? [];
	}

	public async startSimulation(config: ScenarioConfig): Promise<void> {
		if (this._loading || this._disposed) throw new Error("A sessão não pode ser iniciada agora.");
		this._loading = true;
		this._clearSession();
		try {
			this._simulatedOffsetMs = 0;
			const simulation = new SimulationController(config, () => this.getSimulatedTime(), true);
			if (!this._engine) {
				this._engine = new Engine(this._canvas, true, {
					stencil: true, antialias: true, audioEngine: true,
					adaptToDeviceRatio: true, disableWebGL2Support: false,
					useHighPrecisionFloats: true, powerPreference: "high-performance",
					failIfMajorPerformanceCaveat: false,
				});
			}
			this._scene = new Scene(this._engine);
			await this._handleLoad(config);
			if (this._disposed) throw new Error("A aplicação foi encerrada.");
			this._simulation = simulation;
			this._interactionManager = new InteractionManager(this._scene, this);
			this._xr?.setStethoscopeInteractionHandlers(
				() => this._interactionManager?.canGrabStethoscope() ?? false,
				position => this._interactionManager?.handleStethoscopeRelease(position) ?? false
			);
			this._engine.runRenderLoop(() => {
				const now = this.getSimulatedTime();
				this._simulation?.advancePressure(now);
				if (this._simulation) this._interactionManager?.updatePressureDisplay(this._simulation.getCuffPressure());
				this._scene?.render();
			});
			// The menu reveals the canvas after this promise settles.
			requestAnimationFrame(this._handleResize);
		} catch (error) {
			this._clearSession();
			throw error;
		} finally {
			this._loading = false;
		}
	}

	public async restartSimulation(): Promise<void> {
		const config = this._simulation?.getSnapshot().config;
		if (!config) throw new Error("Nenhuma sessão ativa para reiniciar.");
		await this.startSimulation(config);
	}

	public returnToMenu(): void {
		if (this._loading) return;
		this._clearSession();
	}

	private _clearSession(): void {
		this._engine?.stopRenderLoop();
		this._interactionManager?.dispose();
		this._interactionManager = null;
		this._xr = null;
		this._simulatedOffsetMs = 0;
		this._scene?.dispose();
		this._scene = null;
		this._simulation = null;
	}

	private async _handleLoad(config: ScenarioConfig): Promise<void> {
		if (!this._engine || !this._scene) {
			return;
		}

		const scene = this._scene;
		const havok = await HavokPhysics();
		if (scene.isDisposed) throw new Error("O carregamento foi interrompido.");
		const physicsPlugin = new HavokPlugin(true, havok);
		physicsPlugin.setVelocityLimits(200, 100);
		scene.enablePhysics(new Vector3(0, -9.81, 0), physicsPlugin);

		// Clinical background color and lighting
		scene.clearColor = new Color4(0.92, 0.94, 0.93, 1.0);

		const fill = new HemisphericLight("clinical-fill", new Vector3(0, 1, 0), scene);
		fill.intensity = 0.9;
		fill.groundColor = Color3.FromHexString("#83998B");

		const dirLight = new DirectionalLight("clinical-dir-light", new Vector3(-0.4, -1, -0.5), scene);
		dirLight.intensity = 0.5;

		// Load doctors office GLB directly as the scene room
		await SceneLoader.AppendAsync("", clinicalModelUrls["doctors_office.glb"], scene, undefined, ".glb");
		if (scene.isDisposed) throw new Error("O carregamento foi interrompido.");

		const officeRoot = new TransformNode("doctors-office-root", scene);
		const gltfRoot = scene.getMeshByName("__root__");
		if (gltfRoot) {
			const children = [...gltfRoot.getChildren()];
			for (const child of children) {
				if (child instanceof TransformNode) {
					child.setParent(officeRoot);
				} else {
					child.parent = officeRoot;
				}
			}
			gltfRoot.dispose();
		}
		officeRoot.scaling.scaleInPlace(2.4);

		// Enable collisions on room shell, counter, and table
		const officeShell = scene.getMeshByName("DoctorsOffice_blinn1_0") as Mesh | null;
		if (officeShell) {
			officeShell.checkCollisions = true;
			officeShell.metadata = { assetId: "room" };
		}
		const counter = scene.getMeshByName("Counter_blinn1_0");
		if (counter) counter.checkCollisions = true;
		const table = scene.getMeshByName("Table_blinn1_0");
		if (table) table.checkCollisions = true;

		// Create matching enclosure walls for the two cutaway open sides of the GLB model
		// so the doctor's office is completely enclosed with all 4 walls.
		const officeMat = officeShell?.material;
		const createWall = (
			name: string,
			p0: Vector3,
			p1: Vector3,
			p2: Vector3,
			p3: Vector3,
			uv0: [number, number],
			uv1: [number, number],
			uv2: [number, number],
			uv3: [number, number]
		): Mesh => {
			const wall = new Mesh(name, scene);
			const vertexData = new VertexData();
			vertexData.positions = [
				p0.x, p0.y, p0.z,
				p1.x, p1.y, p1.z,
				p2.x, p2.y, p2.z,
				p3.x, p3.y, p3.z,
			];
			vertexData.indices = [0, 1, 2, 0, 2, 3];
			vertexData.uvs = [
				uv0[0], uv0[1],
				uv1[0], uv1[1],
				uv2[0], uv2[1],
				uv3[0], uv3[1],
			];
			const normals: number[] = [];
			VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);
			vertexData.normals = normals;
			vertexData.applyToMesh(wall);
			wall.checkCollisions = true;
			if (officeMat) wall.material = officeMat;
			return wall;
		};

		// Wall at +X (x = 2.28) enclosing the right open cutaway next to the counter
		createWall(
			"office-wall-right",
			new Vector3(2.28, 0, 2.40),
			new Vector3(2.28, 0, -2.52),
			new Vector3(2.28, 2.88, -2.52),
			new Vector3(2.28, 2.88, 2.40),
			[0.774, 0.370],
			[0.385, 0.370],
			[0.385, 0.614],
			[0.774, 0.614]
		);

		// Wall at +Z (z = 2.40) enclosing the front open cutaway of the room
		createWall(
			"office-wall-front",
			new Vector3(-2.45, 0, 2.40),
			new Vector3(2.28, 0, 2.40),
			new Vector3(2.28, 2.88, 2.40),
			new Vector3(-2.45, 2.88, 2.40),
			[0.385, 0.370],
			[0.001, 0.370],
			[0.001, 0.614],
			[0.385, 0.614]
		);

		// Soap dispenser (hygiene) and clipboard (record)
		const soap = scene.getMeshByName("Soap_blinn1_0");
		if (soap) {
			soap.isPickable = true;
			soap.metadata = { assetId: "hygiene-station", logicalTarget: "hygiene-station" };
		}
		const clipboard = scene.getMeshByName("Clipboard_blinn1_0");
		if (clipboard) {
			clipboard.isPickable = true;
			clipboard.metadata = { assetId: "record", logicalTarget: "record" };
		}

		// Hide generic examination bed from doctor's office model to feature the dedicated treatment chair
		const genericBed = scene.getMeshByName("Bed_blinn1_0");
		if (genericBed) genericBed.setEnabled(false);

		// Load clinical examination and treatment chair
		const chair = await this._loadModel(
			"hospital_examination_and_treatment_chair.glb",
			"treatment-chair-root",
			0.035,
			new Vector3(-1.15, 0.02, -1.25),
			Math.PI / 2,
			"chair"
		);

		// Meshes are grouped by material: 2, 3, 10, and 11 include chair structure.
		// Remove only the inspected bottle, packaging, syringe, and tool meshes.
		for (const id of [4, 5, 6, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]) {
			scene.getMeshByName(`chair_Object_${id}`)?.setEnabled(false);
		}
		const chairBounds = chair.getHierarchyBoundingVectors(true, mesh => mesh.isEnabled());
		chair.position.y -= chairBounds.min.y;
		raiseChairArmrest(chair);

		// Enable physical collision detection on all active chair meshes
		for (const mesh of chair.getChildMeshes()) {
			if (mesh.isEnabled()) {
				mesh.checkCollisions = true;
			}
		}

		const chairTray = scene.getMeshByName("chair_Object_8") as Mesh | null;
		if (!chairTray) throw new Error("Bandeja de manguitos não encontrada.");
		await buildCuffSet(scene, chairTray);

		// Load patient mannequin seated on the examination chair with arm at heart level
		const patient = await this._loadModel(
			"sitting_mannequin.glb",
			"patient-root",
			1.0,
			new Vector3(-1.04, 0.332, -1.095),
			Math.PI / 2,
			"patient"
		);
		posePatientRightArm(patient);
		for (const mesh of patient.getChildMeshes()) {
			mesh.checkCollisions = true;
			mesh.metadata = { assetId: "patient", logicalTarget: "patient" };
		}

		// Use the actual desktop height, not the model origin or an assumed desk height.
		if (!table) throw new Error("Mesa de instrumentos não encontrada.");
		table.computeWorldMatrix(true);
		const desktopY = table.getBoundingInfo().boundingBox.maximumWorld.y;
		const trayTopY = desktopY + 0.02;

		// Load instruments onto the consultation desk / tray
		const sphygmo = await this._loadModel(
			"sphygmomanometer_low_poly.glb",
			"sphygmo-root",
			0.11,
			Vector3.Zero(),
			0,
			"sphygmo"
		);
		const stethoscope = await this._loadModel(
			"rigged_stethoscope.glb",
			"stethoscope-root",
			1.0,
			Vector3.Zero(),
			Math.PI / 4,
			"stethoscope"
		);
		const sanitizer = await this._loadModel(
			"hand_sanitizer.glb",
			"sanitizer-root",
			0.0004,
			Vector3.Zero(),
			0,
			"sanitizer"
		);

		this._placeModelOnSurface(sphygmo, new Vector3(-2.04, trayTopY, -0.88), "gauge");
		this._placeModelOnSurface(stethoscope, new Vector3(-2.04, trayTopY, -1.17), "stethoscope");
		this._placeModelOnSurface(sanitizer, new Vector3(-2.04, desktopY, -0.62), "hygiene-station");

		// Ground plane for WebXR floor teleportation
		const ground = CreateGround("ground", { width: 10, height: 10 }, scene);
		ground.checkCollisions = true;
		ground.isPickable = true;
		ground.visibility = 0;

		// Teleport only onto the room interior, never walls, ceiling or the oversized ground.
		officeShell?.computeWorldMatrix(true);
		const floorY = officeShell?.getBoundingInfo().boundingBox.minimumWorld.y ?? 0;
		const teleportFloor = CreateGround("teleport-floor", { width: 4.33, height: 4.52 }, scene);
		teleportFloor.position.set(-0.085, floorY + 0.005, -0.06);
		teleportFloor.visibility = 0;
		teleportFloor.isPickable = false;

		// Invisible collision / test fixtures for test compatibility
		const wallSide = CreateBox("wall-side-1", { width: 0.1, height: 3, depth: 5 }, scene);
		wallSide.position.set(2.28, 1.5, 0);
		wallSide.checkCollisions = true;
		wallSide.visibility = 0;
		wallSide.isPickable = false;

		const tray = CreateBox("tray", { width: 0.33, height: 0.02, depth: 0.62 }, scene);
		tray.position.set(-2.04, desktopY + 0.01, -1.04);
		tray.metadata = { assetId: "tray", logicalTarget: "tray" };
		const trayMat = new PBRMaterial("tray-material", scene);
		trayMat.albedoColor = new Color3(0.92, 0.94, 0.96);
		trayMat.metallic = 0.85;
		trayMat.roughness = 0.25;
		tray.material = trayMat;
		tray.isPickable = true;

		const armL = CreateSphere("patient-forearm-esquerdo", { diameter: 0.15 }, scene);
		armL.position.set(-0.85, 0.85, -0.95);
		armL.visibility = 0;
		armL.isPickable = true;
		armL.metadata = { assetId: "patient-forearm-esquerdo", logicalTarget: "patient-arm", arm: "esquerdo" };

		const armR = CreateSphere("patient-forearm-direito", { diameter: 0.15 }, scene);
		armR.position.set(-0.98, 1.085, -1.50);
		armR.visibility = 0;
		armR.isPickable = true;
		armR.metadata = { assetId: "patient-forearm-direito", logicalTarget: "patient-arm", arm: "direito" };

		const wristL = CreateSphere("patient-wrist-esquerdo", { diameter: 0.12 }, scene);
		wristL.position.set(-0.85, 0.85, -0.72);
		wristL.visibility = 0;
		wristL.isPickable = true;
		wristL.metadata = { assetId: "patient-wrist-esquerdo", logicalTarget: "patient-wrist", arm: "esquerdo" };

		const wristR = CreateSphere("patient-wrist-direito", { diameter: 0.12 }, scene);
		wristR.position.set(-0.98, 1.085, -1.72);
		wristR.visibility = 0;
		wristR.isPickable = true;
		wristR.metadata = { assetId: "patient-wrist-direito", logicalTarget: "patient-wrist", arm: "direito" };
		const selectedArmAnchor = config.arm === "esquerdo" ? armL : armR;
		const selectedWristAnchor = config.arm === "esquerdo" ? wristL : wristR;

		// Simple fitted cuff placeholder; replace with a patient-matched asset later.
		const cuffSleeve = CreateCylinder("fitted-cuff-sleeve", {
			height: 0.14,
			diameter: 0.165,
			tessellation: 24,
		}, scene);
		cuffSleeve.position.set(
			selectedArmAnchor.position.x,
			selectedArmAnchor.position.y,
			selectedArmAnchor.position.z + 0.12
		);
		cuffSleeve.rotation.x = Math.PI / 2;
		cuffSleeve.isPickable = true;
		cuffSleeve.checkCollisions = true;
		cuffSleeve.metadata = { assetId: "fitted-cuff-sleeve", logicalTarget: "cuff", arm: config.arm };
		const cuffMaterial = new StandardMaterial("fitted-cuff-material", scene);
		cuffMaterial.diffuseColor = Color3.FromHexString("#1B4965");
		cuffMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
		cuffSleeve.material = cuffMaterial;

		// Camera placed in the center of the doctor's office
		const camera = new UniversalCamera("clinical-camera", new Vector3(0, 1.6, 0.5), scene);
		camera.setTarget(new Vector3(0, 1.1, -1.8));
		camera.speed = 0.45;
		camera.inertia = 0.25;
		camera.minZ = 0.025;
		camera.maxZ = 40;
		camera.checkCollisions = true;
		camera.ellipsoid.set(0.18, 0.5, 0.18);
		camera.keysUp = [87, 38]; camera.keysDown = [83, 40];
		camera.keysLeft = [65, 37]; camera.keysRight = [68, 39];
		camera.keysUpward = []; camera.keysDownward = [];
		scene.activeCamera = camera;

		const eyeHeight = camera.position.y;
		camera.onAfterCheckInputsObservable.add(() => {
			if (scene.activeCamera !== camera) return;
			camera.position.y = eyeHeight;
			const horizLen = Math.hypot(camera.cameraDirection.x, camera.cameraDirection.z);
			if (horizLen > 0.0001) {
				const totalMag = camera.cameraDirection.length();
				const scale = totalMag / horizLen;
				camera.cameraDirection.x *= scale;
				camera.cameraDirection.z *= scale;
			}
			camera.cameraDirection.y = 0;
		});
		camera.attachControl();

		scene.metadata = {
			clinicalRoom: {
				version: 1,
				units: "meters",
				status: "glb-room",
				anchors: [
					{ name: "hygiene-station", position: [-2.04, desktopY + 0.12, -0.62], logicalTarget: "hygiene-station" },
					{ name: "soap-dispenser", position: [0.792, 1.272, -2.391], logicalTarget: "hygiene-station" },
					{ name: "record", position: [-0.072, 0.88, -1.824], logicalTarget: "record" },
					{ name: "table", position: [-2.04, desktopY, -0.96], logicalTarget: "table" },
					{ name: "treatment-chair", position: [-1.00, 0.72, -1.10], logicalTarget: "patient" },
					{ name: "tray", position: tray.position.asArray(), logicalTarget: "tray" },
					{ name: "sphygmomanometer", position: [-2.04, trayTopY, -0.88], logicalTarget: "gauge" },
					{ name: "sanitizer", position: [-2.04, desktopY, -0.62], logicalTarget: "hygiene-station" },
					{ name: "stethoscope", position: [-2.04, trayTopY, -1.17], logicalTarget: "stethoscope" },
					{ name: "patient-arm", position: selectedArmAnchor.position.asArray(), logicalTarget: "patient-arm" },
					{ name: "patient-wrist", position: selectedWristAnchor.position.asArray(), logicalTarget: "patient-wrist" },
					{ name: "cuffs", position: [-1.15, 0.85, -1.75], logicalTarget: "cuffs" },
				],
			},
			scripts: [{ enabled: true, key: "scripts/xr.ts", _id: "clinical-room-xr", debugOnly: false }],
		};

		// Initialize WebXR (hand tracking, teleportation, motion controllers)
		this._xr = new XR(scene);
		await this._xr.onStart();
	}

	private _placeModelOnSurface(root: TransformNode, center: Vector3, logicalTarget: string): void {
		const bounds = root.getHierarchyBoundingVectors(true);
		root.position.addInPlace(new Vector3(
			center.x - (bounds.min.x + bounds.max.x) / 2,
			center.y - bounds.min.y,
			center.z - (bounds.min.z + bounds.max.z) / 2,
		));
		for (const mesh of root.getChildMeshes()) {
			mesh.metadata = { ...mesh.metadata, assetId: root.name, logicalTarget };
			mesh.computeWorldMatrix(true);
		}
	}

	private async _loadModel(
		fileName: keyof typeof clinicalModelUrls,
		rootName: string,
		scale: number,
		position: Vector3,
		rotationY = 0,
		prefix = ""
	): Promise<TransformNode> {
		if (!this._scene) throw new Error("Scene not initialized");
		const prevMeshes = new Set(this._scene.meshes);
		await SceneLoader.AppendAsync("", clinicalModelUrls[fileName], this._scene, undefined, ".glb");
		const newMeshes = this._scene.meshes.filter(m => !prevMeshes.has(m) && m.name !== "__root__");
		const gltfRoot = this._scene.getMeshByName("__root__");
		const rootNode = new TransformNode(rootName, this._scene);
		if (gltfRoot) {
			const children = [...gltfRoot.getChildren()];
			for (const child of children) {
				if (child instanceof TransformNode) {
					child.setParent(rootNode);
				} else {
					child.parent = rootNode;
				}
			}
			gltfRoot.dispose();
		}
		rootNode.scaling.scaleInPlace(scale);
		rootNode.position.copyFrom(position);
		rootNode.rotation.y = rotationY;

		for (const mesh of newMeshes) {
			if (prefix) mesh.name = `${prefix}_${mesh.name}`;
			mesh.isPickable = true;
		}
		return rootNode;
	}

	public moveToStation(station: "overview" | "hygiene" | "prontuario" | "mesa" | "cadeira" | "esquerdo" | "direito"): void {
		if (!this._scene) return;
		const camera = this._scene.activeCamera;
		if (!camera) return;
		const targets: Record<string, { pos: [number, number, number]; lookAt: [number, number, number] }> = {
			overview: { pos: [0, 1.6, 0.5], lookAt: [0, 1.1, -1.8] },
			hygiene: { pos: [0.79, 1.6, -1.5], lookAt: [0.79, 1.27, -2.39] },
			prontuario: { pos: [-0.07, 1.6, -1.2], lookAt: [-0.07, 0.88, -1.82] },
			mesa: { pos: [-1.50, 1.60, -0.50], lookAt: [-2.04, 1.0, -1.0] },
			cadeira: { pos: [-0.20, 1.70, -0.35], lookAt: [-1.00, 1.00, -1.15] },
			esquerdo: { pos: [0.05, 1.60, -0.55], lookAt: [-0.85, 0.85, -0.95] },
			direito: { pos: [-0.18, 1.60, -1.82], lookAt: [-0.98, 1.085, -1.50] },
		};
		const target = targets[station];
		if (!target) return;
		if (camera instanceof UniversalCamera) {
			camera.position.set(...target.pos);
			camera.setTarget(new Vector3(...target.lookAt));
		}
	}

	public dispose(): void {
		this._disposed = true;
		window.removeEventListener("resize", this._handleResize);
		this._menu?.dispose();
		this._clearSession();
		this._engine?.dispose();
		this._engine = null;
	}
}
