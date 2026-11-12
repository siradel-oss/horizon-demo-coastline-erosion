import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";

/**
 * Transient "search marker" — a single pin dropped at a geocoded address.
 * Self-contained (no external sprite): a screen-facing DecoratedShape circle
 * (green, white border) driven by an IN-MEMORY vector source, so its
 * position can be updated without recreating the layers. Chain of 3 layers,
 * following the Horizon "Markers" gallery demo:
 *   IN_MEMORY_VECTOR_SOURCE (features) → VECTOR_DATA (inMemory provider) → VECTOR_TILES (symbol).
 */

/** Handles of the marker's three chained layers. */
export interface MarkerHandles {
    source: HrzProtocol.LayerHandle;
    data: HrzProtocol.LayerHandle;
    tiles: HrzProtocol.LayerHandle;
}

// Layer ids, kept clear of the thematic layers (10–30 range).
const INMEM_ID = 50;
const DATA_ID = 51;
// Green fill + white border — reads over ortho and plan basemaps.
const PIN_FILL = { r: 0.29, g: 0.87, b: 0.5, a: 1 };
const PIN_BORDER = { r: 1, g: 1, b: 1, a: 1 };
const PIN_SIZE_PX = 18;

/** Sets the in-memory source to a single point, or empties it (hides the pin). */
function setFeatures(
    api: HrzApi.AsyncApi,
    source: HrzProtocol.LayerHandle,
    point: { lon: number; lat: number } | null,
): void {
    HrzApi.InMemoryVectorSourceLayerPathBuilder.create(source).set(api, {
        id: INMEM_ID,
        projection: {
            descriptorType: HrzProtocol.SrsDescriptorType.SRID_DESCRIPTOR,
            descriptor: "EPSG:4326",
        },
        features: point
            ? [
                  {
                      geometry: [
                          {
                              type: HrzProtocol.VectorGeometryType
                                  .POINT_GEOMETRY,
                              coords: [point.lon, point.lat, 0],
                          },
                      ],
                  },
              ]
            : [],
    });
}

/** Creates the (initially empty) marker layers; call {@link setSearchMarker} to show it. */
export async function addSearchMarker(
    api: HrzApi.AsyncApi,
): Promise<MarkerHandles> {
    const source = await api.LayerService.createLayer({
        name: "Search marker source",
        type: HrzProtocol.LayerType.IN_MEMORY_VECTOR_SOURCE,
    });
    const data = await api.LayerService.createLayer({
        name: "Search marker data",
        type: HrzProtocol.LayerType.VECTOR_DATA,
    });
    const tiles = await api.LayerService.createLayer({
        name: "Search marker",
        type: HrzProtocol.LayerType.VECTOR_TILES,
    });

    setFeatures(api, source, null);

    HrzApi.VectorDataLayerPathBuilder.create(data).set(api, {
        id: DATA_ID,
        sources: [
            {
                inMemoryDataProvider: { inMemoryLayerId: INMEM_ID },
                hasGeometry: true,
            },
        ],
    });

    HrzApi.VectorTilesLayerPathBuilder.create(tiles).set(api, {
        source: { vectorDataLayerId: DATA_ID },
        visible: true,
        sceneViews: { bits: 3 },
        resolution: { maxScreenSpaceError: 2 },
        // Snap the pin onto the terrain surface (2D features, no meaningful z).
        clamping: { method: HrzProtocol.VectorClampMode.ANCHOR, useZ: false },
        style: {
            // A representation is only drawn if the styling script emits it.
            stylingScript: "emit 0;",
            representations: [
                {
                    id: 0,
                    sceneViews: { bits: 3 },
                    symbol: {
                        // Draw over the terrain — never hidden behind relief.
                        ignoreWorldOcclusions: true,
                        rootElement: {
                            anchor: {
                                positionOffset: {
                                    defaultValue: { x: 0, y: 0, z: 0 },
                                },
                                positionOffsetSizeUnit:
                                    HrzProtocol.SymbolSizeUnit
                                        .SYMBOL_SIZE_IN_PIXELS,
                                // Screen-facing billboard, constant on-screen size.
                                xAxisAlignment:
                                    HrzProtocol.SymbolAxisAlignment
                                        .AXIS_ALIGNMENT_SCREEN,
                                yAxisAlignment:
                                    HrzProtocol.SymbolAxisAlignment
                                        .AXIS_ALIGNMENT_SCREEN,
                                elementSizeUnit:
                                    HrzProtocol.SymbolSizeUnit
                                        .SYMBOL_SIZE_IN_PIXELS,
                                elementAlignment: {
                                    defaultValue: { x: 0, y: 0 },
                                },
                                canOverlapOtherSymbols: true,
                                hidesOtherSymbols: false,
                                child: {
                                    sizedBox: {
                                        size: {
                                            defaultValue: {
                                                x: PIN_SIZE_PX,
                                                y: PIN_SIZE_PX,
                                            },
                                        },
                                        child: {
                                            decoratedShape: {
                                                color: {
                                                    defaultValue: PIN_FILL,
                                                },
                                                borderColor: {
                                                    defaultValue: PIN_BORDER,
                                                },
                                                borderSize: { defaultValue: 2 },
                                                shapeType:
                                                    HrzProtocol
                                                        .DecoratedShapeType
                                                        .DECORATED_SHAPE_CIRCLE,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        },
    });

    return { source, data, tiles };
}

/** Moves the marker to a WGS84 point (creates the single feature). */
export function setSearchMarker(
    api: HrzApi.AsyncApi,
    h: MarkerHandles,
    lon: number,
    lat: number,
): void {
    setFeatures(api, h.source, { lon, lat });
}

/** Hides the marker (empties the feature source) without destroying the layers. */
export function clearSearchMarker(
    api: HrzApi.AsyncApi,
    h: MarkerHandles,
): void {
    setFeatures(api, h.source, null);
}

/** Destroys the three marker layers (component teardown). */
export function removeSearchMarker(
    api: HrzApi.AsyncApi,
    h: MarkerHandles,
): void {
    api.LayerService.destroyLayer(h.tiles);
    api.LayerService.destroyLayer(h.data);
    api.LayerService.destroyLayer(h.source);
}
