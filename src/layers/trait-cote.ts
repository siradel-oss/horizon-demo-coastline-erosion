import { HrzApi } from "@siradel-oss/horizon-api";
import { addPmtilesFlatOverlay, LayerPair } from "./_shared";

/**
 * Pick attribute IDs declared on the coastline layers, read back on click to
 * surface each segment's survey years. `ancien` carries only ANNEE1; `recent`
 * also carries ANNEE2 (range end) and INCERT (positional uncertainty, m).
 */
export const TRAIT_COTE_PICK_ATTR = {
    ANNEE1: 1,
    ANNEE2: 2,
    INCERT: 3,
} as const;

/**
 * Cerema coastline rendered flat on the terrain from pre-generated PMTiles.
 * Overlaying the old ("ancien") and recent ("recent") lines reveals the
 * retreat. Source: Cerema, Licence Ouverte 2.0.
 */
export function addTraitCoteLayer(
    api: HrzApi.AsyncApi,
    opts: {
        id: number;
        // PMTiles file suffix + layer name: trait_cote_<key>.
        key: string;
        name: string;
        color: { r: number; g: number; b: number; a: number };
        zIndex: number;
        attribution?: string;
    },
): Promise<LayerPair> {
    // Declare the survey-year attributes so they are returned on pick.
    const pickAttributes =
        opts.key === "recent"
            ? [
                  { id: TRAIT_COTE_PICK_ATTR.ANNEE1, sourceName: "ANNEE1" },
                  { id: TRAIT_COTE_PICK_ATTR.ANNEE2, sourceName: "ANNEE2" },
                  { id: TRAIT_COTE_PICK_ATTR.INCERT, sourceName: "INCERT" },
              ]
            : [{ id: TRAIT_COTE_PICK_ATTR.ANNEE1, sourceName: "ANNEE1" }];

    return addPmtilesFlatOverlay(api, {
        id: opts.id,
        name: opts.name,
        layerName: `trait_cote_${opts.key}`,
        geometry: "polyline",
        attribution: opts.attribution ?? "Cerema — traits de côte naturels",
        stylingScript: `emit 0;`,
        color: { defaultValue: opts.color },
        zIndex: opts.zIndex,
        pickAttributes,
    });
}
