import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { IGN_ATTRIBUTION, LayerPair } from "./_shared";

/** Extruded 3D buildings (IGN BD TOPO® via PLAN.IGN vector tiles, `hauteur` attribute). */
export async function addBuildingsLayer(
    api: HrzApi.AsyncApi,
    id: number,
): Promise<LayerPair> {
    let dataLayerModel: HrzProtocol.IVectorDataLayer = {
        id: id,
        sources: [
            {
                hasGeometry: true,
                attributes: [
                    {
                        sourceName: "hauteur",
                        transform:
                            HrzProtocol.AttributeTransform
                                .ATTRIBUTE_TRANSFORM_TO_NUMBER,
                    },
                ],
                tilejsonDataProvider: {
                    url: "https://data.geopf.fr/tms/1.0.0/PLAN.IGN/metadata.json/",
                    httpHeaders: {},
                    layerName: "bati_surf",
                    attribution: IGN_ATTRIBUTION,
                },
            },
        ],
    };

    let tilesLayerModel: HrzProtocol.IVectorTilesLayer = {
        source: {
            vectorDataLayerId: id,
            bounds: {
                west: -180,
                south: -90,
                east: 180,
                north: 90,
            },
        },
        style: {
            representations: [
                {
                    sceneViews: {
                        bits: 3,
                    },
                    extrudedGeometry: {
                        lighting: {
                            enableLighting: true,
                            castShadows: true,
                            receiveShadows: true,
                        },
                        extrusion: {
                            name: "extrusion",
                        },
                        upperColor: {
                            defaultValue: {
                                r: 0.9,
                                g: 0.9,
                                b: 0.9,
                                a: 1,
                            },
                        },
                        lowerColor: {
                            defaultValue: {
                                r: 0.5,
                                g: 0.5,
                                b: 0.5,
                                a: 1,
                            },
                        },
                        roofColor: {
                            defaultValue: {
                                r: 0.95,
                                g: 0.95,
                                b: 0.95,
                                a: 1,
                            },
                        },
                        clipToTile: true,
                    },
                },
            ],
            stylingScript: `
                if (attr("hauteur") < 0.1) { discard; }
                set "extrusion" = attr("hauteur");
                emit 0;
            `,
            attributes: [
                {
                    stylingName: "hauteur",
                },
            ],
        },
        clamping: {
            method: HrzProtocol.VectorClampMode.PER_VERTEX,
        },
        resolution: {
            maxScreenSpaceError: 2,
        },
        visible: true,
        clipId: -1,
        lighting: {
            enableLighting: true,
            castShadows: true,
            receiveShadows: true,
        },
        sceneViews: {
            bits: 3,
        },
        staticTiles: true,
    };

    let dataLayerHandle = await api.LayerService.createLayer({
        name: "Buildings Data",
        type: HrzProtocol.LayerType.VECTOR_DATA,
    });

    let tilesLayerHandle = await api.LayerService.createLayer({
        name: "Buildings",
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
