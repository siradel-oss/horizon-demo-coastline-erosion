import { HrzApi } from "@siradel-oss/horizon-api";
import type { Text } from "../i18n";
import { addPmtilesFlatOverlay, LayerPair } from "./_shared";

/**
 * Legend for the erosion indicator (single source for both the map AND the panel).
 * Diverging RdYlBu palette (colorblind-safe).
 */
export const EROSION_LEGEND: readonly { label: Text; color: string }[] = [
    {
        label: {
            en: "Strong erosion (> 3 m/yr)",
            fr: "Érosion forte (> 3 m/an)",
        },
        color: "#d7191c",
    },
    {
        label: { en: "Erosion (0.5–3 m/yr)", fr: "Érosion (0,5–3 m/an)" },
        color: "#fdae61",
    },
    {
        label: { en: "Stable (± 0.5 m/yr)", fr: "Stable (± 0,5 m/an)" },
        color: "#ffffbf",
    },
    {
        label: { en: "Accretion (0.5–3 m/yr)", fr: "Accrétion (0,5–3 m/an)" },
        color: "#abd9e9",
    },
    {
        label: {
            en: "Strong accretion (> 3 m/yr)",
            fr: "Accrétion forte (> 3 m/an)",
        },
        color: "#2c7bb6",
    },
];

/**
 * Cerema national coastal erosion indicator (N_evolution_trait_cote_S layer):
 * segmented recent coastline, each segment carrying `taux` (m/yr; -9999 = not computed).
 * Colored by rate of change (erosion -> accretion). Source: Cerema, Licence Ouverte 2.0.
 */
export function addErosionIndicatorLayer(
    api: HrzApi.AsyncApi,
    id: number,
): Promise<LayerPair> {
    return addPmtilesFlatOverlay(api, {
        id,
        name: "Erosion indicator",
        layerName: "trait_cote_evolution",
        attribution: "Cerema — indicateur national de l'érosion côtière (2018)",
        numericAttributes: ["taux"],
        // Diverging RdYlBu palette — see EROSION_LEGEND. -9999 = not computed -> discarded.
        stylingScript: `
            if (attr("taux") == -9999) { discard; }
            if (attr("taux") < -3) { set "color" = #d7191c; }
            elif (attr("taux") < -0.5) { set "color" = #fdae61; }
            elif (attr("taux") <= 0.5) { set "color" = #ffffbf; }
            elif (attr("taux") <= 3) { set "color" = #abd9e9; }
            else { set "color" = #2c7bb6; }
            emit 0;
        `,
        color: {
            name: "color",
            defaultValue: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        },
        zIndex: 30,
    });
}
