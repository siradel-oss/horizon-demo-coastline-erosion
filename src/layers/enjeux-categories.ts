import { HrzApi } from "@siradel-oss/horizon-api";
import type { Text } from "../i18n";
import { addPmtilesFlatOverlay, LayerPair } from "./_shared";

/**
 * UNIFIED "land use exposed to the hazards" layer. One pre-generated PMTiles
 * crosses CORINE Land Cover 2018 with every hazard footprint, so a single layer serves all hazards. Each feature carries:
 *   - `clc`  = land-use class → colour + picking (the REAL ground, not a guess);
 *   - `alea` = hazard hitting that piece → filtering.
 *
 * `clc` legend (single source for map AND panel). QUALITATIVE Okabe-Ito palette
 * (colorblind reference), distinct from the other palettes (risk/heatmap magma,
 * low-lying blues, erosion RdYlBu). Color + text = accessibility safeguard.
 */
export type ClcCode = 1 | 2 | 3 | 4;

export const ENJEUX_CATEGORIES_LEGEND: readonly {
    code: ClcCode;
    label: Text;
    color: string;
}[] = [
    {
        code: 1,
        label: {
            en: "Housing (urban fabric — CLC 111/112)",
            fr: "Habitation (tissu urbain — CLC 111/112)",
        },
        color: "#d55e00",
    },
    {
        code: 2,
        label: {
            en: "Economic activity (industry, retail, transport — CLC 12x–14x)",
            fr: "Activité (industrie, commerce, transport — CLC 12x–14x)",
        },
        color: "#0072b2",
    },
    {
        code: 3,
        label: {
            en: "Agricultural (agricultural areas — CLC 2xx)",
            fr: "Agricole (territoires agricoles — CLC 2xx)",
        },
        color: "#e69f00",
    },
    {
        code: 4,
        label: {
            en: "Natural / forest (CLC 3xx/4xx)",
            fr: "Naturel / forêt (CLC 3xx/4xx)",
        },
        color: "#009e73",
    },
];

/** Map clc code → color (for the styling script + the pick popup chip). */
const CLC_COLOR: Record<ClcCode, string> = {
    1: "#d55e00",
    2: "#0072b2",
    3: "#e69f00",
    4: "#009e73",
};

/** Short label per clc code, for the pick popup. */
export const CLC_LABEL: Record<ClcCode, Text> = {
    1: { en: "Housing", fr: "Habitation" },
    2: { en: "Economic activity", fr: "Activité" },
    3: { en: "Agricultural", fr: "Agricole" },
    4: { en: "Natural / forest", fr: "Naturel / forêt" },
};

/** Hazard filter: 0 = all hazards; 1 = chronic retreat; 2 = marine flooding. */
export type AleaFilter = 0 | 1 | 2;

/** Hazard filter options (for the panel). */
export const ENJEUX_CATEGORIES_ALEAS: readonly {
    value: AleaFilter;
    label: Text;
}[] = [
    { value: 0, label: { en: "All", fr: "Tous" } },
    { value: 1, label: { en: "Retreat", fr: "Recul" } },
    { value: 2, label: { en: "Flooding", fr: "Submersion" } },
];

/**
 * `alea` is a hazard BITMASK on each piece: bit 1 = retreat, bit 2 = flooding
 * (a piece in both carries 3). Used to decode the impact list in the pick popup
 * and to build the styling filter (no bitwise op in the styling → enumeration).
 */
export const ENJEUX_CATEGORIES_IMPACTS: readonly {
    bit: number;
    label: Text;
}[] = [
    {
        bit: 1,
        label: { en: "Coastline retreat", fr: "Recul du trait de côte" },
    },
    { bit: 2, label: { en: "Marine flooding", fr: "Submersion marine" } },
];

export const ENJEUX_CATEGORIES_ATTRIBUTION =
    "© Copernicus CORINE Land Cover 2018 × Cerema / GéoLittoral, traitement Siradel";

/** Thin opaque outline (neutral dark gray) to detach the pieces from the background. */
const OUTLINE_COLOR = { r: 0x33 / 255, g: 0x33 / 255, b: 0x33 / 255, a: 1 };

/** Default fill opacity. */
export const ENJEUX_CATEGORIES_DEFAULT_OPACITY = 0.6;
/** Bounds of the opacity slider (the min > 0 keeps the layer visible). */
export const ENJEUX_CATEGORIES_OPACITY_RANGE = {
    min: 0.15,
    max: 1,
    step: 0.05,
};

/**
 * Stable pick attribute id. ONE packed attribute `ac = alea*10 + clc`
 * (alea 1..3 bitmask, clc 1..4) — the flat-overlay styling binds only one numeric
 * attribute reliably (two attrs, even id-bound, don't both resolve). `clc` (colour) and the `alea` bits (filter) are decoded from `ac`.
 */
export const ENJEUX_CATEGORIES_PICK_ATTR = { AC: 10 } as const;
/**
 * Packed value `ac = primary*100 + also*10 + clc` :
 *   primary = the hazard whose FOOTPRINT bounds this piece (1=retreat, 2=flooding)
 *             → drives the filter, so a piece never shows outside its own footprint
 *             (a retreat piece stays ⊆ the projection band);
 *   also    = 1 if the piece is ALSO in the other hazard (popup only);
 *   clc     = land-use class 1..4 (colour).
 */
export const clcOfAc = (ac: number): number => ac % 10;
export const primaryOfAc = (ac: number): number => Math.floor(ac / 100);
/** Hazard bitmask for the popup: 1=retreat, 2=flooding, 3=both. */
export const aleaBitsOfAc = (ac: number): number => {
    const primary = Math.floor(ac / 100);
    const also = Math.floor(ac / 10) % 10;
    return also ? 3 : primary;
};

/**
 * Land use exposed to the hazards: CORINE Land Cover pieces clipped to a hazard
 * footprint, coloured by **land-use class** (`clc`, pickable) and filterable by
 * **hazard** (`alea`). Estimation,
 * indicative intersection — not a forecast nor a regulatory zoning.
 *
 * `alea` filters the hazard (0 = all; 1 = chronic retreat; 2 = marine flooding).
 */
export function addEnjeuxCategoriesLayer(
    api: HrzApi.AsyncApi,
    id: number,
    alea: AleaFilter = 0,
    opacity: number = ENJEUX_CATEGORIES_DEFAULT_OPACITY,
): Promise<LayerPair> {
    const a = opacity.toFixed(2);
    // Single packed attribute `ac = primary*100 + also*10 + clc`. No bitwise op in
    // the styling → enumerate the (primary 1..2 × also 0..1 × clc 1..4) values: keep
    // those whose PRIMARY hazard matches the filter (a piece stays ⊆ its own
    // footprint), colour by clc, discard the rest.
    const branches: string[] = [];
    for (const primary of [1, 2]) {
        if (alea !== 0 && primary !== alea) continue; // filter by bounding hazard
        for (const also of [0, 1]) {
            for (const cl of [1, 2, 3, 4] as ClcCode[]) {
                branches.push(
                    `(attr("ac") == ${primary * 100 + also * 10 + cl}) { set "color" = alpha(${CLC_COLOR[cl]}, ${a}); }`,
                );
            }
        }
    }
    const colorScript = branches.length
        ? `if ${branches.join(" elif ")} else { discard; }`
        : `discard;`;
    return addPmtilesFlatOverlay(api, {
        id,
        name: "Exposed land use",
        layerName: "enjeux_categories",
        attribution: ENJEUX_CATEGORIES_ATTRIBUTION,
        // ONE id-bound numeric attribute (the only reliable count for flat-overlay
        // styling): `ac` drives the colour, the filter AND the pick.
        pickableNumericAttributes: [
            { id: ENJEUX_CATEGORIES_PICK_ATTR.AC, sourceName: "ac" },
        ],
        // Colour by land-use class (Okabe-Ito), alpha-driven. Fork: fill + outline.
        stylingScript: `
            ${colorScript}
            fork { emit 0; }
            fork { emit 1; }
        `,
        color: {
            name: "color",
            defaultValue: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        },
        outline: { color: OUTLINE_COLOR, width: 1 },
        clipToTile: true,
        zIndex: 41,
        // Tiled at z12 (Horizon overzooms beyond).
        maxLevel: 12,
    });
}
