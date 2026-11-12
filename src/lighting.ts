import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";

/**
 * "Clarity" ambient lighting — flat, even illumination with a static sky.
 * Used as the application's single, default lighting mode (no user control).
 */
const CLARITY_AMBIENT: HrzProtocol.IAmbientSettings = {
    lightingStrength: 1.0,
    sunAmbientBalance: 0.5,
    wrapLighting: 1.0,
    lighting: {
        enableLighting: true,
        castShadows: false,
        receiveShadows: false,
    },
    sky: {
        mode: HrzProtocol.SkyMode.SKY_STATIC,
        staticAtmosphereColor: { r: 0.65, g: 0.82, b: 0.97, a: 1 },
        staticSpaceColor: { r: 0, g: 0.1, b: 0.2, a: 1 },
        staticColorTransitionStartDistance: 0,
        staticColorTransitionEndDistance: 150,
        staticColorTransitionDistanceUnit:
            HrzProtocol.StaticSkyColorTransitionUnit
                .STATIC_SKY_COLOR_TRANSITION_UNIT_PIXELS,
    },
    sun: {
        mode: HrzProtocol.SunLightingMode.SUN_LIGHTING_STATIC,
        staticColor: { r: 0.9, g: 0.9, b: 0.9, a: 1 },
        angularDirection: {
            cameraFrame: HrzProtocol.AngularDirection.Frame.FRAME_ENU,
            // Clockwise since Horizon 26 (was 2.36 counter-clockwise).
            azimuth: 2 * Math.PI - 2.36,
            altitude: 0.7,
        },
    },
    ambientLighting: {
        mode: HrzProtocol.AmbientLightingMode.AMBIENT_LIGHTING_STATIC,
        staticColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
    },
};

/** Neutral terrain tint (used where no imagery is draped). */
const TERRAIN_COLOR = { r: 0.9, g: 0.9, b: 0.9, a: 1 };

/** Apply the default "clarity" lighting to a scene view (defaults to view 0). */
export async function applyClarityLighting(
    api: HrzApi.AsyncApi,
    view: HrzProtocol.SceneViewIndex = HrzProtocol.SceneViewIndex.SCENE_VIEW_0,
): Promise<void> {
    await HrzApi.SceneViewSettingsPathBuilder.create(view)
        .ambient()
        .set(api, CLARITY_AMBIENT);
}

/**
 * Apply the terrain look (neutral color) to a scene view.
 * Kept alongside the lighting so a second view (comparison mode) can be made to
 * match view 0 exactly. Requires the viewer to be ready.
 */
export async function applyTerrainLook(
    api: HrzApi.AsyncApi,
    view: HrzProtocol.SceneViewIndex = HrzProtocol.SceneViewIndex.SCENE_VIEW_0,
): Promise<void> {
    await HrzApi.SceneViewSettingsPathBuilder.create(view)
        .terrain()
        .terrainColor()
        .set(api, TERRAIN_COLOR);
}
