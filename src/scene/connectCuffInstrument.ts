import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Curve3 } from "@babylonjs/core/Maths/math.path";

/** Route both real instrument connections to the fitted cuff, replacing storage hoses. */
export function connectCuffInstrument(cuff: Mesh, instrument: TransformNode): TransformNode {
	const scene = cuff.getScene();
	const source = instrument.getChildMeshes().find((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.metadata?.logicalTarget === "gauge");
	if (!source) throw new Error("Instrumento não encontrado para conectar o manguito.");
	cuff.computeWorldMatrix(true);
	source.computeWorldMatrix(true);
	const connections = [new Vector3(0.435, 0.20, 0), new Vector3(-0.287, 0.179, 0.846)];
	const ports = cuff.metadata.hosePorts as number[][];
	const valveBody = scene.getMeshByName("instrument-valve-body");
	const root = new TransformNode("fitted-cuff-hoses", scene);
	const rubber = new StandardMaterial("fitted-cuff-hose-rubber", scene);
	rubber.diffuseColor = Color3.FromHexString("#171c20");
	rubber.specularColor.setAll(0.08);
	const tubes: Mesh[] = [];
	const lastEnds: Vector3[] = [];
	const update = (): void => {
		for (let index = 0; index < connections.length; index++) {
			const connector = index === 1 && valveBody ? valveBody : source;
			connector.computeWorldMatrix(true);
			const end = Vector3.TransformCoordinates(connections[index], connector.getWorldMatrix());
			if (lastEnds[index] && Vector3.DistanceSquared(lastEnds[index], end) < 0.000001) continue;
			const start = Vector3.TransformCoordinates(Vector3.FromArray(ports[index]), cuff.getWorldMatrix());
			const path = Curve3.CreateCubicBezier(
				start, start.add(new Vector3(0.25, 0.14, index ? -0.015 : -0.04)),
				end.add(new Vector3(-0.02, 0.10, index ? -0.02 : -0.04)), end, 40,
			).getPoints();
			const tube = CreateTube(`fitted-cuff-hose-${index}`, {
				path, radius: 0.003, tessellation: 10, cap: Mesh.CAP_ALL,
				updatable: true, instance: tubes[index],
			}, scene);
			tube.parent = root;
			tube.material = rubber;
			tube.metadata = { logicalTarget: "gauge", instrumentRole: "pressure-hose" };
			tubes[index] = tube;
			lastEnds[index] = end;
		}
	};
	update();
	const observer = scene.onBeforeRenderObservable.add(update);
	root.onDisposeObservable.add(() => scene.onBeforeRenderObservable.remove(observer));
	return root;
}
