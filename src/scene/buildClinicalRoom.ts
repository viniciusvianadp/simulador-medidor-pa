import { Scene } from "@babylonjs/core/scene.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder.js";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder.js";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder.js";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder.js";
import type { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { roomSpec } from "./clinicalRoomSpec.js";

type Point = readonly [number, number, number];
type MaterialName = keyof typeof roomSpec.palette;

// Offline builder: the generator saves real meshes into the editable Editor scene.
// All props are static visual placeholders. They do not complete clinical actions.
export function buildClinicalRoom(scene: Scene): void {
	const materials = Object.fromEntries(Object.entries(roomSpec.palette).map(([name, hex]) => {
		const material = new StandardMaterial(`clinical-${name}`, scene);
		material.diffuseColor = Color3.FromHexString(hex);
		material.specularColor = Color3.Black();
		return [name, material];
	})) as Record<MaterialName, StandardMaterial>;
	const finish = (mesh: Mesh, position: Point, material: MaterialName, assetId: string, collides = false) => {
		mesh.id = mesh.name;
		mesh.position.set(...position);
		mesh.material = materials[material];
		mesh.isPickable = false;
		mesh.checkCollisions = collides;
		mesh.metadata = { assetId, status: "blockout", generatedBy: "clinical-room-v1" };
		return mesh;
	};
	const box = (name: string, size: Point, position: Point, material: MaterialName, assetId = name, collides = false) =>
		finish(CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene), position, material, assetId, collides);
	const sphere = (name: string, size: Point, position: Point, material: MaterialName, assetId = name) =>
		finish(CreateSphere(name, { diameterX: size[0], diameterY: size[1], diameterZ: size[2], segments: 8 }, scene), position, material, assetId);
	const cylinder = (name: string, diameter: number, height: number, position: Point, material: MaterialName, assetId = name) =>
		finish(CreateCylinder(name, { diameter, height, tessellation: 16 }, scene), position, material, assetId);
	const anchor = (name: string, position: Point, logicalTarget: string, side?: string) => ({ name, position: [...position], logicalTarget, ...(side ? { side } : {}) });
	const { width: w, depth: d, height: h, wallThickness: t } = roomSpec.size;
	const ground = finish(CreateGround("ground", { width: w, height: d }, scene), [0, 0, 0], "floor", "room", true);
	ground.isPickable = true; // WebXR floor/teleport surface only.
	box("wall-back", [w + 2 * t, h, t], [0, h / 2, d / 2 + t / 2], "wall", "room", true);
	for (const sign of [-1, 1]) {
		box(`wall-side-${sign}`, [t, h, d], [sign * (w / 2 + t / 2), h / 2, 0], "wall", "room", true);
		box(`skirting-side-${sign}`, [0.025, 0.12, d], [sign * (w / 2 - 0.0125), 0.06, 0], "trim", "room");
	}
	box("wall-front", [w + 2 * t, h, t], [0, h / 2, -d / 2 - t / 2], "wall", "room", true);
	box("ceiling", [w, t, d], [0, h + t / 2, 0], "trim", "room");
	box("skirting-back", [w, 0.12, 0.025], [0, 0.06, d / 2 - 0.0125], "trim", "room");
	box("door-frame", [0.99, 2.16, 0.06], [-1.45, 1.08, -d / 2 + 0.03], "trim", "door");
	box("door-panel", [0.9, 2.1, 0.04], [-1.45, 1.05, -d / 2 + 0.07], "upholstery", "door");
	box("door-handle", [0.14, 0.025, 0.04], [-1.14, 1.0, -d / 2 + 0.11], "metal", "door");
	for (const x of [-1.15, 0.85]) {
		box(`window-frame-${x}`, [1.42, 1.22, 0.07], [x, 1.75, d / 2 - 0.035], "trim", "windows");
		box(`window-pane-${x}`, [1.3, 1.1, 0.015], [x, 1.75, d / 2 - 0.08], "glass", "windows");
		box(`window-mullion-${x}`, [0.035, 1.1, 0.02], [x, 1.75, d / 2 - 0.10], "trim", "windows");
		box(`ceiling-panel-${x}`, [1.2, 0.025, 0.35], [x, h - 0.013, -0.2], "trim", "lighting");
	}

	const z = roomSpec.patient.position[2];
	const seat = roomSpec.patient.seatHeight;
	box("chair-seat", [0.52, 0.07, 0.48], [0, seat - 0.035, z], "upholstery", "chair", true);
	box("chair-back", [0.52, 0.64, 0.075], [0, seat + 0.29, z + 0.23], "upholstery", "chair", true);
	for (const x of [-0.22, 0.22]) for (const offset of [-0.19, 0.19]) {
		cylinder(`chair-leg-${x}-${offset}`, 0.035, seat - 0.07, [x, (seat - 0.07) / 2, z + offset], "metal", "chair");
	}
	box("patient-pelvis", [0.34, 0.15, 0.30], [0, seat + 0.075, z - 0.025], "trousers", "patient");
	const torso = finish(CreateCylinder("patient-torso", { diameterTop: 0.42, diameterBottom: 0.32, height: 0.59, tessellation: 16 }, scene), [0, seat + 0.40, z + 0.06], "shirt", "patient");
	torso.scaling.z = 0.65;
	cylinder("patient-neck", 0.10, 0.10, [0, 1.21, z + 0.04], "skin", "patient");
	sphere("patient-head", [0.20, 0.29, 0.22], [0, 1.405, z + 0.025], "skin", "patient");
	sphere("patient-nose", [0.035, 0.045, 0.04], [0, 1.405, z - 0.091], "skin", "patient");
	for (const x of [-0.044, 0.044]) sphere(`patient-eye-${x}`, [0.013, 0.012, 0.008], [x, 1.44, z - 0.08], "dark", "patient");
	const anchors = [anchor("patient", [0, 0.95, z], "patient")];
	for (const [side, sign] of [["esquerdo", 1], ["direito", -1]] as const) {
		const x = sign * 0.36;
		const y = roomSpec.patient.armHeight;
		box(`arm-support-${side}`, [0.20, 0.055, 0.48], [x, y - 0.0275, z - 0.16], "upholstery", "arm-supports");
		cylinder(`arm-support-stem-${side}`, 0.035, y - 0.10, [x, (y - 0.10) / 2, z - 0.06], "metal", "arm-supports");
		box(`arm-support-base-${side}`, [0.22, 0.025, 0.30], [x, 0.0125, z - 0.06], "metal", "arm-supports");
		sphere(`patient-shoulder-${side}`, [0.15, 0.16, 0.17], [sign * 0.235, 1.105, z + 0.04], "shirt", "patient");
		sphere(`patient-upper-arm-${side}`, [0.13, 0.25, 0.14], [sign * 0.275, 1.09, z + 0.015], "skin", "patient");
		sphere(`patient-forearm-${side}`, [0.105, 0.09, 0.29], [x, y + 0.055, z - 0.14], "skin", "patient");
		sphere(`patient-hand-${side}`, [0.09, 0.045, 0.12], [x, y + 0.045, z - 0.32], "skin", "patient");
		sphere(`patient-thigh-${side}`, [0.145, 0.14, 0.42], [sign * 0.105, seat + 0.065, z - 0.20], "trousers", "patient");
		sphere(`patient-knee-${side}`, [0.14, 0.14, 0.14], [sign * 0.105, 0.48, z - 0.37], "trousers", "patient");
		cylinder(`patient-shin-${side}`, 0.115, 0.38, [sign * 0.105, 0.27, z - 0.37], "trousers", "patient");
		box(`patient-foot-${side}`, [0.13, 0.08, 0.24], [sign * 0.105, 0.04, z - 0.44], "dark", "patient");
		anchors.push(anchor(`patient-arm-${side}`, [sign * 0.275, 1.09, z + 0.015], "patient-arm", side));
		anchors.push(anchor(`patient-wrist-${side}`, [x, y + 0.045, z - 0.27], "patient-wrist", side));
		anchors.push(anchor(`patient-cubital-${side}`, [x, y + 0.075, z - 0.025], "patient-arm", side));
	}

	const [tx, ty, tz] = roomSpec.tray.position;
	box("trolley-top", [0.70, 0.04, 0.50], [tx, 0.82, tz], "trim", "trolley", true);
	box("trolley-shelf", [0.64, 0.025, 0.44], [tx, 0.38, tz], "trim", "trolley");
	for (const x of [-0.30, 0.30]) for (const dz of [-0.20, 0.20]) {
		cylinder(`trolley-leg-${x}-${dz}`, 0.025, 0.8, [tx + x, 0.4, tz + dz], "metal", "trolley");
	}
	box("tray", [0.50, 0.012, 0.34], [tx, ty, tz], "metal", "tray");
	for (const x of [-0.245, 0.245]) box(`tray-rim-x-${x}`, [0.01, 0.025, 0.34], [tx + x, ty + 0.0125, tz], "metal", "tray");
	for (const dz of [-0.165, 0.165]) box(`tray-rim-z-${dz}`, [0.5, 0.025, 0.01], [tx, ty + 0.0125, tz + dz], "metal", "tray");
	cylinder("alcohol-70", 0.055, 0.14, [tx + 0.16, ty + 0.075, tz + 0.09], "trim", "alcohol-70");
	cylinder("alcohol-cap", 0.03, 0.025, [tx + 0.16, ty + 0.158, tz + 0.09], "green", "alcohol-70");
	cylinder("cotton-container", 0.08, 0.06, [tx + 0.06, ty + 0.035, tz + 0.09], "metal", "cotton");
	sphere("cotton", [0.055, 0.035, 0.055], [tx + 0.06, ty + 0.073, tz + 0.09], "trim", "cotton");
	const scope = finish(CreateTorus("stethoscope", { diameter: 0.13, thickness: 0.007, tessellation: 24 }, scene), [tx - 0.12, ty + 0.015, tz - 0.025], "dark", "stethoscope");
	scope.scaling.z = 0.7;
	cylinder("stethoscope-chestpiece", 0.045, 0.012, [tx - 0.04, ty + 0.015, tz - 0.02], "metal", "stethoscope");
	box("measuring-tape", [0.11, 0.008, 0.015], [tx + 0.11, ty + 0.012, tz - 0.11], "trim", "measuring-tape");
	sphere("bulb", [0.045, 0.035, 0.08], [tx + 0.12, ty + 0.025, tz - 0.025], "dark", "bulb");
	for (let index = 0; index < 3; index++) box(`cuff-stack-${index}`, [0.20, 0.035, 0.16], [tx - 0.12, 0.415 + index * 0.04, tz], "upholstery", "cuffs");

	const [hx, hy, hz] = roomSpec.hygiene.position;
	box("hygiene-base", [0.28, 0.025, 0.28], [hx, 0.0125, hz], "metal", "hygiene-station");
	cylinder("hygiene-stem", 0.035, hy - 0.15, [hx, (hy - 0.15) / 2, hz], "metal", "hygiene-station");
	box("hygiene-station", [0.13, 0.22, 0.12], [hx, hy - 0.02, hz], "trim", "hygiene-station");
	box("hygiene-pump", [0.11, 0.025, 0.08], [hx, hy + 0.1, hz - 0.04], "green", "hygiene-station");
	const [gx, gy, gz] = roomSpec.gauge.position;
	cylinder("gauge-stem", 0.02, gy - 0.06, [gx, (gy - 0.06) / 2, gz], "metal", "gauge");
	box("gauge-base", [0.22, 0.02, 0.22], [gx, 0.01, gz], "metal", "gauge");
	const gauge = cylinder("gauge", roomSpec.gauge.diameter, 0.035, [gx, gy, gz], "dark", "gauge");
	gauge.rotation.x = Math.PI / 2;
	const face = cylinder("gauge-face-placeholder", 0.108, 0.002, [gx, gy, gz - 0.019], "trim", "gauge");
	face.rotation.x = Math.PI / 2;
	// No fake numeric scale: accurate face/needle and readability are stage 3.7.
	anchors.push(anchor("hygiene-station", [hx, hy, hz], "hygiene-station"));
	anchors.push(anchor("tray", [tx, ty, tz], "tray"));
	anchors.push(anchor("gauge", [gx, gy, gz - 0.019], "gauge"));
	anchors.push(anchor("stethoscope", [tx - 0.12, ty, tz - 0.025], "stethoscope"));
	anchors.push(anchor("measuring-tape", [tx + 0.11, ty, tz - 0.11], "measuring-tape"));
	anchors.push(anchor("cuffs", [tx - 0.12, 0.50, tz], "cuffs"));

	const fill = new HemisphericLight("clinical-fill", new Vector3(0, 1, 0), scene);
	fill.intensity = 0.65;
	fill.groundColor = Color3.FromHexString("#83998B");
	const windowLight = new DirectionalLight("clinical-window-light", new Vector3(-0.4, -1, -0.5), scene);
	windowLight.intensity = 0.35;
	scene.clearColor = Color4.FromHexString("#F2F2E9FF");
	scene.collisionsEnabled = true;
	const camera = new UniversalCamera("clinical-camera", Vector3.FromArray([...roomSpec.learner.position]), scene);
	camera.id = camera.name;
	camera.setTarget(Vector3.FromArray([...roomSpec.learner.target]));
	camera.minZ = 0.025;
	camera.maxZ = 40;
	camera.speed = 0.45;
	camera.fov = 0.95;
	camera.inertia = 0.25;
	camera.checkCollisions = true;
	camera.ellipsoid.set(0.18, 0.5, 0.18);
	camera.keysUp = [87, 38]; camera.keysDown = [83, 40];
	camera.keysLeft = [65, 37]; camera.keysRight = [68, 39];
	camera.keysUpward = []; camera.keysDownward = [];
	scene.activeCamera = camera;
	scene.metadata = {
		clinicalRoom: { version: roomSpec.version, units: roomSpec.units, status: "blockout", anchors, workPositions: roomSpec.workPositions },
		scripts: [{ enabled: true, key: "scripts/xr.ts", _id: "clinical-room-xr", debugOnly: false }],
	};
}
