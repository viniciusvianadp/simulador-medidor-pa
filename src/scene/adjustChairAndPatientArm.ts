import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

/**
 * Elevates the examination chair armrest to support the patient's arm
 * at heart level (3rd-5th intercostal space, ~1.06m - 1.09m above floor).
 */
export function raiseChairArmrest(chairRoot: TransformNode, deltaElevationY = 0.15): void {
	// The chair model hierarchy scales local units by 0.035 to world meters.
	const localDeltaZ = deltaElevationY / 0.035;

	// 1. Armrest pad cushion (chair_Object_11)
	const m11 = chairRoot.getChildMeshes().find(m => m.name.endsWith("Object_11")) as Mesh | undefined;
	if (m11) {
		const pos = m11.getVerticesData("position");
		if (pos) {
			m11.computeWorldMatrix(true);
			const wm = m11.getWorldMatrix().asArray();
			for (let i = 0; i < pos.length; i += 3) {
				const wz = pos[i] * wm[2] + pos[i + 1] * wm[6] + pos[i + 2] * wm[10] + wm[14];
				const wy = pos[i] * wm[1] + pos[i + 1] * wm[5] + pos[i + 2] * wm[9] + wm[13];
				// Armrest cushion is located on the patient's right side (wz < -1.40) and above seat frame (wy > 0.85)
				if (wz < -1.40 && wy > 0.85) {
					pos[i + 2] += localDeltaZ;
				}
			}
			m11.setVerticesData("position", pos);
			m11.refreshBoundingInfo();
		}
	}

	// 2. Armrest metal mounting plate (chair_Object_9)
	const m9 = chairRoot.getChildMeshes().find(m => m.name.endsWith("Object_9")) as Mesh | undefined;
	if (m9) {
		const pos = m9.getVerticesData("position");
		if (pos) {
			m9.computeWorldMatrix(true);
			const wm = m9.getWorldMatrix().asArray();
			for (let i = 0; i < pos.length; i += 3) {
				const wz = pos[i] * wm[2] + pos[i + 1] * wm[6] + pos[i + 2] * wm[10] + wm[14];
				const wy = pos[i] * wm[1] + pos[i + 1] * wm[5] + pos[i + 2] * wm[9] + wm[13];
				if (wz < -1.40 && wy > 0.80) {
					pos[i + 2] += localDeltaZ;
				}
			}
			m9.setVerticesData("position", pos);
			m9.refreshBoundingInfo();
		}
	}

	// 3. Armrest telescoping post and bracket (chair_Object_10)
	const m10 = chairRoot.getChildMeshes().find(m => m.name.endsWith("Object_10")) as Mesh | undefined;
	if (m10) {
		const pos = m10.getVerticesData("position");
		if (pos) {
			m10.computeWorldMatrix(true);
			const wm = m10.getWorldMatrix().asArray();
			for (let i = 0; i < pos.length; i += 3) {
				const wz = pos[i] * wm[2] + pos[i + 1] * wm[6] + pos[i + 2] * wm[10] + wm[14];
				const wy = pos[i] * wm[1] + pos[i + 1] * wm[5] + pos[i + 2] * wm[9] + wm[13];
				// Telescoping post: raise upper section while keeping lower vertices anchored in clamp collar (wy <= 0.72)
				if (wz < -1.40 && wy > 0.72) {
					pos[i + 2] += localDeltaZ;
				}
			}
			m10.setVerticesData("position", pos);
			m10.refreshBoundingInfo();
		}
	}
}

import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";

/**
 * Re-poses the seated mannequin's right arm so that the forearm and hand
 * are supported horizontally on the elevated armrest at heart level.
 *
 * In sitting_mannequin.glb (1464 vertices), vertices 1003 through 1338 comprise
 * the entire right arm from upper arm/shoulder down to fingertips. The right leg
 * and pelvis (vertices 700-960) are completely separate in topology and are left
 * 100% untouched. All mesh triangles are fully preserved to keep the mannequin
 * watertight with smooth shading and zero holes or tearing.
 */
export function posePatientRightArm(patientRoot: TransformNode): void {
	const childMeshes = patientRoot.getChildMeshes();
	for (const mesh of childMeshes) {
		if (!(mesh instanceof Mesh)) continue;
		const pos = mesh.getVerticesData("position");
		if (!pos) continue;

		const origPos = Float32Array.from(pos);
		const origIndices = mesh.getIndices();

		// Displacement vectors from original resting-on-lap pose to elevated armrest pose
		const dxElbow = -0.220;
		const dyElbow = -0.010;
		const dzElbow = +0.105;

		const dxHand = -0.235;
		const dyHand = +0.010;
		const dzHand = +0.265;

		let modified = false;

		// Total vertices in mesh
		const totalVerts = pos.length / 3;

		// Outer shoulder / tricep vertices in sitting_mannequin.glb that connect seamlessly with the arm
		const outerArmIndices = new Set([993, 994, 995, 996, 997, 998, 1424, 1443, 1444]);

		for (let v = 0; v < totalVerts; v++) {
			// Restrict displacement strictly to the right arm vertex group (1003..1338) and outer deltoid/tricep.
			// This prevents any accidental movement of thigh, knee, or torso geometry.
			const isArm = (totalVerts === 1464)
				? ((v >= 1003 && v <= 1338) || outerArmIndices.has(v))
				: (origPos[v * 3] <= -0.11 && origPos[v * 3 + 2] >= 0.45 && origPos[v * 3 + 2] <= 1.05 && origPos[v * 3 + 1] >= -0.28);

			if (!isArm) continue;
			modified = true;

			const i = v * 3;
			const y = origPos[i + 1];
			const z = origPos[i + 2];

			if (z >= 0.64) {
				// Upper arm: smooth blend from shoulder anchor (z ~ 0.98) down to elbow (z ~ 0.64)
				const t = Math.max(0, Math.min(1, (0.98 - z) / (0.98 - 0.64)));
				const w = t * t * (3 - 2 * t);
				pos[i] += dxElbow * w;
				pos[i + 1] += dyElbow * w;
				pos[i + 2] += dzElbow * w;
			} else {
				// Forearm and hand: linear progression from elbow (y ~ 0.10) to hand (y ~ -0.24) resting on the pad
				const s = Math.max(0, Math.min(1, (0.10 - y) / (0.10 - (-0.24))));
				const dx = dxElbow + (dxHand - dxElbow) * s;
				const dy = dyElbow + (dyHand - dyElbow) * s;
				const dz = dzElbow + (dzHand - dzElbow) * s;

				pos[i] += dx;
				pos[i + 1] += dy;
				pos[i + 2] += dz;
			}
		}

		if (modified) {
			mesh.setVerticesData("position", pos);

			// Recompute smooth vertex normals so lighting across the reposed arm is seamless
			if (origIndices) {
				const normals = mesh.getVerticesData("normal") ?? new Float32Array(pos.length);
				VertexData.ComputeNormals(pos, origIndices, normals);
				mesh.setVerticesData("normal", normals);
			}

			mesh.refreshBoundingInfo();
		}
	}
}
