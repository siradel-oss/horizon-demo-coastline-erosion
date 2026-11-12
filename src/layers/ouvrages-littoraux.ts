import { HrzApi } from "@siradel-oss/horizon-api";
import type { Text } from "../i18n";
import { addPmtilesFlatOverlay, LayerPair } from "./_shared";

/**
 * Coastal structures legend — National mapping of coastal structures and
 * amenities (Cerema / GéoLittoral, v11/2017). `code` = value of the numeric
 * `catego_code` attribute carried by the PMTiles (1 = protection structures,
 * 2 = other amenities).
 *
 * Neutral "structure" palette (black / grey), deliberately DISTINCT from every
 * phenomenon palette already in use: magma = risk, Okabe-Ito = assets-at-stake
 * categories, blues = low-lying areas, violet = event-driven retreat.
 * Protection structures (the scenario-relevant ones) are pure black; other
 * amenities use a clearly lighter grey for contrast. High contrast + thicker
 * line so the thin features stay visible on imagery. Color + legend text =
 * accessibility safeguard.
 */
export const OUVRAGES_LEGEND = [
    {
        code: 1,
        key: "protection",
        label: {
            en: "Protection structure (dike, sea wall, revetment, groyne…)",
            fr: "Ouvrage de protection (digue, mur, perré, épi…)",
        } satisfies Text,
        color: "#000000",
    },
    {
        code: 2,
        key: "amenagement",
        label: {
            en: "Other amenity (access, building, harbour…)",
            fr: "Autre aménagement (accès, bâti, port…)",
        } satisfies Text,
        color: "#cbd5e1",
    },
] as const;

export const OUVRAGES_ATTRIBUTION =
    "Cerema / GéoLittoral — ouvrages et aménagements littoraux (2017)";

/** Default line opacity (never 0 — the layer stays readable). */
export const OUVRAGES_DEFAULT_OPACITY = 0.9;
/** Bounds of the opacity slider (the min > 0 keeps the layer visible). */
export const OUVRAGES_OPACITY_RANGE = { min: 0.2, max: 1, step: 0.05 };

/**
 * Stable attribute ids returned on click. `CATEGO` (1 protection / 2 amenity)
 * drives the styling AND is read back to label the structure category;
 * `TYPE` is the textual structure type, as stored in the source data
 * (Épi / Mur / Perré / Brise-lames…).
 * As soon as a layer declares ids / a feature-id, every attribute must carry
 * an id (else an unnumbered one defaults to id 0 and collides with the
 * feature-id) — see Horizon docs.
 */
export const OUVRAGES_PICK_ATTR = { CATEGO: 1, TYPE: 2 } as const;

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
 * Coastal structures layer: ~15k LINE features (dikes, sea walls, groynes,
 * breakwaters, revetments, jetties, accesses…) rendered flat on the terrain
 * from pre-generated PMTiles (ouvrages_littoraux layer). Colored by category via
 * the numeric `catego_code` attribute (1 = protection, 2 = other amenity);
 * `type` is returned on click for the structure label.
 *
 * Thin pixel-width lines (lineWidth in pixels — otherwise metres → invisible at
 * country scale). In the Cerema scenarios these structures modulate the
 * coastline retreat (assumed maintained at 2050 / erased at 2100); here the
 * layer is display-only — that national hypothesis is explained in the panel
 * notice (no per-structure verdict, no geometry change).
 *
 * The `set "color"` drives the line hue per category; the opacity is carried by
 * `color.defaultValue` and the script sets only the RGB hue per category.
 */
export function addOuvragesLittorauxLayer(
    api: HrzApi.AsyncApi,
    id: number,
    opacity: number = OUVRAGES_DEFAULT_OPACITY,
): Promise<LayerPair> {
    const a = opacity.toFixed(2);
    return addPmtilesFlatOverlay(api, {
        id,
        name: "Coastal structures",
        layerName: "ouvrages_littoraux",
        geometry: "polyline",
        attribution: OUVRAGES_ATTRIBUTION,
        // `catego_code` drives the color AND is returned on pick (category);
        // `type` is loaded only to be returned on pick (textual structure type).
        pickableNumericAttributes: [
            { id: OUVRAGES_PICK_ATTR.CATEGO, sourceName: "catego_code" },
        ],
        pickAttributes: [{ id: OUVRAGES_PICK_ATTR.TYPE, sourceName: "type" }],
        stylingScript: `
            if (attr("catego_code") == 1) { set "color" = alpha(${OUVRAGES_LEGEND[0].color}, ${a}); }
            else { set "color" = alpha(${OUVRAGES_LEGEND[1].color}, ${a}); }
            emit 0;
        `,
        color: {
            name: "color",
            defaultValue: fill(OUVRAGES_LEGEND[0].color, opacity),
        },
        // Thicker structure lines (pixels) so the thin features stay visible.
        lineWidth: 3.5,
        // Above the area overlays (risk z35) so structures stay legible.
        zIndex: 40,
    });
}
