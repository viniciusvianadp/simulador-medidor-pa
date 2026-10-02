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

export class App {
	private _canvas: HTMLCanvasElement;
	private _engine: Engine | null = null;
	private _scene: Scene | null = null;

	public constructor() {
		const canvasElement = document.getElementById("canvas") as HTMLCanvasElement;
		if (!canvasElement) {
			throw new Error("Canvas element not found");
		}
		this._canvas = canvasElement;
	}

	public async init(): Promise<void> {
		this._engine = new Engine(this._canvas, true, {
			stencil: true,
			antialias: true,
			audioEngine: true,
			adaptToDeviceRatio: true,
			disableWebGL2Support: false,
			useHighPrecisionFloats: true,
			powerPreference: "high-performance",
			failIfMajorPerformanceCaveat: false,
		});

		this._scene = new Scene(this._engine);

		await this._handleLoad();

		// Handle window resize
		const handleResize = () => {
			this._engine?.resize();
		};

		window.addEventListener("resize", handleResize);

		// Start render loop
		this._engine.runRenderLoop(() => {
			this._scene?.render();
		});
	}

	private async _handleLoad(): Promise<void> {
		if (!this._engine || !this._scene) {
			return;
		}

		const havok = await HavokPhysics();
		const physicsPlugin = new HavokPlugin(true, havok);
		physicsPlugin.setVelocityLimits(200, 100);
		this._scene.enablePhysics(new Vector3(0, -9.81, 0), physicsPlugin);

		SceneLoaderFlags.ForceFullSceneLoadingForIncremental = true;
		await loadScene("/scene/", "example.babylon", this._scene, scriptsMap, {
			quality: "high",
		});

		if (this._scene.activeCamera) {
			this._scene.activeCamera.attachControl();
		}
	}

	public dispose(): void {
		this._scene?.dispose();
		this._engine?.dispose();
	}
}
