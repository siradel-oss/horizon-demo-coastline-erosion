import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import type { Text } from "../i18n";
import { IGN_ATTRIBUTION } from "./_shared";

// Géoplateforme IGN — WMTS capabilities. The "essentiels" file is lightweight but
// only contains the flagship layers; the historical orthophotos ("remonter le
// temps" archive) live in the full GetCapabilities.
const WMTS_ESSENTIELS =
    "https://data.geopf.fr/annexes/ressources/wmts/essentiels.xml";
const WMTS_FULL =
    "https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities";

/**
 * IGN "remonter le temps" archive orthophotos — time slices covering all of metropolitan
 * France, from oldest to most recent. Géoplateforme WMTS identifiers.
 */
export interface OrthoTimeLayer {
    label: Text;
    layerIdentifier: string;
    capabilitiesUrl: string;
}

export const ORTHO_TIME_LAYERS: OrthoTimeLayer[] = [
    {
        label: { en: "1950-1965", fr: "1950-1965" },
        layerIdentifier: "ORTHOIMAGERY.ORTHOPHOTOS.1950-1965",
        capabilitiesUrl: WMTS_FULL,
    },
    {
        label: { en: "1965-1980", fr: "1965-1980" },
        layerIdentifier: "ORTHOIMAGERY.ORTHOPHOTOS.1965-1980",
        capabilitiesUrl: WMTS_FULL,
    },
    {
        label: { en: "1980-1995", fr: "1980-1995" },
        layerIdentifier: "ORTHOIMAGERY.ORTHOPHOTOS.1980-1995",
        capabilitiesUrl: WMTS_FULL,
    },
    {
        label: { en: "2000-2005", fr: "2000-2005" },
        layerIdentifier: "ORTHOIMAGERY.ORTHOPHOTOS2000-2005",
        capabilitiesUrl: WMTS_FULL,
    },
    {
        label: { en: "2006-2010", fr: "2006-2010" },
        layerIdentifier: "ORTHOIMAGERY.ORTHOPHOTOS2006-2010",
        capabilitiesUrl: WMTS_FULL,
    },
    {
        label: { en: "2011-2015", fr: "2011-2015" },
        layerIdentifier: "ORTHOIMAGERY.ORTHOPHOTOS2011-2015",
        capabilitiesUrl: WMTS_FULL,
    },
    {
        label: { en: "2016-2020", fr: "2016-2020" },
        layerIdentifier: "ORTHOIMAGERY.ORTHOPHOTOS2016-2020",
        capabilitiesUrl: WMTS_FULL,
    },
    {
        label: { en: "2021-2023", fr: "2021-2023" },
        layerIdentifier: "ORTHOIMAGERY.ORTHOPHOTOS2021-2023",
        capabilitiesUrl: WMTS_FULL,
    },
    {
        label: { en: "Most recent", fr: "La plus récente" },
        layerIdentifier: "ORTHOIMAGERY.ORTHOPHOTOS",
        capabilitiesUrl: WMTS_ESSENTIELS,
    },
];

export const PLAN_IGN_LAYER: OrthoTimeLayer = {
    label: { en: "IGN map", fr: "Plan IGN" },
    layerIdentifier: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2",
    capabilitiesUrl: WMTS_ESSENTIELS,
};

/**
 * Generic WMTS raster imagery layer (dated orthophoto or plan).
 */
export async function addWmtsImageryLayer(
    api: HrzApi.AsyncApi,
    opts: {
        name: string;
        layerIdentifier: string;
        capabilitiesUrl: string;
        // Scene-views bitset (multiview): 1 = view 0 (left/default), 2 = view 1
        // (right), 3 = both. Defaults to view 0.
        sceneViews?: number;
    },
): Promise<HrzProtocol.LayerHandle> {
    let layerModel: HrzProtocol.IImageryRasterLayer = {
        raster: {
            provider: {
                wmts: {
                    url: opts.capabilitiesUrl,
                    attribution: IGN_ATTRIBUTION,
                    layerIdentifier: opts.layerIdentifier,
                    imageFormat: HrzProtocol.ImageFormat.SRGBA_8,
                    missingTilePolicy:
                        HrzProtocol.MissingTilePolicy.USE_LOWER_RESOLUTION,
                },
            },
            sampling: {
                filtering: HrzProtocol.TextureFiltering.BILINEAR,
                alphaChannelUsage:
                    HrzProtocol.AlphaChannelUsage.IGNORE_ALPHA_CHANNEL,
                nodataHandling: HrzProtocol.NodataHandling.IGNORE_NODATA,
            },
            blending: {
                opacity: 1,
            },
            displayBounds: {
                east: 180,
                north: 90,
                south: -90,
                west: -180,
            },
        },
        visible: true,
        sceneViews: {
            bits: opts.sceneViews ?? 1,
        },
    };

    let layerHandle = await api.LayerService.createLayer({
        name: opts.name,
        type: HrzProtocol.LayerType.IMAGERY_RASTER,
    });

    HrzApi.ImageryRasterLayerPathBuilder.create(layerHandle).set(
        api,
        layerModel,
    );

    return layerHandle;
}
