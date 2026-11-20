import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";

/**
 * Shared foundation for the layer sub-modules (src/layers/*).
 * Generic constants and factories reused across several layer sets.
 * Depends on no layer set — the layer sets depend on it, never the reverse.
 */

// On-map credit for the IGN layers (basemap, relief, 3D buildings). Producer only,
// no licence: this string feeds the permanent on-map credit line, which shows only
// the sources of the VISIBLE layers. The full products & licences (BD ORTHO®, PLAN
// IGN, RGE ALTI®, BD TOPO®, ADMIN EXPRESS — Licence Ouverte 2.0) live in the
// exhaustive Attributions panel.
export const IGN_ATTRIBUTION = "IGN — Géoplateforme";

/**
 * Absolute URL of the app's deploy base (Vite `base`, "./" in builds),
 * resolved against the page so it stays valid inside the engine workers.
 * Always ends with "/".
 */
export const baseUrl = (): string =>
    new URL(import.meta.env.BASE_URL, document.baseURI).href;

/**
 * Resolves a static asset (vendored in resources/, served at the deploy base
 * root) against the deploy base.
 */
export const assetUrl = (file: string): string => `${baseUrl()}${file}`;

/** Resolves a local tiled-data file served under <base>/data/. */
export const dataUrl = (file: string): string => assetUrl(`data/${file}`);

/** Maxzoom of the bundled PMTiles. Horizon overzooms beyond it. */
export const PMTILES_MAX_LEVEL = 14;

/** Handle pair returned by the vector layers (data + tiles). */
export type LayerPair = {
    data: HrzProtocol.LayerHandle;
    tiles: HrzProtocol.LayerHandle;
};

type ColorBinding = {
    name?: string;
    defaultValue: { r: number; g: number; b: number; a: number };
};

/**
 * Generic factory for a "flat overlay" vector layer fed by a local
 * PMTiles (served under <base>/data/<layerName>.pmtiles).
 * Factors out the whole skeleton (provider, levels, repr, creation); each
 * layer set only supplies its style (script + color binding) and its attributes.
 * Used by coastline, erosion indicator, risk zones.
 */
export async function addPmtilesFlatOverlay(
    api: HrzApi.AsyncApi,
    opts: {
        id: number;
        // Base name: data layer = `${name} Data`, tiles layer = `${name}`.
        name: string;
        // /data/<layerName>.pmtiles file + its internal vector layer name.
        layerName: string;
        attribution: string;
        // Numeric attributes exposed to the styling script (e.g. ["taux"]).
        numericAttributes?: string[];
        // Numeric attributes used BOTH by the styling script AND returned on pick.
        // Declared once with a stable `id` and linked to the styling by
        // `vectorDataAttrId` (see Horizon flatOverlay example) so a single value
        // serves both. `attr(sourceName)` stays usable in the styling script.
        pickableNumericAttributes?: { id: number; sourceName: string }[];
        // Attributes loaded only to be returned on pick (not used by styling).
        // Each needs a stable `id` to read it back from the pick result.
        pickAttributes?: { id: number; sourceName: string }[];
        stylingScript: string;
        color: ColorBinding;
        zIndex: number;
        // Geometry type of the PMTiles features (defaults to "polygon").
        geometry?: "polygon" | "polyline";
        // Line width in pixels, polyline geometry only.
        lineWidth?: number;
        // Optional polygon outline: a 2nd (polyline) repr that draws
        // the edge in a strong opaque color. NB: to render BOTH fill and outline,
        // the `stylingScript` must fork (`fork { emit 0; } fork { emit 1; }`) —
        // `emit N` renders only ONE representation (the one with id N).
        outline?: {
            color: { r: number; g: number; b: number; a: number };
            width?: number;
        };
        // Clips the geometry to each tile edge: hides the tiler
        // margins which, when transparent, overlap and darken the tile seams.
        // Enable it for semi-opaque polygons.
        clipToTile?: boolean;
        // PMTiles maxzoom. Must match the file, else the engine
        // requests missing tiles. Defaults to PMTILES_MAX_LEVEL (z14); lower it
        // for size-optimized layers tiled at a smaller maxzoom (Horizon overzooms).
        maxLevel?: number;
    },
): Promise<LayerPair> {
    const attrs = opts.numericAttributes ?? [];
    const pickNumAttrs = opts.pickableNumericAttributes ?? [];
    const pickAttrs = opts.pickAttributes ?? [];
    const needsFeatureId = pickAttrs.length > 0 || pickNumAttrs.length > 0;
    const clipToTile = opts.clipToTile ?? false;

    const lineWidthUnit = HrzProtocol.InWorldSizeUnit.IN_WORLD_SIZE_IN_PIXELS;
    const representations: HrzProtocol.IVectorRepr[] = [
        opts.geometry === "polyline"
            ? {
                  id: 0,
                  sceneViews: { bits: 3 },
                  flatOverlayPolyline: {
                      color: opts.color,
                      width: { defaultValue: opts.lineWidth ?? 3 },
                      // Pixels: otherwise the width is in meters -> invisible at country scale.
                      widthUnit: lineWidthUnit,
                      zIndex: opts.zIndex,
                      clipToTile,
                  },
              }
            : {
                  id: 0,
                  sceneViews: { bits: 3 },
                  flatOverlayPolygon: {
                      color: opts.color,
                      zIndex: opts.zIndex,
                      clipToTile,
                  },
              },
    ];
    if (opts.outline) {
        // A polyline representation applied to polygon features draws their outline.
        representations.push({
            id: 1,
            sceneViews: { bits: 3 },
            flatOverlayPolyline: {
                color: { defaultValue: opts.outline.color },
                width: { defaultValue: opts.outline.width ?? 1.5 },
                widthUnit: lineWidthUnit,
                // Outline drawn inside the polygon -> does not bleed onto neighbors.
                side: HrzProtocol.PolylineSide.SIDE_INSIDE,
                zIndex: opts.zIndex + 1,
                clipToTile,
            },
        });
    }

    const dataLayerModel: HrzProtocol.IVectorDataLayer = {
        id: opts.id,
        sources: [
            {
                pmtilesDataProvider: {
                    url: dataUrl(`${opts.layerName}.pmtiles`),
                    layerName: opts.layerName,
                    attribution: opts.attribution,
                },
                hasGeometry: true,
                attributes: [
                    ...attrs.map((sourceName) => ({
                        sourceName,
                        transform:
                            HrzProtocol.AttributeTransform
                                .ATTRIBUTE_TRANSFORM_TO_NUMBER,
                    })),
                    // Numeric + pickable: keep the TO_NUMBER transform (styling)
                    // and an id (read back on pick).
                    ...pickNumAttrs.map(({ id, sourceName }) => ({
                        id,
                        sourceName,
                        transform:
                            HrzProtocol.AttributeTransform
                                .ATTRIBUTE_TRANSFORM_TO_NUMBER,
                    })),
                    // Feature id (virtual, from the tile) so the engine can
                    // identify a picked feature and return its attributes.
                    // Both flags are required: isSourceFeatureIds loads the MVT
                    // id, isFeatureId makes it a constituent of the layer's
                    // feature id (needed for picking) — see Horizon docs.
                    ...(needsFeatureId
                        ? [
                              {
                                  id: 0,
                                  isSourceFeatureIds: true,
                                  isFeatureId: true,
                              },
                          ]
                        : []),
                    ...pickAttrs.map(({ id, sourceName }) => ({
                        id,
                        sourceName,
                    })),
                ],
            },
        ],
    };

    const tilesLayerModel: HrzProtocol.IVectorTilesLayer = {
        source: {
            vectorDataLayerId: opts.id,
            // Caps the zoom at the PMTiles maxzoom: Horizon overzooms beyond it
            // instead of requesting non-existent tiles.
            overrideLevels: true,
            minLevel: 0,
            maxLevel: opts.maxLevel ?? PMTILES_MAX_LEVEL,
        },
        // Missing tiles (sea / inland) treated as empty, without error.
        missingTilePolicy: HrzProtocol.MissingTilePolicy.USE_EMPTY_TILE,
        visible: true,
        staticTiles: true,
        sceneViews: { bits: 3 },
        resolution: { maxScreenSpaceError: 2 },
        clamping: { method: HrzProtocol.VectorClampMode.PER_VERTEX },
        style: {
            attributes: [
                ...attrs.map((stylingName) => ({ stylingName })),
                // Link the pickable numeric attrs to the styling by their id
                // so `attr(sourceName)` resolves to the same loaded value.
                ...pickNumAttrs.map(({ id, sourceName }) => ({
                    vectorDataAttrId: id,
                    stylingName: sourceName,
                })),
            ],
            stylingScript: opts.stylingScript,
            representations,
        },
    };

    const dataLayerHandle = await api.LayerService.createLayer({
        name: `${opts.name} Data`,
        type: HrzProtocol.LayerType.VECTOR_DATA,
    });
    const tilesLayerHandle = await api.LayerService.createLayer({
        name: opts.name,
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
