import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { BoundingInfo } from "@babylonjs/core/Culling/boundingInfo";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

/** Split the existing asset's disconnected bulb/valve shells, preserving its UVs and transforms. */
export function splitSphygmomanometer(root: TransformNode): Mesh[] {
	// In-place XR resets reuse the scene and must not split already-cut geometry.
	const existing = ["instrument-bulb", "instrument-valve"].map(name => root.getChildMeshes().find(mesh => mesh.name === name));
	if (existing.every((mesh): mesh is Mesh => mesh instanceof Mesh)) return existing;
	const source = root.getChildMeshes().find((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
	const positions = source?.getVerticesData(VertexBuffer.PositionKind);
	const indices = source?.getIndices();
	if (!source || !positions || !indices) return [];
	const parents = Array.from({ length: positions.length / 3 }, (_, index) => index);
	const find = (index: number): number => {
		while (parents[index] !== index) {
			parents[index] = parents[parents[index]];
			index = parents[index];
		}
		return index;
	};
	// Weld coincident vertices for connectivity only; keep the original UV seams.
	const vertices = new Map<string, number>();
	for (let index = 0; index < parents.length; index++) {
		const key = `${positions[index * 3]},${positions[index * 3 + 1]},${positions[index * 3 + 2]}`;
		const previous = vertices.get(key);
		if (previous !== undefined) parents[find(index)] = find(previous);
		else vertices.set(key, index);
	}
	for (let index = 0; index < indices.length; index += 3) {
		parents[find(indices[index + 1])] = find(indices[index]);
		parents[find(indices[index + 2])] = find(indices[index]);
	}
	const shells = new Map<number, { indices: number[]; min: Vector3; max: Vector3 }>();
	for (let index = 0; index < indices.length; index += 3) {
		const id = find(indices[index]);
		let shell = shells.get(id);
		if (!shell) {
			shell = { indices: [], min: new Vector3(Infinity, Infinity, Infinity), max: new Vector3(-Infinity, -Infinity, -Infinity) };
			shells.set(id, shell);
		}
		for (let corner = 0; corner < 3; corner++) {
			const vertex = indices[index + corner];
			shell.indices.push(vertex);
			const point = Vector3.FromArray(positions, vertex * 3);
			shell.min.minimizeInPlace(point);
			shell.max.maximizeInPlace(point);
		}
	}
	// Source-space bounds for sphygmomanometer_low_poly.glb. The dial stays
	// observational; the bulb and hose-side release valve become controls.
	// Visually verified against a coloured-shell rendering of this asset:
	// positive-X is the dial, while the rubber bulb is at positive Z.
	const bulb = [...shells.values()].find(shell => shell.min.x < -1.03 && shell.max.x < -0.40 && shell.min.z > 0.64 && shell.max.z > 1.04);
	const valve = [...shells.values()].find(shell => shell.min.x > -0.48 && shell.max.x < -0.28 && shell.min.z > 0.78 && shell.max.z < 0.92);
	if (!bulb || !valve) return [];
	const controls: Mesh[] = [];
	for (const [name, shell] of [["instrument-bulb", bulb], ["instrument-valve", valve]] as const) {
		const part = source.clone(name, source.parent, true)!;
		part.makeGeometryUnique();
		part.setIndices(shell.indices);
		part.setBoundingInfo(new BoundingInfo(shell.min, shell.max));
		part.setPivotPoint(shell.min.add(shell.max).scale(0.5));
		part.metadata = { logicalTarget: name };
		part.isPickable = true;
		part.computeWorldMatrix(true);
		if (name === "instrument-valve") {
			part.name = "instrument-valve-body";
			// The low-poly asset has a collar but no distinct release knob.
			// Add a physical metal screw on that collar, not a floating UI target.
			const knob = CreateCylinder("instrument-valve", { diameter: 0.14, height: 0.10, tessellation: 20 }, root.getScene());
			knob.parent = part;
			knob.position.copyFrom(shell.min.add(shell.max).scale(0.5));
			knob.position.y = shell.max.y + 0.045;
			const metal = new StandardMaterial("instrument-valve-metal", root.getScene());
			metal.diffuseColor = Color3.FromHexString("#bcc6c9");
			metal.specularColor.setAll(0.65);
			knob.material = metal;
			knob.metadata = { logicalTarget: name };
			knob.computeWorldMatrix(true);
			controls.push(knob);
		} else controls.push(part);
	}
	source.makeGeometryUnique();
	// The bulb's inlet cap must travel with the held rubber bulb too.
	const inlet = [...shells.values()].find(shell => shell.min.x < -1.08 && shell.max.x < -0.95 && shell.min.z > 0.78);
	if (inlet) {
		const cap = source.clone("instrument-bulb-cap", source.parent, true)!;
		cap.makeGeometryUnique();
		cap.setIndices(inlet.indices);
		cap.setBoundingInfo(new BoundingInfo(inlet.min, inlet.max));
		cap.metadata = { logicalTarget: "instrument-bulb" };
		cap.computeWorldMatrix(true);
	}
	// The folded cuff and its storage-position hoses are replaced by the fitted
	// arm cuff and freshly routed hoses. Keep the dial/neck and bulb end cap.
	const foldedCuff = [...shells.values()].find(shell => shell.min.z < -0.99 && shell.max.z < -0.40);
	const storageHoses = [...shells.values()].filter(shell => shell.min.x < -0.89 && shell.max.x > 0.25 && shell.min.z < -0.90);
	source.setIndices([...shells.values()].filter(shell => shell !== bulb && shell !== valve && shell !== foldedCuff && shell !== inlet && !storageHoses.includes(shell)).flatMap(shell => shell.indices));
	return controls;
}
