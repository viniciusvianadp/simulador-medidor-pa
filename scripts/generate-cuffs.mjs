import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "xr-cuffs-"));
try {
	execFileSync("python3", ["scripts/extract-folded-cuff.py"], { cwd: root, stdio: "inherit" });
	execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "--ignoreConfig", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", "--strict", "--skipLibCheck", "--outDir", temporary, "src/scene/cuffVariants.ts"], { cwd: root, stdio: "inherit" });
	writeFileSync(join(temporary, "package.json"), '{"type":"module"}');
	const { foldedCuffVariants } = await import(pathToFileURL(join(temporary, "scene/cuffVariants.js")).href);
	writeFileSync(join(root, "assets/Models/cuffs/variants.json"), JSON.stringify({
		generatedBy: "scripts/generate-cuffs.mjs",
		model: "folded-cuff.glb",
		clinicalSource: "src/simulation/clinicalParameters.ts",
		visualSource: "src/scene/cuffVariants.ts",
		representation: "folded-storage-only",
		note: "Folded dimensions are visual approximations, not bladder or fitted-sleeve dimensions. All variants share one GLB and texture atlas.",
		variants: foldedCuffVariants,
	}, null, "\t") + "\n");
	console.log(`Generated ${foldedCuffVariants.length} folded cuff variant definitions.`);
} finally {
	rmSync(temporary, { recursive: true, force: true });
}
