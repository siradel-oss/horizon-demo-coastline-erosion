import { HrzApi } from "@siradel-oss/horizon-api";
import type { Text } from "../i18n";
import { addPmtilesFlatOverlay, LayerPair } from "./_shared";

/**
 * Event-driven coastline retreat exposure band (Cerema 2024 / GéoLittoral).
 *
 * Single-phenomenon layer: the landward band materializes the ADDITIONAL retreat
 * of the coastline that a storm / cliff-collapse event may cause, applied to the
 * whole natural shoreline (each coastline segment buffered by its reference
 * distance `Lmax` and clipped to the land).
 *
 * Palette deliberately DISTINCT from every other layer (erosion RdYlBu, risk
 * YlOrRd/magma, low-lying areas blues, assets at stake RdPu): a
 * saturated violet/magenta reads as a separate "event" hazard. The reference
 * retreat magnitude `Lmax` (m) and the morphology class `geo` are kept for the
 * click popup. Legend = single entry (color + text = accessibility safeguard).
 */
export const RECUL_EVENEMENTIEL_LEGEND = [
    {
        key: "band",
        label: {
            en: "Event-driven retreat band (reference max. retreat)",
            fr: "Bande de recul événementiel (recul max. de référence)",
        } satisfies Text,
        color: "#c026d3",
    },
] as const;

export const RECUL_EVENEMENTIEL_ATTRIBUTION =
    "Cerema / GéoLittoral — recul événementiel (2024), traitement Siradel";

/** Default fill opacity (never 0 — the layer stays readable). */
export const RECUL_EVENEMENTIEL_DEFAULT_OPACITY = 0.55;
/** Bounds of the opacity slider (the min > 0 keeps the layer visible). */
export const RECUL_EVENEMENTIEL_OPACITY_RANGE = {
    min: 0.15,
    max: 1,
    step: 0.05,
};
/** Strong opaque outline (deep violet) — stands out on imagery as on the IGN map. */
const OUTLINE_COLOR = "#701a75";

/** Hex (#rrggbb) -> Horizon color binding (components 0..1, partial alpha). */
function fill(
    hex: string,
    a: number,
): { r: number; g: number; b: number; a: number } {
    return {
        r: parseInt(hex.slice(1, 3), 16) / 255,
        g: parseInt(hex.slice(3, 5), 16) / 255,
        b: parseInt(hex.slice(5, 7), 16) / 255,
        a,
    };
}

/**
 * Event-driven retreat layer: the landward exposure band, rendered flat on the
 * terrain from pre-generated PMTiles (recul_evenementiel layer). Single hazard
 * color (one phenomenon) -> no class attribute drives the fill; `lmax` and `geo`
 * are loaded only to be returned on pick. Adjustable light fill (`opacity`) +
 * strong opaque outline to stay readable over the imagery.
 * Indicative reading. Source: Cerema / GéoLittoral, Licence Ouverte 2.0.
 */
export function addReculEvenementielLayer(
    api: HrzApi.AsyncApi,
    id: number,
    opacity: number = RECUL_EVENEMENTIEL_DEFAULT_OPACITY,
): Promise<LayerPair> {
    return addPmtilesFlatOverlay(api, {
        id,
        name: "Event-driven retreat",
        layerName: "recul_evenementiel",
        attribution: RECUL_EVENEMENTIEL_ATTRIBUTION,
        // Loaded only to be returned on pick (not used by the styling).
        pickableNumericAttributes: [{ id: 1, sourceName: "lmax" }],
        pickAttributes: [{ id: 2, sourceName: "geo" }],
        // Fork: renders both the fill (repr 0) and the outline (repr 1).
        stylingScript: `fork { emit 0; }\nfork { emit 1; }`,
        // Light fill (lets the terrain show through) + marked outline.
        color: {
            defaultValue: fill(RECUL_EVENEMENTIEL_LEGEND[0].color, opacity),
        },
        outline: { color: fill(OUTLINE_COLOR, 1), width: 1.5 },
        // Dense semi-opaque polygons -> clip the tile seams.
        clipToTile: true,
        // Tiled at z12 (size-optimized indicative layer) -> Horizon overzooms beyond.
        maxLevel: 12,
        zIndex: 24,
    });
}
