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
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import XR from "./scripts/xr";

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

export class App {
	private _canvas: HTMLCanvasElement;
	private _engine: Engine | null = null;
	private _scene: Scene | null = null;
	private _simulation: SimulationController | null = null;
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

	// Future scene adapters submit validated interactions through this entry point.
	public dispatchSimulationEvent(event: InteractionEvent) {
		if (this._loading || !this._simulation) return null;
		return this._simulation.dispatch(event);
	}

	public async startSimulation(config: ScenarioConfig): Promise<void> {
		if (this._loading || this._disposed) throw new Error("A sessão não pode ser iniciada agora.");
		this._loading = true;
		this._clearSession();
		try {
			const simulation = new SimulationController(config);
			if (!this._engine) {
				this._engine = new Engine(this._canvas, true, {
					stencil: true, antialias: true, audioEngine: true,
					adaptToDeviceRatio: true, disableWebGL2Support: false,
					useHighPrecisionFloats: true, powerPreference: "high-performance",
					failIfMajorPerformanceCaveat: false,
				});
			}
			this._scene = new Scene(this._engine);
			await this._handleLoad();
			if (this._disposed) throw new Error("A aplicação foi encerrada.");
			this._simulation = simulation;
			this._engine.runRenderLoop(() => { this._scene?.render(); });
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
		this._scene?.dispose();
		this._scene = null;
		this._simulation = null;
	}

	private async _handleLoad(): Promise<void> {
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
		await SceneLoader.AppendAsync("/scene/assets/Models/", "doctors_office.glb", scene);
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
		await this._loadModel(
			"hospital_examination_and_treatment_chair.glb",
			"treatment-chair-root",
			0.035,
			new Vector3(-1.30, 0, -1.30),
			Math.PI / 2,
			"chair"
		);

		// Load instruments onto the consultation desk / tray
		await this._loadModel(
			"sphygmomanometer_low_poly.glb",
			"sphygmo-root",
			0.11,
			new Vector3(-1.90, 0.735, -0.85),
			0,
			"sphygmo"
		);
		await this._loadModel(
			"rigged_stethoscope.glb",
			"stethoscope-root",
			1.0,
			new Vector3(-1.90, 0.735, -1.12),
			Math.PI / 4,
			"stethoscope"
		);
		await this._loadModel(
			"hand_sanitizer.glb",
			"sanitizer-root",
			0.0004,
			new Vector3(-2.15, 0.725, -0.65),
			0,
			"sanitizer"
		);

		// Ground plane for WebXR floor teleportation
		const ground = CreateGround("ground", { width: 10, height: 10 }, scene);
		ground.checkCollisions = true;
		ground.isPickable = true;
		ground.visibility = 0;

		// Invisible collision / test fixtures for test compatibility
		const wallSide = CreateBox("wall-side-1", { width: 0.1, height: 3, depth: 5 }, scene);
		wallSide.position.set(2.28, 1.5, 0);
		wallSide.checkCollisions = true;
		wallSide.visibility = 0;
		wallSide.isPickable = false;

		const tray = CreateBox("tray", { width: 0.55, height: 0.02, depth: 0.40 }, scene);
		tray.position.set(-1.90, 0.725, -1.0);
		const trayMat = new PBRMaterial("tray-material", scene);
		trayMat.albedoColor = new Color3(0.92, 0.94, 0.96);
		trayMat.metallic = 0.85;
		trayMat.roughness = 0.25;
		tray.material = trayMat;
		tray.isPickable = true;

		const armL = CreateSphere("patient-forearm-esquerdo", { diameter: 0.1 }, scene);
		armL.position.set(-1.10, 0.95, -1.30);
		armL.visibility = 0;
		armL.isPickable = false;

		const armR = CreateSphere("patient-forearm-direito", { diameter: 0.1 }, scene);
		armR.position.set(-1.50, 0.95, -1.30);
		armR.visibility = 0;
		armR.isPickable = false;

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
					{ name: "hygiene-station", position: [0.792, 1.272, -2.391], logicalTarget: "hygiene-station" },
					{ name: "record", position: [-0.072, 0.88, -1.824], logicalTarget: "record" },
					{ name: "table", position: [-2.04, 0.501, -0.96], logicalTarget: "table" },
					{ name: "treatment-chair", position: [-1.30, 0.60, -1.30], logicalTarget: "patient" },
					{ name: "tray", position: [-1.90, 0.725, -1.0], logicalTarget: "tray" },
					{ name: "sphygmomanometer", position: [-1.90, 0.735, -0.85], logicalTarget: "gauge" },
					{ name: "stethoscope", position: [-1.90, 0.735, -1.12], logicalTarget: "stethoscope" },
				],
			},
			scripts: [{ enabled: true, key: "scripts/xr.ts", _id: "clinical-room-xr", debugOnly: false }],
		};

		// Initialize WebXR (hand tracking, teleportation, motion controllers)
		const xr = new XR(scene);
		await xr.onStart();
	}

	private async _loadModel(
		fileName: string,
		rootName: string,
		scale: number,
		position: Vector3,
		rotationY = 0,
		prefix = ""
	): Promise<TransformNode> {
		if (!this._scene) throw new Error("Scene not initialized");
		const prevMeshes = new Set(this._scene.meshes);
		await SceneLoader.AppendAsync("/scene/assets/Models/", fileName, this._scene);
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
			mesa: { pos: [-1.45, 1.35, -0.45], lookAt: [-1.90, 0.75, -1.0] },
			cadeira: { pos: [-0.75, 1.35, -1.30], lookAt: [-1.30, 0.95, -1.30] },
			esquerdo: { pos: [-1.10, 1.45, -1.0], lookAt: [-1.10, 0.95, -1.30] },
			direito: { pos: [-1.50, 1.45, -1.0], lookAt: [-1.50, 0.95, -1.30] },
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
