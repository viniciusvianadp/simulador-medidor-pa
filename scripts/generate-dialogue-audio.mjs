import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { patientCases } from "../src/simulation/patientCases.ts";

// Node 22.18+ supports the type-only TypeScript used by patientCases.
const output = resolve("assets/Audio/dialogue");
const phrases = JSON.parse(readFileSync("src/interaction/dialoguePhrases.json", "utf8"));
const clips = [];
for (const [id, text] of Object.entries(phrases)) {
	const profiles = id.endsWith("-patient") ? ["male", "female"] : ["shared"];
	for (const profile of profiles) {
		const caption = profile === "female" ? text.replace("Obrigado", "Obrigada") : text;
		clips.push({ id: profile === "female" ? `${id}-female` : id, profile, text: caption,
			voice: profile === "female" ? "pf_dora" : profile === "male" ? "pt_BR-faber-medium" : "pt_BR-cadu-medium",
			spokenText: caption.replace(/^(Profissional|Paciente):\s*/, ""),
		});
	}
}
for (const { id, config: { patient } } of patientCases) {
	const date = new Date(`${patient.dateOfBirth}T12:00:00Z`);
	const spokenDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
	clips.push({
		id: `identity-${id}`, profile: patient.voiceProfile ?? "male", voice: patient.voiceProfile === "female" ? "pf_dora" : "pt_BR-faber-medium",
		text: `Paciente: Meu nome é ${patient.name} e nasci em ${patient.dateOfBirth}.`,
		spokenText: `Meu nome é ${patient.name} e nasci em ${spokenDate}.`,
	});
}
const pieces = { "results-prefix": "Sua pressão medida foi", "results-por": "por", "results-unit": "milímetros de mercúrio.", "results-persistent": "Os sons persistiram até zero; o abafamento foi registrado." };
const small = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
function sayNumber(n) {
	if (n < 20) return small[n];
	if (n < 100) return ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"][Math.floor(n / 10)] + (n % 10 ? ` e ${small[n % 10]}` : "");
	if (n === 100) return "cem";
	return ["", "cento", "duzentos", "trezentos"][Math.floor(n / 100)] + (n % 100 ? ` e ${sayNumber(n % 100)}` : "");
}
for (let number = 0; number <= 300; number++) pieces[`number-${number}`] = sayNumber(number);
for (const [id, spokenText] of Object.entries(pieces)) clips.push({ id, profile: "shared", voice: "pt_BR-cadu-medium", text: `@${id}`, spokenText, trim: true });
mkdirSync(output, { recursive: true });
const manifestPath = resolve(output, "manifest.json");
const temporaryManifest = resolve(output, ".generation.json");
writeFileSync(temporaryManifest, JSON.stringify({ clips }, null, 2) + "\n");
const result = spawnSync(process.env.PIPER_PYTHON ?? "python3", [
	"scripts/synthesize-dialogue.py", temporaryManifest, process.env.PIPER_MODELS ?? "/tmp/bp-piper-models", process.env.KOKORO_MODELS ?? "/tmp/bp-kokoro-models",
], { stdio: "inherit" });
if (result.error || result.status !== 0) throw result.error ?? new Error("Dialogue generation failed; manifest was not replaced.");
writeFileSync(manifestPath, JSON.stringify({ generator: "piper-tts 1.8.0 + kokoro-onnx 0.4.7", clips }, null, 2) + "\n");
const { unlinkSync } = await import("node:fs");
unlinkSync(temporaryManifest);
console.log(`Generated ${clips.length} dialogue clips in ${output}`);
