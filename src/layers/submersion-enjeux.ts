import {
    HEATMAP_DEFAULT_OPACITY,
    HEATMAP_LEGEND,
    HEATMAP_OPACITY_RANGE,
} from "./_heatmap";

/**
 * Marine-flooding exposed-population constants. The actual layer is composed by
 * {@link addPopulationExposeeLayer} (layers/population-exposee.ts), which feeds
 * the shared heatmap factory with the `submersion_enjeux_<level>` weighted-point
 * source (pre-generated PMTiles: one point per exposed INSEE 200 m cell, `pop`).
 */

export const SUBMERSION_ENJEUX_ATTRIBUTION =
    "Cerema / GéoLittoral — zones basses (2024) × INSEE Filosofi 2019, traitement Siradel";

/** Levels mirror the low-lying areas (HAT / HAT + 1 m). */
export const SUBMERSION_ENJEUX_LEVELS = ["phma", "phma1m"] as const;
export type SubmersionEnjeuxLevel = (typeof SUBMERSION_ENJEUX_LEVELS)[number];

// Re-export the shared heatmap legend/opacity surface under stable names.
export const SUBMERSION_HEATMAP_LEGEND = HEATMAP_LEGEND;
export const SUBMERSION_ENJEUX_DEFAULT_OPACITY = HEATMAP_DEFAULT_OPACITY;
export const SUBMERSION_ENJEUX_OPACITY_RANGE = HEATMAP_OPACITY_RANGE;
