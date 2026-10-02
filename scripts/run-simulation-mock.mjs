import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const output = mkdtempSync(join(tmpdir(), "bp-mock-"));
try {
	execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "--ignoreConfig", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", "--strict", "--skipLibCheck", "--outDir", output, "src/simulation/mockRunner.ts"], { stdio: "inherit" });
	writeFileSync(join(output, "package.json"), '{"type":"module"}');
	const load = (file) => import(pathToFileURL(join(output, file)).href);
	const { patientCases } = await load("patientCases.js");
	const { runMockScenario } = await load("mockRunner.js");
	for (const { id, description, config } of patientCases) {
		const result = runMockScenario(config);
		console.log(JSON.stringify({ caso: id, paciente: config.patient.name, descricao: description, caminho: config.persistentSounds ? "Sons persistentes até zero" : "Desaparecimento dos sons", tempo: result.timeLabel, duracaoMs: result.elapsedMs, concluido: result.session.completed, manguito: result.session.instruments.selectedCuff, registro: result.session.observations["document-measurement:measurement-documented"] }, null, 2));
	}
} finally {
	rmSync(output, { recursive: true, force: true });
}
