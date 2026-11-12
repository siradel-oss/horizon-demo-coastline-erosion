import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { assetUrl, dataUrl, LayerPair } from "./_shared";

/** Place names (local pre-generated PMTiles, /data/toponyms.pmtiles) rendered as text symbols. */
export async function addToponymsLayer(
    api: HrzApi.AsyncApi,
    id: number,
): Promise<LayerPair> {
    let dataLayerModel: HrzProtocol.IVectorDataLayer = {
        id: id,
        sources: [
            {
                pmtilesDataProvider: {
                    // Local PMTiles file served from public/data/
                    url: dataUrl("toponyms.pmtiles"),
                },
                hasGeometry: true,
                attributes: [
                    {
                        id: 0,
                        sourceName: "name",
                        transform:
                            HrzProtocol.AttributeTransform
                                .ATTRIBUTE_TRANSFORM_TO_STRING,
                    },
                    {
                        id: 1,
                        sourceName: "level",
                        transform:
                            HrzProtocol.AttributeTransform
                                .ATTRIBUTE_TRANSFORM_TO_INT,
                    },
                ],
            },
        ],
    };

    let regionSymbol: HrzProtocol.ISymbolVectorRepr = {
        ignoreWorldOcclusions: true,
        zIndex: 100,
        rootElement: {
            anchor: {
                resetLayout: true,
                canOverlapOtherSymbols: false,
                hidesOtherSymbols: true,
                child: {
                    constrainedBox: {
                        maxSize: { defaultValue: { x: 120, y: 500 } },
                        child: {
                            text: {
                                text: { name: "label" },
                                fontSize: { defaultValue: 14 },
                                textColor: {
                                    defaultValue: {
                                        r: 0.95,
                                        g: 0.95,
                                        b: 0.95,
                                        a: 0.9,
                                    },
                                },
                                outlineWidth: { defaultValue: 0.1 },
                                outlineColor: {
                                    defaultValue: {
                                        r: 0.4,
                                        g: 0.4,
                                        b: 0.5,
                                        a: 1,
                                    },
                                },
                                lineSpacing: { defaultValue: 0.8 },
                                fontUrl: assetUrl(
                                    "SourceSans3-MediumItalic.ttf",
                                ),
                            },
                        },
                    },
                },
            },
        },
    };

    let citySymbol: HrzProtocol.ISymbolVectorRepr = {
        ignoreWorldOcclusions: true,
        zIndex: 70,
        rootElement: {
            stack: {
                children: [
                    {
                        anchor: {
                            resetLayout: true,
                            canOverlapOtherSymbols: false,
                            hidesOtherSymbols: true,
                            child: {
                                sizedBox: {
                                    size: { defaultValue: { x: 12, y: 12 } },
                                    child: {
                                        decoratedShape: {
                                            shapeType:
                                                HrzProtocol.DecoratedShapeType
                                                    .DECORATED_SHAPE_CIRCLE,
                                            color: {
                                                defaultValue: {
                                                    r: 1,
                                                    g: 1,
                                                    b: 1,
                                                    a: 1,
                                                },
                                            },
                                            borderSize: { defaultValue: 1.5 },
                                            borderColor: {
                                                defaultValue: {
                                                    r: 0.1,
                                                    g: 0.1,
                                                    b: 0.2,
                                                    a: 0.8,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    {
                        anchor: {
                            elementAlignment: { defaultValue: { x: 0, y: 1 } },
                            resetLayout: true,
                            canOverlapOtherSymbols: false,
                            hidesOtherSymbols: true,
                            isOptional: true,
                            child: {
                                padding: {
                                    bottomPadding: { defaultValue: 3 },
                                    child: {
                                        constrainedBox: {
                                            maxSize: {
                                                defaultValue: {
                                                    x: 120,
                                                    y: 500,
                                                },
                                            },
                                            child: {
                                                text: {
                                                    text: { name: "label" },
                                                    fontSize: {
                                                        defaultValue: 16,
                                                    },
                                                    textColor: {
                                                        defaultValue: {
                                                            r: 1,
                                                            g: 1,
                                                            b: 1,
                                                            a: 1,
                                                        },
                                                    },
                                                    outlineWidth: {
                                                        defaultValue: 0.125,
                                                    },
                                                    outlineColor: {
                                                        defaultValue: {
                                                            r: 0.1,
                                                            g: 0.1,
                                                            b: 0.2,
                                                            a: 0.8,
                                                        },
                                                    },
                                                    lineSpacing: {
                                                        defaultValue: 0.8,
                                                    },
                                                    fontUrl: assetUrl(
                                                        "SourceSans3-Medium.ttf",
                                                    ),
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
        },
    };

    const TOWN_PADDING = 15;

    let townSymbol: HrzProtocol.ISymbolVectorRepr = {
        ignoreWorldOcclusions: true,
        zIndex: 50,
        rootElement: {
            stack: {
                children: [
                    {
                        anchor: {
                            resetLayout: true,
                            canOverlapOtherSymbols: false,
                            hidesOtherSymbols: false,
                            cullingPriority: { defaultValue: 20 },
                            child: {
                                sizedBox: {
                                    size: { defaultValue: { x: 8, y: 8 } },
                                    child: {
                                        decoratedShape: {
                                            shapeType:
                                                HrzProtocol.DecoratedShapeType
                                                    .DECORATED_SHAPE_CIRCLE,
                                            color: {
                                                defaultValue: {
                                                    r: 1,
                                                    g: 1,
                                                    b: 1,
                                                    a: 0.9,
                                                },
                                            },
                                            borderSize: { defaultValue: 1.2 },
                                            borderColor: {
                                                defaultValue: {
                                                    r: 0.2,
                                                    g: 0.2,
                                                    b: 0.2,
                                                    a: 0.9,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    {
                        anchor: {
                            elementAlignment: { defaultValue: { x: -1, y: 0 } },
                            positionOffset: {
                                defaultValue: { x: -TOWN_PADDING },
                            },
                            positionOffsetSizeUnit:
                                HrzProtocol.SymbolSizeUnit
                                    .SYMBOL_SIZE_IN_PIXELS,
                            resetLayout: true,
                            canOverlapOtherSymbols: false,
                            hidesOtherSymbols: true,
                            isOptional: true,
                            cullingPriority: { defaultValue: 10 },
                            child: {
                                padding: {
                                    topPadding: { defaultValue: TOWN_PADDING },
                                    rightPadding: {
                                        defaultValue: TOWN_PADDING,
                                    },
                                    bottomPadding: {
                                        defaultValue: TOWN_PADDING,
                                    },
                                    leftPadding: {
                                        defaultValue: 6 + TOWN_PADDING,
                                    },
                                    child: {
                                        constrainedBox: {
                                            maxSize: {
                                                defaultValue: {
                                                    x: 120,
                                                    y: 500,
                                                },
                                            },
                                            child: {
                                                text: {
                                                    text: { name: "label" },
                                                    fontSize: {
                                                        defaultValue: 13,
                                                    },
                                                    textColor: {
                                                        defaultValue: {
                                                            r: 1,
                                                            g: 1,
                                                            b: 1,
                                                            a: 0.9,
                                                        },
                                                    },
                                                    outlineWidth: {
                                                        defaultValue: 0.15,
                                                    },
                                                    outlineColor: {
                                                        defaultValue: {
                                                            r: 0.2,
                                                            g: 0.2,
                                                            b: 0.2,
                                                            a: 0.9,
                                                        },
                                                    },
                                                    lineSpacing: {
                                                        defaultValue: 0.8,
                                                    },
                                                    alignment: {
                                                        defaultValue:
                                                            HrzProtocol
                                                                .TextAlignment
                                                                .LEFT_ALIGNED,
                                                    },
                                                    fontUrl: assetUrl(
                                                        "SourceSans3-Regular.ttf",
                                                    ),
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
        },
    };

    let neighborhoodSymbol: HrzProtocol.ISymbolVectorRepr = {
        ignoreWorldOcclusions: true,
        zIndex: 40,
        rootElement: {
            anchor: {
                positionOffset: { defaultValue: { z: 10 } },
                positionOffsetSizeUnit:
                    HrzProtocol.SymbolSizeUnit.SYMBOL_SIZE_IN_METERS,
                resetLayout: true,
                canOverlapOtherSymbols: false,
                hidesOtherSymbols: true,
                child: {
                    constrainedBox: {
                        maxSize: { defaultValue: { x: 120, y: 500 } },
                        child: {
                            text: {
                                text: { name: "label" },
                                fontSize: { defaultValue: 12 },
                                textColor: {
                                    defaultValue: { r: 1, g: 1, b: 1, a: 0.9 },
                                },
                                outlineWidth: { defaultValue: 0.25 },
                                outlineColor: {
                                    defaultValue: { r: 0, g: 0, b: 0, a: 0.5 },
                                },
                                lineSpacing: { defaultValue: 0.8 },
                                fontUrl: assetUrl("SourceSans3-Italic.ttf"),
                            },
                        },
                    },
                },
            },
        },
    };

    let tilesLayerModel: HrzProtocol.IVectorTilesLayer = {
        source: {
            vectorDataLayerId: id,
        },
        staticTiles: true,
        visible: true,
        sceneViews: { bits: 3 },
        resolution: { maxScreenSpaceError: 3 },
        clamping: { method: HrzProtocol.VectorClampMode.ANCHOR },
        style: {
            attributes: [
                { stylingName: "name", vectorDataAttrId: 0 },
                { stylingName: "level", vectorDataAttrId: 1 },
            ],
            stylingScript: `
                set "label" = attr("name");
                emit attr("level");
            `,
            representations: [
                {
                    id: 1,
                    sceneViews: { bits: 3 },
                    symbol: regionSymbol,
                },
                {
                    id: 2,
                    sceneViews: { bits: 3 },
                    symbol: citySymbol,
                },
                {
                    id: 3,
                    sceneViews: { bits: 3 },
                    symbol: townSymbol,
                },
                {
                    id: 4,
                    sceneViews: { bits: 3 },
                    symbol: neighborhoodSymbol,
                },
            ],
        },
    };

    let dataLayerHandle = await api.LayerService.createLayer({
        name: "Toponyms Data",
        type: HrzProtocol.LayerType.VECTOR_DATA,
    });

    let tilesLayerHandle = await api.LayerService.createLayer({
        name: "Toponyms",
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
