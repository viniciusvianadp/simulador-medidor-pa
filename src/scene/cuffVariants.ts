import { cuffs } from "../simulation/clinicalParameters.js";

// Storage-only art dimensions. The checklist specifies the internal bladder,
// not the outer sleeve or its folded footprint. Do not use these for fit scoring.
export const foldedCuffVariants = cuffs.map(cuff => ({
	...cuff,
	rangeLabel: cuff.min === 0 ? `≤ ${cuff.max} cm` : `${cuff.min}–${cuff.max} cm`,
	foldedWidthM: (cuff.width + 2) / 100,
	foldedDepthM: (cuff.length / 4 + 2) / 100,
	foldedHeightM: 0.012 + cuff.width * 0.0006,
}));
