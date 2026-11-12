import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";

/**
 * Sea level (marine flooding): a horizontal Horizon clipping-plane layer
 * raised to a chosen altitude, shown as a translucent grid surface. Overlaid on whatever relief the user already has enabled, it reads as
 * a water level cutting through the terrain. It does NOT clip the terrain and
 * does NOT touch the terrain selection (clipping the terrain removes the imagery
 * and produces artefacts).
 *
 * Honest limits (indicative):
 *  - a FLAT plane only matches constant altitude NEAR its origin on the globe →
 *    it must be recentred on the viewed sector ;
 *  - the level reads against terrain only where relief (e.g. RGE ALTI) is on ;
 *  - purely visual: no flooded-area computation, no hydraulic connectivity.
 */

/** Global clipping-plane id (valid range 0–7). 7 is used by no other layer, so
 *  the plane never inadvertently clips a layer whose clipId defaults to 0. */
export const SEA_LEVEL_CLIP_ID = 7;
/** Normal sign of the horizontal plane (local up). */
const SEA_LEVEL_NORMAL_Z = -1;

export interface SeaLevelOrigin {
    latitude: number;
    longitude: number;
}

/** Horizontal clipping plane shown as a translucent grid at `altitude` m,
 *  anchored at the origin lat/lon. No terrain clipping. */
function planeState(
    origin: SeaLevelOrigin,
    altitude: number,
): HrzProtocol.IClippingPlaneLayer {
    return {
        clipId: SEA_LEVEL_CLIP_ID,
        originPosition: {
            latitude: origin.latitude,
            longitude: origin.longitude,
            altitude,
        },
        normal: { x: 0, y: 0, z: SEA_LEVEL_NORMAL_Z },
        // Translucent blue water surface (grid). showPlane only — no clipping.
        // Small extent: a FLAT plane diverges from the curved surface away from
        // its origin (~d²/2R: ~4 m at 7.5 km, ~70 m at 30 km), which would
        // project spurious low zones far from the centering point. Kept tight
        // around the origin and recentred on the viewed sector.
        showPlane: true,
        grid: {
            extent: 15000,
            cellSize: 250,
            color: { r: 0.2, g: 0.55, b: 0.95, a: 0.35 },
            sceneViews: { bits: 3 },
        },
    };
}

/** Creates the sea-level plane and returns its handle. */
export async function addSeaLevelPlane(
    api: HrzApi.AsyncApi,
    origin: SeaLevelOrigin,
    altitude: number,
): Promise<HrzProtocol.LayerHandle> {
    const handle = await api.LayerService.createLayer({
        name: "Sea level",
        type: HrzProtocol.LayerType.CLIPPING_PLANE,
    });
    HrzApi.ClippingPlaneLayerPathBuilder.create(handle).set(
        api,
        planeState(origin, altitude),
    );
    return handle;
}

/** Updates the plane origin / altitude (height slider, recenter). */
export function updateSeaLevelPlane(
    api: HrzApi.AsyncApi,
    handle: HrzProtocol.LayerHandle,
    origin: SeaLevelOrigin,
    altitude: number,
): void {
    HrzApi.ClippingPlaneLayerPathBuilder.create(handle).set(
        api,
        planeState(origin, altitude),
    );
}
