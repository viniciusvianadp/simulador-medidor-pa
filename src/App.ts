import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneLoaderFlags } from "@babylonjs/core/Loading/sceneLoaderFlags";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";

import HavokPhysics from "@babylonjs/havok";

import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Loading/Plugins/babylonFileLoader";

import "@babylonjs/core/Cameras/camera";
import "@babylonjs/core/Cameras/universalCamera";

import "@babylonjs/core/Meshes/groundMesh";

import "@babylonjs/core/Lights/directionalLight";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Lights/Shadows/cascadedShadowGenerator";

import "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Materials/imageProcessingConfiguration";
import "@babylonjs/core/Materials/Node/Blocks";

import "@babylonjs/core/XR/features/WebXRDepthSensing";

import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";

import "@babylonjs/core/Materials/Textures/cubeTexture";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";

import "@babylonjs/core/Physics";

import "@babylonjs/core/Helpers/sceneHelpers";

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

		SceneLoaderFlags.ForceFullSceneLoadingForIncremental = true;
		await loadScene("/scene/", "example.babylon", scene, scriptsMap, {
			quality: "high",
		});

		if (scene.isDisposed) throw new Error("O carregamento foi interrompido.");

		// The .env only provides lighting; show it as the background instead of the procedural sky.
		if (scene.environmentTexture) {
			scene.getMeshByName("sky")?.setEnabled(false);
			scene.createDefaultSkybox(scene.environmentTexture, true, 1000, 0);
		}

		scene.activeCamera?.attachControl();
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
