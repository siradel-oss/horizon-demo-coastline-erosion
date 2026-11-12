import { HrzApi } from "@siradel-oss/horizon-api";
import { LayerPair } from "./_shared";
import { addWeightedPointHeatmap } from "./_heatmap";
import { ENJEUX_ATTRIBUTION, ENJEUX_HEATMAP_MAX } from "./enjeux";
import {
    SUBMERSION_ENJEUX_ATTRIBUTION,
    SubmersionEnjeuxLevel,
} from "./submersion-enjeux";

/**
 * Exposed-population heatmap for ONE hazard (a single weighted-point source).
 *
 * NB: Horizon uses only the FIRST geometry source of a vector data layer
 * ("Multiple data sources with geometry. Only the first one will be used"), so a
 * single-layer-multi-source sum is impossible; the "All" view overlays TWO of
 * these layers (distinct ids) — each keeps its OWN palette scale, so the sparse
 * coastal-retreat population is not drowned under the dense flooding one.
 *
 * The retreat exposed population is ~100× sparser than flooding → retreat
 * normalises to {@link ENJEUX_HEATMAP_MAX}, flooding to the factory default.
 */
export type PopulationHazard = "recul" | "submersion";

export interface PopulationExposeeOptions {
    hazard: PopulationHazard;
    /** Retreat horizon (2050 / 2100) — used when hazard = "recul". */
    horizon: number;
    /** Flooding level (HAT / HAT + 1 m) — used when hazard = "submersion". */
    level: SubmersionEnjeuxLevel;
    opacity?: number;
}

export function addPopulationExposeeLayer(
    api: HrzApi.AsyncApi,
    id: number,
    opts: PopulationExposeeOptions,
): Promise<LayerPair> {
    const { hazard, horizon, level, opacity } = opts;
    const source =
        hazard === "recul"
            ? {
                  layerName: `enjeux_${horizon}`,
                  attribution: ENJEUX_ATTRIBUTION,
              }
            : {
                  layerName: `submersion_enjeux_${level}`,
                  attribution: SUBMERSION_ENJEUX_ATTRIBUTION,
              };
    return addWeightedPointHeatmap(api, {
        id,
        sources: [source],
        displayName: "Exposed population",
        opacity,
        ...(hazard === "recul" ? { max: ENJEUX_HEATMAP_MAX } : {}),
    });
}
