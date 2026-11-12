import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import type { Text } from "./i18n";

export interface Viewpoint {
    name: Text;
    detail: Text;
    /** Representative max retreat rate within ~10 km (m/yr), measured offline
     *  from the Cerema indicator (`trait_cote_evolution`) — the metric to
     *  rank/compare sites (mirrors the exposed population of flooding sectors). */
    taux: number;
    lon: number;
    lat: number;
}

/**
 * Iconic coastal erosion sites (manual seed). `taux` = max local retreat rate
 * within ~10 km, computed from the Cerema indicator.
 */
export const VIEWPOINTS: Viewpoint[] = [
    {
        name: {
            en: "Soulac-sur-Mer — « Le Signal »",
            fr: "Soulac-sur-Mer — « Le Signal »",
        },
        detail: {
            en: "Building evacuated as the coast retreated (Gironde)",
            fr: "Immeuble évacué face au recul (Gironde)",
        },
        taux: 5.26,
        lon: -1.1656,
        lat: 45.5165,
    },
    {
        name: { en: "Lacanau-Océan", fr: "Lacanau-Océan" },
        detail: {
            en: "Seaside resort, fast retreat of a sandy beach (Gironde)",
            fr: "Station balnéaire, recul rapide de plage sableuse (Gironde)",
        },
        taux: 1.46,
        lon: -1.2017,
        lat: 45.001,
    },
    {
        name: { en: "Capbreton", fr: "Capbreton" },
        detail: {
            en: "Sandy Landes coast under strong erosion",
            fr: "Littoral sableux des Landes sous forte érosion",
        },
        taux: 1.85,
        lon: -1.446,
        lat: 43.642,
    },
    {
        name: {
            en: "Lido from Sète to Marseillan",
            fr: "Lido de Sète à Marseillan",
        },
        detail: {
            en: "Sand barrier moved back then redeveloped (Hérault)",
            fr: "Cordon littoral reculé puis réaménagé (Hérault)",
        },
        taux: 0.99,
        lon: 3.612,
        lat: 43.357,
    },
    {
        name: { en: "Ault cliffs", fr: "Falaises d'Ault" },
        detail: {
            en: "Chalk cliff retreat (Hauts-de-France)",
            fr: "Recul de falaise crayeuse (Hauts-de-France)",
        },
        taux: 0.96,
        lon: 1.448,
        lat: 50.103,
    },
    {
        name: { en: "Wissant", fr: "Wissant" },
        detail: {
            en: "Bay under marked erosion (Pas-de-Calais)",
            fr: "Baie en érosion marquée (Pas-de-Calais)",
        },
        taux: 2.98,
        lon: 1.661,
        lat: 50.886,
    },
];

/**
 * Camera flight to a coastal point. `tilt` (radians, 0 = top-down) gives an
 * oblique view that reveals the 3D terrain relief — useful for cliff/relief
 * steps. `extent` is the half-extent in degrees (default 0.05 ≈ 5.5 km);
 * shrink it to zoom onto a feature (a cliff) or grow it to frame a wider area
 * (a heatmap).
 *
 * When `bearing` (radians) is given, the camera uses an *angular* viewpoint
 * instead of a top-down bounds fit: it targets the point on the ground and
 * looks toward that bearing with the given `tilt`, pulled back by a distance
 * derived from `extent`. Use it for a dramatic, oriented shot — e.g. a cliff
 * seen face-on from the sea.
 */
export function flyTo(
    api: HrzApi.AsyncApi,
    lon: number,
    lat: number,
    tilt = 0,
    extent = 0.05,
    bearing?: number,
): void {
    if (bearing !== undefined) {
        api.CameraService.setOrbit({
            cameraIndex: HrzProtocol.CameraIndex.CAMERA_0,
            angularViewpoint: {
                target: { longitude: lon, latitude: lat, altitude: 0 },
                bearing,
                tilt,
                distance: extent * 111000, // deg half-extent → ~metres
            },
            altitudeMode: HrzProtocol.AltitudeMode.RELATIVE_TO_TERRAIN,
            goToAnimation: {
                duration: 2.5,
                easingExponent: 2,
                easingFunction: HrzProtocol.EasingFunctions.EASE_INOUT,
                trajectoryType: HrzProtocol.TrajectoryType.BALLISTIC,
            },
            maxAltitude: 10000000,
            minTilt: 0,
            maxTilt: Math.PI,
        });
        return;
    }

    const d = extent; // half-extent in degrees
    api.CameraService.setOrbit({
        cameraIndex: HrzProtocol.CameraIndex.CAMERA_0,
        bounds: {
            bounds: {
                west: lon - d,
                east: lon + d,
                south: lat - d,
                north: lat + d,
                minHeight: 0,
                maxHeight: 0,
            },
            tilt,
        },
        altitudeMode: HrzProtocol.AltitudeMode.RELATIVE_TO_TERRAIN,
        goToAnimation: {
            duration: 2.5,
            easingExponent: 2,
            easingFunction: HrzProtocol.EasingFunctions.EASE_INOUT,
            trajectoryType: HrzProtocol.TrajectoryType.BALLISTIC,
        },
        maxAltitude: 10000000,
        minTilt: 0,
        maxTilt: Math.PI,
    });
}
