import { HrzApi } from "@siradel-oss/horizon-api";
import type { Text } from "../i18n";
import { addPmtilesFlatOverlay, LayerPair } from "./_shared";

/**
 * Legend for the low-lying floodable zones (single source for both the map AND the panel).
 * Two GéoLittoral levels, two shades of blue (water / flooding), distinct from the
 * erosion (RdYlBu) and risk (YlOrRd) palettes. Color + text = accessibility safeguard.
 */
export const ZONES_BASSES_LEGEND: readonly {
    key: "phma" | "phma1m";
    label: Text;
    color: string;
}[] = [
    {
        key: "phma",
        label: {
            en: "Below HAT (exceptional high tide)",
            fr: "Sous la PHMA (marée haute exceptionnelle)",
        },
        color: "#74a9cf",
    },
    {
        key: "phma1m",
        label: {
            en: "Below HAT + 1 m (simulated rise)",
            fr: "Sous la PHMA + 1 m (élévation simulée)",
        },
        color: "#045a8d",
    },
];

export const ZONES_BASSES_ATTRIBUTION =
    "Cerema / GéoLittoral — zones basses du littoral (2024)";

/** Default fill opacity (never 0 — the layer stays readable). */
export const ZONES_BASSES_DEFAULT_OPACITY = 0.35;
/** Bounds of the opacity slider (the min > 0 keeps the layer visible). */
export const ZONES_BASSES_OPACITY_RANGE = { min: 0.15, max: 1, step: 0.05 };
/** Strong opaque outline (midnight blue) — stands out on ortho as on the IGN map. */
const OUTLINE_COLOR = "#012a4a";

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
 * GéoLittoral low-lying zones layer for a given level (`phma` or `phma1m`):
 * polygons of land floodable at exceptional high tide / +1 m, rendered
 * flat on the terrain from pre-generated local PMTiles.
 * Adjustable light fill (`opacity`) + strong opaque outline to stay
 * readable over the imagery. Single-color (no class attribute) -> `emit 0`.
 * Official data, indicative reading. Source: GéoLittoral, Licence Ouverte 2.0.
 */
export function addZonesBassesLayer(
    api: HrzApi.AsyncApi,
    id: number,
    level: (typeof ZONES_BASSES_LEGEND)[number]["key"],
    opacity: number = ZONES_BASSES_DEFAULT_OPACITY,
): Promise<LayerPair> {
    const item = ZONES_BASSES_LEGEND.find((l) => l.key === level)!;
    return addPmtilesFlatOverlay(api, {
        id,
        name: `Low-lying areas (${level})`,
        layerName: `zones_basses_${level}`,
        attribution: ZONES_BASSES_ATTRIBUTION,
        // Fork: renders both the fill (repr 0) and the outline (repr 1).
        stylingScript: `fork { emit 0; }\nfork { emit 1; }`,
        // Light fill (lets the terrain show through) + marked outline.
        color: { defaultValue: fill(item.color, opacity) },
        outline: { color: fill(OUTLINE_COLOR, 1), width: 1.5 },
        // Dense semi-opaque polygons -> clip the tile seams.
        clipToTile: true,
        // Tiled at z12 (size-optimized indicative layer) -> Horizon overzooms beyond.
        maxLevel: 12,
        zIndex: 25,
    });
}
