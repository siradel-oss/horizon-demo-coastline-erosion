import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { LayerPair, dataUrl } from "./_shared";

/**
 * Shared EXPOSED-POPULATION HEATMAP factory.
 *
 * Both the marine-flooding (low-lying areas) and coastline-retreat assets at
 * stake are rendered identically: ONE weighted POINT per exposed INSEE 200 m cell (centroid
 * carrying the cell population as `pop`), accumulated by Horizon's HEATMAP repr
 * into a density surface that reads as "where the exposed people concentrate" —
 * NOT a re-trace of the hazard outline.
 *
 * The pre-generated point tiles MUST retain every point at every zoom (no
 * feature dropping, no tile-size limit): the repr accumulates within a
 * fixed WORLD radius, so dropping low-zoom points makes the color drift toward the
 * palette top as you zoom in.
 */

// --- Visual tuning knobs (shared, in-browser adjustable) ---------------------
/** Accumulation radius on the ground (meters): blends neighbouring cells. */
const DISC_RADIUS_M = 1500;
/** Blur, relative to the disc radius (0..1+). */
const BLUR_SIZE = 0.6;
/**
 * DEFAULT accumulated population (inhabitants summed within the radius) mapped to
 * the TOP of the palette. Per-layer override via `HeatmapLayerOptions.max`: the
 * exposed-population magnitude differs hugely between layers (dense flooding
 * low-lying zones vs sparse low-populated coastal-retreat strips), so each layer
 * normalises to its own domain — same palette, different scale.
 */
const HEATMAP_MAX = 6000;
/** Render order (above the hazard polygons / low-lying zones). */
const HEATMAP_ZINDEX = 42;

/** Magma ramp (transparent → deep purple → magenta → orange) — perceptually uniform,
 *  distinct from the blues (low-lying zones), RdPu (erosion assets at stake) and YlOrRd (risk). */
const MAGMA = [
    { t: 0.0, hex: "#000004", a: 0.0 },
    { t: 0.05, hex: "#3b0f70", a: 0.55 },
    { t: 0.2, hex: "#8c2981", a: 0.72 },
    { t: 0.5, hex: "#de4968", a: 0.85 },
    { t: 1.0, hex: "#fe9f6d", a: 0.95 },
] as const;

/** Legend gradient stops for the panel (color + position 0..1). */
export const HEATMAP_LEGEND = MAGMA.map(({ hex, t }) => ({ hex, t }));

/**
 * Shared INTENSITY ramp (low → high), as hex — the single palette for EVERY
 * intensity representation (continuous heatmaps here, discrete classes elsewhere
 * e.g. risk zones). Categories, diverging (erosion/accretion) and scenario layers
 * (low-lying zones) keep their own palettes on purpose.
 */
export const INTENSITY_RAMP = MAGMA.filter((s) => s.a > 0).map((s) => s.hex);

/** CSS gradient mirroring the map palette (for the panel legend bar). */
export const HEATMAP_GRADIENT_CSS = `linear-gradient(to right, ${HEATMAP_LEGEND.map(
    (s) => `${s.hex} ${Math.round(s.t * 100)}%`,
).join(", ")})`;

/** Default heatmap opacity (scales the whole palette alpha) — < 1 so the imagery
 *  basemap stays readable through the density surface. */
export const HEATMAP_DEFAULT_OPACITY = 0.7;
/** Bounds of the opacity slider (min > 0 keeps the layer visible). */
export const HEATMAP_OPACITY_RANGE = { min: 0.15, max: 1, step: 0.05 };

function rgba(hex: string, a: number): HrzProtocol.IColor {
    return {
        r: parseInt(hex.slice(1, 3), 16) / 255,
        g: parseInt(hex.slice(3, 5), 16) / 255,
        b: parseInt(hex.slice(5, 7), 16) / 255,
        a,
    };
}

/** Magma palette over the accumulated-population domain [0 .. max].
 *  `opacity` (0..1) scales every stop's alpha — the heatmap has no separate
 *  layer-opacity, so transparency is baked into the palette. */
function buildPalette(
    opacity: number,
    max: number,
): HrzProtocol.INumericPalette {
    return {
        interpolationMode: HrzProtocol.ColorInterpolationMode.SRGB,
        colorStops: MAGMA.map(({ t, hex, a }) => {
            const c = rgba(hex, a * opacity);
            return { value: t * max, firstColor: c, secondColor: c };
        }),
    };
}

/** One weighted-point PMTiles feeding the heatmap. */
export interface HeatmapSource {
    /** PMTiles file basename AND internal layer name (`<layerName>.pmtiles`). */
    layerName: string;
    attribution: string;
}

export interface HeatmapLayerOptions {
    id: number;
    /**
     * One OR MORE point sources accumulated into a SINGLE heatmap. Multiple
     * sources → a true additive sum (e.g. "all hazards"): the repr accumulates
     * every source's points by their weight — one layer, one palette, no overlay.
     */
    sources: HeatmapSource[];
    /** Display name for the Horizon layer (suffixed " Data" for the data layer). */
    displayName: string;
    /** 0..1, scales the whole palette alpha (default 1). */
    opacity?: number;
    /** Accumulated weight mapped to the palette top (default {@link HEATMAP_MAX}). */
    max?: number;
    /** Weight attribute carried by each point (default "pop"). */
    weightAttr?: string;
}

/** Create the data + tiles layer pair for a weighted-point population heatmap. */
export async function addWeightedPointHeatmap(
    api: HrzApi.AsyncApi,
    opts: HeatmapLayerOptions,
): Promise<LayerPair> {
    const {
        id,
        sources,
        displayName,
        opacity = HEATMAP_DEFAULT_OPACITY,
        max = HEATMAP_MAX,
        weightAttr = "pop",
    } = opts;

    const dataLayerModel: HrzProtocol.IVectorDataLayer = {
        id,
        sources: sources.map((s) => ({
            pmtilesDataProvider: {
                url: dataUrl(`${s.layerName}.pmtiles`),
                layerName: s.layerName,
                attribution: s.attribution,
            },
            hasGeometry: true,
            attributes: [
                {
                    sourceName: weightAttr,
                    transform:
                        HrzProtocol.AttributeTransform
                            .ATTRIBUTE_TRANSFORM_TO_NUMBER,
                },
            ],
        })),
    };

    const tilesLayerModel: HrzProtocol.IVectorTilesLayer = {
        source: {
            vectorDataLayerId: id,
            overrideLevels: true,
            minLevel: 0,
            maxLevel: 14,
        },
        missingTilePolicy: HrzProtocol.MissingTilePolicy.USE_EMPTY_TILE,
        visible: true,
        staticTiles: true,
        sceneViews: { bits: 3 },
        resolution: { maxScreenSpaceError: 2 },
        clamping: { method: HrzProtocol.VectorClampMode.PER_VERTEX },
        style: {
            attributes: [{ stylingName: weightAttr }],
            // Bind the heatmap weight to the population attribute.
            stylingScript: `set "weight" = attr("${weightAttr}");\nemit 0;`,
            representations: [
                {
                    id: 0,
                    sceneViews: { bits: 3 },
                    heatmap: {
                        discRadius: { defaultValue: DISC_RADIUS_M },
                        discRadiusSizeUnit:
                            HrzProtocol.InWorldSizeUnit.IN_WORLD_SIZE_IN_METERS,
                        blurSize: BLUR_SIZE,
                        value: { name: "weight" },
                        accumulation:
                            HrzProtocol.HeatmapAccumulationMode
                                .HEATMAP_ADDITIVE,
                        numericPalette: buildPalette(opacity, max),
                        zIndex: HEATMAP_ZINDEX,
                    },
                },
            ],
        },
    };

    const dataLayerHandle = await api.LayerService.createLayer({
        name: `${displayName} Data`,
        type: HrzProtocol.LayerType.VECTOR_DATA,
    });
    const tilesLayerHandle = await api.LayerService.createLayer({
        name: displayName,
        type: HrzProtocol.LayerType.VECTOR_TILES,
    });

    HrzApi.VectorDataLayerPathBuilder.create(dataLayerHandle).set(
        api,
        dataLayerModel,
    );
    HrzApi.VectorTilesLayerPathBuilder.create(tilesLayerHandle).set(
        api,
        tilesLayerModel,
    );

    return { data: dataLayerHandle, tiles: tilesLayerHandle };
}
