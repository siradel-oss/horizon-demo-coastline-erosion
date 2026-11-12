import {
    HEATMAP_DEFAULT_OPACITY,
    HEATMAP_LEGEND,
    HEATMAP_OPACITY_RANGE,
} from "./_heatmap";

/**
 * Erosion exposed-population constants. The actual layer is composed by
 * {@link addPopulationExposeeLayer} (layers/population-exposee.ts), which feeds
 * the shared heatmap factory with the `enjeux_<horizon>` weighted-point source
 * (pre-generated PMTiles: one point per at-risk INSEE 200 m cell, `pop`).
 */

export const ENJEUX_ATTRIBUTION =
    "Cerema — érosion côtière (2018) × INSEE Filosofi 2019, traitement Siradel";

/** Available horizons (= pre-generated enjeux_<horizon>.pmtiles files). */
export const ENJEUX_HORIZONS = [2050, 2100] as const;

// Re-export the shared heatmap legend/opacity surface under stable names.
export const ENJEUX_HEATMAP_LEGEND = HEATMAP_LEGEND;
export const ENJEUX_DEFAULT_OPACITY = HEATMAP_DEFAULT_OPACITY;
export const ENJEUX_OPACITY_RANGE = HEATMAP_OPACITY_RANGE;

/**
 * Accumulated population mapped to the palette top — MUCH lower than flooding:
 * the at-risk coastal strips are sparse and lightly populated (median ~8 inhab
 * per exposed cell, vs the dense low-lying zones). Visibility tuning knob.
 */
export const ENJEUX_HEATMAP_MAX = 120;
