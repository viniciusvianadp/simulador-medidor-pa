import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { foldedCuffVariants } from "./cuffVariants";

const foldedCuffUrl = new URL("../../assets/Models/cuffs/folded-cuff.glb", import.meta.url).href;

export async function buildCuffSet(scene: Scene, chairTray: Mesh): Promise<void> {
	const imported = await SceneLoader.ImportMeshAsync("", "", foldedCuffUrl, scene, undefined, ".glb");
	const template = imported.meshes.find(mesh => mesh.getTotalVertices() > 0) as Mesh;
	if (!template) throw new Error("Modelo de manguito não encontrado.");
	const importedRoot = imported.meshes.find(mesh => mesh.name === "__root__");
	// Preserve the glTF handedness conversion before removing its empty root mesh.
	template.setParent(null);
	importedRoot?.dispose();
	const sourceSize = template.getBoundingInfo().boundingBox.extendSize.scale(2);
	chairTray.computeWorldMatrix(true);
	const bounds = chairTray.getBoundingInfo().boundingBox;
	const centerX = (bounds.minimumWorld.x + bounds.maximumWorld.x) / 2;
	const surfaceY = bounds.maximumWorld.y + 0.002;
	const backZ = bounds.minimumWorld.z;
	const set = new TransformNode("cuff-set", scene);
	set.metadata = { logicalTarget: "cuffs", representation: "folded-storage" };

	for (const [index, variant] of foldedCuffVariants.entries()) {
		const firstRow = index < 4;
		const column = firstRow ? index : index - 4;
		const count = firstRow ? 4 : 3;
		const slotWidth = firstRow ? 0.155 : 0.22;
		const x = centerX + (column - (count - 1) / 2) * slotWidth;
		const z = backZ + (firstRow ? 0.075 : 0.242);
		const root = new TransformNode(`cuff-${variant.id}`, scene);
		root.parent = set;
		root.metadata = {
			assetId: `cuff-${variant.id}`, logicalTarget: "cuffs", cuffId: variant.id,
			label: variant.label, circumferenceCm: [variant.min, variant.max],
			bladderCm: { width: variant.width, length: variant.length },
			representation: "folded-storage",
		};
		const cuff = template.clone(`cuff-${variant.id}-fabric`, root)!;
		cuff.scaling.multiplyInPlace(new Vector3(
			variant.foldedWidthM / sourceSize.x,
			variant.foldedHeightM / sourceSize.y,
			variant.foldedDepthM / sourceSize.z,
		));
		cuff.computeWorldMatrix(true);
		const box = cuff.getBoundingInfo().boundingBox;
		root.position.set(x - (box.minimumWorld.x + box.maximumWorld.x) / 2,
			surfaceY - box.minimumWorld.y, z - (box.minimumWorld.z + box.maximumWorld.z) / 2);
		cuff.metadata = root.metadata;
		cuff.isPickable = true;

		// A tag travels with each cuff and remains legible even for neonatal sizes.
		const tag = CreatePlane(`cuff-${variant.id}-label`, { width: slotWidth - 0.012, height: 0.035 }, scene);
		tag.parent = root;
		tag.position.set(0, 0.001, variant.foldedDepthM / 2 + 0.020);
		tag.rotation.set(Math.PI / 2, 0, Math.PI);
		tag.metadata = root.metadata;
		const texture = new DynamicTexture(`cuff-${variant.id}-label-texture`, { width: 768, height: 192 }, scene, true);
		const context = texture.getContext() as CanvasRenderingContext2D;
		context.fillStyle = "#edf4ee";
		context.fillRect(0, 0, 768, 192);
		context.fillStyle = "#204c42";
		context.fillRect(0, 0, 768, 8);
		context.textAlign = "center";
		context.font = "bold 62px sans-serif";
		context.fillText(variant.label, 384, 83);
		context.font = "54px sans-serif";
		context.fillText(variant.rangeLabel, 384, 151);
		texture.update();
		const material = new StandardMaterial(`cuff-${variant.id}-label-material`, scene);
		material.diffuseTexture = texture;
		material.emissiveColor = Color3.White();
		material.disableLighting = true;
		material.specularColor = Color3.Black();
		tag.material = material;
	}
	// Clones share the original geometry, material, and texture atlas.
	template.dispose();
}
