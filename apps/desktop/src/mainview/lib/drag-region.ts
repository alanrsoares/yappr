/**
 * Class-name tokens for Electrobun's window-drag detection. The preload
 * script (see node_modules/electrobun/.../bun/preload/dragRegions.ts) wires
 * `mousedown` → window move when it finds these literal class names. Raw
 * `-webkit-app-region: drag` from an external stylesheet is NOT honoured.
 *
 * Apply `DRAG` to a container that should drag the window. Interactive
 * children inside (buttons, links, inputs) must opt out with `NO_DRAG`.
 */
export const DRAG = "electrobun-webkit-app-region-drag select-none";
export const NO_DRAG = "electrobun-webkit-app-region-no-drag";
