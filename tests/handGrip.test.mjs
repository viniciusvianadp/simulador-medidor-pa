import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const output = mkdtempSync(join(tmpdir(), "bp-hand-grip-"));
after(() => rmSync(output, { recursive: true, force: true }));
execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "--ignoreConfig", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "bundler", "--strict", "--skipLibCheck", "--outDir", output, "src/interaction/gripGesture.ts"]);
writeFileSync(join(output, "package.json"), '{"type":"module"}');
const { classifyGrip, BulbGripCycle, ValveTouchLatch } = await import(pathToFileURL(join(output, "gripGesture.js")).href);
const tight = classifyGrip([0.03, 0.03, 0.03, 0.03], 0.08);
const relaxed = classifyGrip([0.07, 0.07, 0.07, 0.07], 0.08);
const open = classifyGrip([0.11, 0.11, 0.11, 0.11], 0.08);

test("grip/squeeze thresholds scale with hand size and reject insufficient tracking", () => {
	for (const span of [0.055, 0.08, 0.11]) {
		assert.equal(classifyGrip(Array(4).fill(span * 0.4), span).tight, true);
		assert.equal(classifyGrip(Array(4).fill(span * 0.85), span).relaxed, true);
		assert.equal(classifyGrip(Array(4).fill(span * 1.3), span).open, true);
	}
	assert.equal(classifyGrip([0.02, 0.02], 0.08).tracked, false);
	assert.equal(classifyGrip([NaN, Infinity, 0.02], 0.08).grab, false);
});

test("pickup never pumps, and sustained closure pumps only once per relaxation", () => {
	const cycle = new BulbGripCycle();
	assert.equal(cycle.update(tight, 0), null);
	assert.equal(cycle.update(tight, 100), null);
	assert.equal(cycle.update(relaxed, 200), null);
	assert.equal(cycle.update(tight, 300), "squeeze");
	assert.equal(cycle.update(tight, 400), null);
	assert.equal(cycle.update(classifyGrip(Array(4).fill(0.045), 0.08), 450), null);
	assert.equal(cycle.update(tight, 500), null, "threshold jitter cannot re-arm pumping");
	cycle.update(relaxed, 600);
	assert.equal(cycle.update(tight, 700), "squeeze");
});

test("brief opening refills without dropping; sustained full opening releases", () => {
	const cycle = new BulbGripCycle();
	cycle.update(open, 0);
	assert.equal(cycle.update(tight, 150), "squeeze");
	cycle.update(open, 300);
	assert.equal(cycle.update(open, 649), null);
	assert.equal(cycle.update(open, 650), "release");
});

test("tracking gaps neither pump nor drop immediately, and recovery needs a new relaxation", () => {
	const cycle = new BulbGripCycle();
	const lost = classifyGrip([], 0.08);
	cycle.update(relaxed, 0);
	assert.equal(cycle.update(lost, 100), null);
	assert.equal(cycle.update(tight, 200), null);
	assert.equal(cycle.update(lost, 300), null);
	assert.equal(cycle.update(lost, 549), null);
	assert.equal(cycle.update(lost, 550), "release");
});

test("valve touch activates once, ignores contact jitter, and re-arms after withdrawal", () => {
	const latch = new ValveTouchLatch();
	assert.equal(latch.update(0.02), true);
	assert.equal(latch.update(0.02), false);
	assert.equal(latch.update(0.04), false);
	assert.equal(latch.update(0.03), false);
	assert.equal(latch.update(0.07), false);
	assert.equal(latch.update(0.02), true);
});


test("different finger lengths still recognize a fully open hand and a refill grip", () => {
	const lengths = [0.08, 0.10, 0.09, 0.06];
	assert.equal(classifyGrip(lengths.map(length => length * 0.98), 0.10, lengths).open, true);
	const refill = classifyGrip(lengths.map(length => length * 0.70), 0.10, lengths);
	assert.equal(refill.relaxed, true);
	assert.equal(refill.open, false);
});
