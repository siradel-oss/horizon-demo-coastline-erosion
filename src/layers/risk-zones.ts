import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import type { Text } from "../i18n";
import {
    addPmtilesFlatOverlay,
    dataUrl,
    LayerPair,
    PMTILES_MAX_LEVEL,
} from "./_shared";
import { INTENSITY_RAMP } from "./_heatmap";

/**
 * Legend for the risk zones (classes of PROJECTED retreat at a horizon).
 * Shared sequential INTENSITY palette (magma, low → high), perceptually uniform
 * and colorblind-safe — the same ramp as the exposed-population heatmaps.
 */
export const RISK_LEGEND: readonly { label: Text; color: string }[] = [
    {
        label: { en: "Very high (> 100 m)", fr: "Très élevé (> 100 m)" },
        color: INTENSITY_RAMP[3],
    },
    {
        label: { en: "High (50–100 m)", fr: "Élevé (50–100 m)" },
        color: INTENSITY_RAMP[2],
    },
    {
        label: { en: "Moderate (25–50 m)", fr: "Modéré (25–50 m)" },
        color: INTENSITY_RAMP[1],
    },
    {
        label: { en: "Low (10–25 m)", fr: "Faible (10–25 m)" },
        color: INTENSITY_RAMP[0],
    },
];

/** Reference year of the Cerema erosion indicator (measured rate). */
export const EROSION_BASE_YEAR = 2018;

/**
 * Stable attribute ids. `TAUX` (erosion rate) is read back on click to surface
 * the projected retreat. `CLASSE` (risk class) only needs an id so the landward
 * band's attributes are ALL explicitly numbered: as soon as a layer declares
 * ids / a feature-id, every attribute must carry an id (else an unnumbered one
 * defaults to id 0 and collides with the feature-id) — see Horizon docs.
 */
export const RISK_PICK_ATTR = { TAUX: 1, CLASSE: 2 } as const;

/** Default fill opacity of the risk zones. */
export const RISK_DEFAULT_OPACITY = 0.85;
/** Bounds of the opacity slider (the min > 0 keeps the layer visible). */
export const RISK_OPACITY_RANGE = { min: 0.15, max: 1, step: 0.05 };

const RISK_LAYER_NAME = "trait_cote_evolution";
const RISK_ATTRIBUTION =
    "Cerema — indicateur national de l'érosion côtière (2018), traitement Siradel";

const BAND_ATTRIBUTION =
    "Cerema — érosion côtière (2018) × IGN ADMIN EXPRESS, traitement Siradel";

/**
 * Sets the class color `"color"` from the projected retreat `|taux| × years`,
 * discarding non-erosion / non-computed / sub-10 m sectors. Shared by the flat
 * and 3D representations so both use the exact same thresholds and palette.
 * `t(m)` maps a retreat threshold (m) to the rate threshold (m/yr) at the horizon.
 */
function riskColorScript(t: (m: number) => string, alpha: string): string {
    return `
        if (attr("taux") == -9999) { discard; }
        if (attr("taux") < ${t(100)}) { set "color" = alpha(${INTENSITY_RAMP[3]}, ${alpha}); }
        elif (attr("taux") < ${t(50)}) { set "color" = alpha(${INTENSITY_RAMP[2]}, ${alpha}); }
        elif (attr("taux") < ${t(25)}) { set "color" = alpha(${INTENSITY_RAMP[1]}, ${alpha}); }
        elif (attr("taux") < ${t(10)}) { set "color" = alpha(${INTENSITY_RAMP[0]}, ${alpha}); }
        else { discard; }`;
}

/** Retreat threshold (m) -> rate threshold (m/yr) at the horizon: taux < -m/years. */
const rateThreshold = (years: number) => (m: number) => (-m / years).toFixed(4);

/**
 * Retreat risk zones at a given horizon: SAME polygons as the erosion
 * indicator (`trait_cote_evolution`), recolored by **projected retreat** class
 * (`|taux| × (horizon − reference year)`). Only the sectors in erosion (`taux < 0`)
 * with significant retreat (> 10 m at the horizon) are shown; the rest is discarded.
 * Estimation by trend extrapolation — not an official forecast.
 */
export function addRiskZonesLayer(
    api: HrzApi.AsyncApi,
    id: number,
    horizon: number,
    opacity: number = RISK_DEFAULT_OPACITY,
): Promise<LayerPair> {
    const t = rateThreshold(horizon - EROSION_BASE_YEAR);
    // Opacity injected into the script: alpha(color, a) — see Horizon styling_api.
    const a = opacity.toFixed(2);

    return addPmtilesFlatOverlay(api, {
        id,
        name: "Risk zones",
        layerName: RISK_LAYER_NAME,
        attribution: RISK_ATTRIBUTION,
        // `taux` drives the styling AND is returned on pick (projected retreat).
        pickableNumericAttributes: [
            { id: RISK_PICK_ATTR.TAUX, sourceName: "taux" },
        ],
        // Projected retreat classes = |taux| × years (RISK_LEGEND, magma intensity ramp).
        stylingScript: `${riskColorScript(t, a)}
            emit 0;
        `,
        color: {
            name: "color",
            defaultValue: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        },
        // Semi-opaque polygons -> clip the tile seams.
        clipToTile: true,
        zIndex: 35,
    });
}

/**
 * Depth-of-impact "ground projection" (the "ground" depth mode): the landward
 * band of threatened land, pre-generated per horizon (eroding sectors buffered by their projected retreat, clipped to the IGN land
 * mask). Colored by risk class (`classe` 1..4), and `taux` kept so the click
 * popup reads the projected retreat like the other modes. Separate PMTiles per
 * horizon (the buffer distance — hence the geometry — depends on the horizon).
 */
export function addRiskBandLayer(
    api: HrzApi.AsyncApi,
    id: number,
    horizon: number,
    opacity: number = RISK_DEFAULT_OPACITY,
): Promise<LayerPair> {
    const a = opacity.toFixed(2);
    return addPmtilesFlatOverlay(api, {
        id,
        name: "Ground projection",
        layerName: `profondeur_impact_${horizon}`,
        attribution: BAND_ATTRIBUTION,
        // `classe` drives the color; `taux` is returned on pick (projected retreat).
        // Both carry an explicit id (alongside the pick feature-id) to avoid the
        // id-0 collision — hence both via pickableNumericAttributes.
        pickableNumericAttributes: [
            { id: RISK_PICK_ATTR.TAUX, sourceName: "taux" },
            { id: RISK_PICK_ATTR.CLASSE, sourceName: "classe" },
        ],
        stylingScript: `
            if (attr("classe") == 4) { set "color" = alpha(${INTENSITY_RAMP[3]}, ${a}); }
            elif (attr("classe") == 3) { set "color" = alpha(${INTENSITY_RAMP[2]}, ${a}); }
            elif (attr("classe") == 2) { set "color" = alpha(${INTENSITY_RAMP[1]}, ${a}); }
            else { set "color" = alpha(${INTENSITY_RAMP[0]}, ${a}); }
            emit 0;
        `,
        color: {
            name: "color",
            defaultValue: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        },
        clipToTile: true,
        zIndex: 35,
    });
}

/**
 * Depth-of-impact "3D comparison" of the SAME risk polygons: each sector is
 * extruded by its **projected retreat in metres** (`|taux| × years`) and colored
 * by risk class. Height = magnitude of the retreat, so sectors are visually
 * comparable. Reads `taux` on pick like the flat layer. Zero new data.
 */
export async function addRiskDepthLayer(
    api: HrzApi.AsyncApi,
    id: number,
    horizon: number,
    opacity: number = RISK_DEFAULT_OPACITY,
): Promise<LayerPair> {
    const years = horizon - EROSION_BASE_YEAR;
    const t = rateThreshold(years);
    const a = opacity.toFixed(2);

    const dataLayerModel: HrzProtocol.IVectorDataLayer = {
        id,
        sources: [
            {
                pmtilesDataProvider: {
                    url: dataUrl(`${RISK_LAYER_NAME}.pmtiles`),
                    layerName: RISK_LAYER_NAME,
                    attribution: RISK_ATTRIBUTION,
                },
                hasGeometry: true,
                attributes: [
                    {
                        id: RISK_PICK_ATTR.TAUX,
                        sourceName: "taux",
                        transform:
                            HrzProtocol.AttributeTransform
                                .ATTRIBUTE_TRANSFORM_TO_NUMBER,
                    },
                    // Feature id so a clicked prism returns its attributes.
                    { id: 0, isSourceFeatureIds: true, isFeatureId: true },
                ],
            },
        ],
    };

    const tilesLayerModel: HrzProtocol.IVectorTilesLayer = {
        source: {
            vectorDataLayerId: id,
            overrideLevels: true,
            minLevel: 0,
            maxLevel: PMTILES_MAX_LEVEL,
        },
        missingTilePolicy: HrzProtocol.MissingTilePolicy.USE_EMPTY_TILE,
        visible: true,
        staticTiles: true,
        sceneViews: { bits: 3 },
        resolution: { maxScreenSpaceError: 2 },
        clamping: { method: HrzProtocol.VectorClampMode.PER_VERTEX },
        lighting: { enableLighting: true },
        style: {
            attributes: [
                { vectorDataAttrId: RISK_PICK_ATTR.TAUX, stylingName: "taux" },
            ],
            // Extrusion (m) = |taux| × years = mul(taux, -years) since taux < 0.
            stylingScript: `${riskColorScript(t, a)}
                set "extrusion" = mul(attr("taux"), ${-years});
                emit 0;
            `,
            representations: [
                {
                    sceneViews: { bits: 3 },
                    extrudedGeometry: {
                        extrusion: { name: "extrusion", defaultValue: 0 },
                        upperColor: {
                            name: "color",
                            defaultValue: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
                        },
                        lowerColor: {
                            name: "color",
                            defaultValue: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
                        },
                        roofColor: {
                            name: "color",
                            defaultValue: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
                        },
                        lighting: { enableLighting: true },
                        clipToTile: true,
                    },
                },
            ],
        },
    };

    const dataLayerHandle = await api.LayerService.createLayer({
        name: "Impact depth 3D data",
        type: HrzProtocol.LayerType.VECTOR_DATA,
    });
    const tilesLayerHandle = await api.LayerService.createLayer({
        name: "Impact depth 3D",
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
