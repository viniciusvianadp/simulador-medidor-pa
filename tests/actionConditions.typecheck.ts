import type { ActionCondition } from "../src/simulation/types.js";

const equality: ActionCondition = { rule: "equals", expected: 0 };
const derived: ActionCondition = { rule: "systolic" };
// @ts-expect-error Equality must supply a comparison value.
const missingExpected: ActionCondition = { rule: "equals" };
// @ts-expect-error Derived rules must not carry unused literal expectations.
const unusedExpected: ActionCondition = { rule: "systolic", expected: 118 };
// @ts-expect-error Rule names are a closed union, not arbitrary strings.
const misspelled: ActionCondition = { rule: "systollic" };
// @ts-expect-error Equality uses primitive values, not object identity.
const objectEquality: ActionCondition = { rule: "equals", expected: ["cuff"] };
void [equality, derived, missingExpected, unusedExpected, misspelled, objectEquality];
