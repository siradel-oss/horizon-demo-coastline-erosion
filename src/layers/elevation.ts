import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { IGN_ATTRIBUTION } from "./_shared";

/** IGN WMTS DTM raster (BIL float32). `layerIdentifier` selects the source. */
async function addIgnDtmLayer(
    api: HrzApi.AsyncApi,
    opts: { name: string; layerIdentifier: string },
): Promise<HrzProtocol.LayerHandle> {
    let layerModel: HrzProtocol.IDtmRasterLayer = {
        raster: {
            sampling: {
                // SRTM3 is already 0 m at sea; forcing nodata to 0 keeps a
                // continuous sea floor.
                nodataHandling: HrzProtocol.NodataHandling.SET_NODATA_TO_ZERO,
                filtering: HrzProtocol.TextureFiltering.BILINEAR,
            },
            displayBounds: { west: -180, south: -90, east: 180, north: 90 },
            provider: {
                wmts: {
                    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities",
                    layerIdentifier: opts.layerIdentifier,
                    sourceImageFormat: "image/x-bil;bits=32",
                    imageFormat: HrzProtocol.ImageFormat.R_F32,
                    attribution: IGN_ATTRIBUTION,
                    nodata: {
                        hasNodata: true,
                        value: {
                            floatValue: -99999,
                        },
                    },
                    mimeTypeOverride:
                        "image/x.raw;width=256;height=256;channels=1;bit_width=32;interleaving=line",
                },
            },
        },
        visible: true,
    };

    let layerHandle = await api.LayerService.createLayer({
        name: opts.name,
        type: HrzProtocol.LayerType.DTM_RASTER,
    });

    HrzApi.DtmRasterLayerPathBuilder.create(layerHandle).set(api, layerModel);

    return layerHandle;
}

export function addIgnSrtmDtmLayer(
    api: HrzApi.AsyncApi,
): Promise<HrzProtocol.LayerHandle> {
    return addIgnDtmLayer(api, {
        name: "IGN SRTM3 DTM",
        layerIdentifier: "ELEVATION.ELEVATIONGRIDCOVERAGE.SRTM3",
    });
}

// --- RGE ALTI® cleaned client-side -----------------------------------------
//
// RGE ALTI® returns -99999 (nodata) at sea and 404s at deep zooms: the terrain
// gets holes along the coast. Rather than stacking sources, tiles are served
// through the `client:` scheme: each tile is fetched from IGN then "cleaned"
// (nodata / missing tile → 0 m) before being handed to the engine. Bilinear
// filtering then smooths the coastal transition cleanly.

const TILE_PX = 256;
const TILE_BYTES = TILE_PX * TILE_PX * 4; // R_F32
// Client tile path. The provider uses it prefixed with `client:`, but the engine
// delivers the asset URL without that prefix — so we match on the path alone.
const RGE_DTM_PATH = "/rge-dtm/";
const RGE_DTM_MIME =
    "image/x.raw;width=256;height=256;channels=1;bit_width=32;interleaving=line";

/** IGN WMTS URL of an RGE ALTI® tile (BIL float32, WGS84G grid). */
function ignRgeAltiTileUrl(z: number, x: number, y: number): string {
    return (
        "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile" +
        "&LAYER=ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES&STYLE=normal" +
        `&TILEMATRIXSET=WGS84G_6_14&TILEMATRIX=${z}&TILECOL=${x}&TILEROW=${y}` +
        "&FORMAT=image/x-bil;bits=32"
    );
}

/**
 * Fetches an RGE ALTI® tile and cleans it: nodata pixels (and any missing /
 * failed tile) become 0 m. Returns 256×256 little-endian float32.
 */
async function fetchCleanRgeAltiTile(
    z: number,
    x: number,
    y: number,
): Promise<Uint8Array> {
    try {
        const resp = await fetch(ignRgeAltiTileUrl(z, x, y));
        if (!resp.ok) return new Uint8Array(TILE_BYTES); // 404 → sea at 0 m
        const buf = await resp.arrayBuffer();
        if (buf.byteLength !== TILE_BYTES) return new Uint8Array(TILE_BYTES);
        // fetch already decodes Content-Encoding: deflate → raw float32 (LE).
        const px = new Float32Array(buf);
        // RGE ALTI® marks the sea as -99999. When building its pyramid, IGN
        // averages valid pixels with that nodata along the coastline, producing
        // a continuum of spurious negative values (down to ~-99999) that cause
        // craters near cliffs. Real terrain being positive, any negative
        // altitude is clamped to sea level.
        for (let i = 0; i < px.length; i++) {
            if (px[i] < 0) px[i] = 0;
        }
        return new Uint8Array(buf);
    } catch {
        return new Uint8Array(TILE_BYTES);
    }
}

/**
 * Answers a `client:/rge-dtm/{z}/{x}/{y}` asset request; ignores other URLs.
 * Register once on the ASSET_REQUEST_MESSAGE messages.
 */
export function serveRgeDtmAsset(
    api: HrzApi.AsyncApi,
    req: HrzProtocol.IAssetRequestMessage | null | undefined,
): void {
    const url = req?.url;
    const at = url ? url.indexOf(RGE_DTM_PATH) : -1;
    if (at < 0) return;
    const [z, x, y] = url!
        .slice(at + RGE_DTM_PATH.length)
        .split("/")
        .map((s) => parseInt(s, 10));
    void (async () => {
        const tile = await fetchCleanRgeAltiTile(z, x, y);
        // The engine may request a sub-range of the asset (rangeSize 0 = all).
        const start = Number(req!.rangeStart ?? 0);
        const size = Number(req!.rangeSize ?? 0);
        const data = size > 0 ? tile.subarray(start, start + size) : tile;
        // Format carried by the provider's mimeTypeOverride (raw float32).
        await api.ClientDataService.provideAssetData({
            ticket: req!.ticket,
            data,
        });
    })();
}

/**
 * RGE ALTI® DTM served as cleaned `client:` tiles (see serveRgeDtmAsset).
 * The EPSG:4326 grid (levelZero 2×1) mirrors IGN's WGS84G: Horizon (z,x,y) =
 * IGN (TILEMATRIX, TILECOL, TILEROW).
 */
export async function addIgnRgeAltiDtmLayer(
    api: HrzApi.AsyncApi,
): Promise<HrzProtocol.LayerHandle> {
    let layerModel: HrzProtocol.IDtmRasterLayer = {
        raster: {
            sampling: {
                nodataHandling: HrzProtocol.NodataHandling.IGNORE_NODATA,
                filtering: HrzProtocol.TextureFiltering.BILINEAR,
            },
            displayBounds: { west: -180, south: -90, east: 180, north: 90 },
            provider: {
                tiled: {
                    urlPattern: `client:${RGE_DTM_PATH}{z}/{x}/{y}`,
                    imageFormat: HrzProtocol.ImageFormat.R_F32,
                    mimeTypeOverride: RGE_DTM_MIME,
                    attribution: IGN_ATTRIBUTION,
                    geometry: {
                        projection: {
                            descriptorType:
                                HrzProtocol.SrsDescriptorType.SRID_DESCRIPTOR,
                            descriptor: "EPSG:4326",
                        },
                    },
                    tilingScheme: {
                        globalTiling: {
                            tileSize: TILE_PX,
                            levelZeroTileCountX: 2,
                            levelZeroTileCountY: 1,
                            maxLevel: 14,
                        },
                    },
                },
            },
        },
        visible: true,
    };

    let layerHandle = await api.LayerService.createLayer({
        name: "IGN RGE ALTI (client)",
        type: HrzProtocol.LayerType.DTM_RASTER,
    });

    HrzApi.DtmRasterLayerPathBuilder.create(layerHandle).set(api, layerModel);

    return layerHandle;
}
