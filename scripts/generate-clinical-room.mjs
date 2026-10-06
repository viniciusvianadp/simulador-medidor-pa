import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { SceneSerializer } from "@babylonjs/core/Misc/sceneSerializer.js";

const root = resolve(import.meta.dirname, "..");
mkdirSync(join(root, ".bjseditor"), { recursive: true });
const compiled = mkdtempSync(join(root, ".bjseditor", "clinical-room-build-"));
const sceneDirectory = join(root, "assets/clinical-room.scene");
const assetDirectory = join(root, "assets/clinical-room");
let engine;
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, "\t")}\n`);
try {
	execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "--ignoreConfig", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", "--strict", "--skipLibCheck", "--outDir", compiled, "src/scene/buildClinicalRoom.ts"], { cwd: root, stdio: "inherit" });
	const { buildClinicalRoom } = await import(pathToFileURL(join(compiled, "scene/buildClinicalRoom.js")).href);
	const { roomSpec, clinicalAssets } = await import(pathToFileURL(join(compiled, "scene/clinicalRoomSpec.js")).href);
	engine = new NullEngine();
	const scene = new Scene(engine);
	buildClinicalRoom(scene);
	const data = SceneSerializer.Serialize(scene);
	const writeGenerated = (directory, entries) => {
		mkdirSync(directory, { recursive: true });
		// Only remove stale files owned by this generator. Manual additions survive.
		for (const file of readdirSync(directory)) {
			if (file.endsWith(".json") && !entries.has(file)) {
				const old = JSON.parse(readFileSync(join(directory, file), "utf8"));
				if ((old.meshes?.[0]?.metadata ?? old.metadata)?.generatedBy === "clinical-room-v1") rmSync(join(directory, file));
			}
		}
		for (const [file, value] of entries) writeJson(join(directory, file), value);
	};
	const meshes = new Map();
	for (const mesh of data.meshes) {
		const geometry = data.geometries.vertexData.find(item => item.id === mesh.geometryId);
		if (!geometry) throw new Error(`Missing geometry for ${mesh.name}`);
		// The Editor packer expects inline mesh geometry or binary mesh data.
		for (const key of ["positions", "normals", "uvs", "indices"]) mesh[key] = geometry[key];
		delete mesh.geometryId;
		delete mesh.geometryUniqueId;
		meshes.set(`${mesh.id}.json`, { meshes: [mesh], materials: data.materials.filter(material => material.id === mesh.materialId), metadata: mesh.metadata });
	}
	writeGenerated(join(sceneDirectory, "meshes"), meshes);
	for (const kind of ["cameras", "lights"]) {
		writeGenerated(join(sceneDirectory, kind), new Map(data[kind].map(item => {
			item.metadata = { ...item.metadata, generatedBy: "clinical-room-v1" };
			return [`${item.id}.json`, item];
		})));
	}
	const camera = data.cameras[0];
	writeJson(join(sceneDirectory, "config.json"), {
		clearColor: data.clearColor, ambientColor: data.ambientColor,
		environment: {
			environmentIntensity: 1,
			iblIntensity: 1,
			environmentTexture: null,
		},
		fog: { fogMode: 0, fogColor: [1, 1, 1], fogStart: 0, fogEnd: 40, fogDensity: 0 },
		physics: { gravity: [0, -9.81, 0] }, rendering: [{ cameraId: camera.id }],
		metadata: data.metadata, animations: [], editorCamera: { ...camera, type: "EditorCamera" },
	});
	mkdirSync(assetDirectory, { recursive: true });
	const triangles = scene.meshes.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0);
	if (triangles > roomSpec.budgets.blockoutTriangles) throw new Error(`Blockout exceeds triangle budget: ${triangles}`);
	writeJson(join(assetDirectory, "manifest.json"), {
		generatedFrom: ["src/scene/clinicalRoomSpec.ts", "src/scene/buildClinicalRoom.ts"],
		...roomSpec, assets: clinicalAssets,
		blockout: { meshCount: scene.meshes.length, triangles, materials: scene.materials.length, textures: scene.textures.length },
	});
	// Preserve other project settings while selecting the new editable scene.
	const projectPath = join(root, "project.bjseditor");
	if (existsSync(projectPath)) {
		const project = JSON.parse(readFileSync(projectPath, "utf8"));
		project.lastOpenedScene = "/assets/clinical-room.scene";
		writeFileSync(projectPath, `${JSON.stringify(project, null, "    ")}\n`);
	}
	console.log(`Clinical blockout: ${scene.meshes.length} meshes, ${triangles} triangles. Editable scene: assets/clinical-room.scene`);
	execFileSync("npm", ["run", "generate"], { cwd: root, stdio: "inherit" });
} finally {
	engine?.dispose();
	rmSync(compiled, { recursive: true, force: true });
}
