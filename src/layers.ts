/**
 * Horizon layers entry point.
 *
 * Re-exports the thematic layer modules (src/layers/*), which only depend on
 * the `_shared` helpers. Adding a layer = a new module in layers/ + one line
 * here. Callers always import from "../layers".
 */
export * from "./layers/_shared";
export * from "./layers/imagery";
export * from "./layers/elevation";
export * from "./layers/buildings";
export * from "./layers/toponyms";
export * from "./layers/trait-cote";
export * from "./layers/erosion";
export * from "./layers/risk-zones";
export * from "./layers/zones-basses";
export * from "./layers/sea-level";
export * from "./layers/submersion-enjeux";
export * from "./layers/enjeux";
export * from "./layers/population-exposee";
export * from "./layers/enjeux-categories";
export * from "./layers/recul-evenementiel";
export * from "./layers/ouvrages-littoraux";
export * from "./layers/marker";
