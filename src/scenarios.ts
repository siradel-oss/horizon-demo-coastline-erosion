import { Viewpoint } from "./viewpoints";
import { Alea } from "./components/alea-selector";
import type { Text } from "./i18n";

/**
 * Left-panel identifiers a tour step can open. Subset of App's `LeftPanel`
 * (kept a literal union here so scenarios.ts stays decoupled from the root
 * component; the values must match App's `leftPanels` keys).
 */
export type TourPanel =
    | "zonesRemarquables"
    | "coastline"
    | "risk"
    | "zonesBasses"
    | "seaLevel"
    | "populationExposee"
    | "enjeuxCategories"
    | "ouvrages";

/**
 * One declarative step of a guided tour. Purely data — the engine/UI wiring
 * (camera flight, panel toggle, overlay) lives in App / TourService, so the
 * descriptor stays framework-agnostic and reusable by the auto-play mode.
 */
export interface ScenarioStep {
    /** Stable id (for `track` and future deep-linking). */
    id: string;
    /** Overlay heading. */
    title: Text;
    /** Short overlay narration. Qualitative only: figures and their sources
     *  live in the opened panel, so no unsourced number appears on screen. */
    narration: Text;
    /** Camera target — reuses the `{ lon, lat }` contract of viewpoints.ts
     *  (consumed by `flyTo`). */
    viewpoint: Pick<Viewpoint, "lon" | "lat">;
    /** Panel/tool to open (reuses App's existing left-panel toggles). App opens
     *  the panel and closes the others; each tour window also shows its own
     *  layer when the step targets it (and hides it otherwise), so the map
     *  actually reflects the step — not just the open panel. */
    panel: TourPanel;
    /** Optional camera tilt in radians (0 = top-down, the default). A modest
     *  oblique angle reveals the 3D terrain relief where it is telling (shore,
     *  cliffs); flat data overlays read better top-down, so leave it unset. */
    tilt?: number;
    /** Optional camera half-extent in degrees (default 0.05 ≈ 5.5 km). Shrink
     *  to zoom onto a feature (a cliff), grow to frame a wide overlay (a
     *  heatmap). In bearing mode it drives the camera distance instead. */
    extent?: number;
    /** Optional camera bearing in radians (0 = looking north). When set, the
     *  camera faces this direction with an oblique `tilt` (angular viewpoint)
     *  rather than fitting the area top-down — for a dramatic oriented shot
     *  (e.g. a cliff seen face-on from the sea). */
    bearing?: number;
    /** Request the RGE ALTI® relief (high-res IGN DTM) for this step — needed
     *  to read fine terrain such as cliff faces. The basemap restores the
     *  user's manual relief state when the tour ends. */
    rgeTerrain?: boolean;
    /** Seconds to hold before auto-advancing in auto-play mode. Unused
     *  in manual stepping. Kept generous so each POV is comfortably readable. */
    duration: number;

    // --- Optional per-tool option the target window preselects when this step
    //     is active. Lets a scenario walk a menu's toggles (e.g. 2050 → 2100)
    //     across successive steps. Each field is honored only by the matching
    //     `panel`; the others ignore it.
    /** panel "risk": projection horizon. */
    horizon?: 2050 | 2100;
    /** panel "risk": impact-depth rendering — "none", "ground" (projected on
     *  the ground) or "compare3d" (3D). Lets the tour walk ground → 3D. Matches the
     *  risk window's DepthMode. */
    depthMode?: "none" | "ground" | "compare3d";
    /** panel "zonesBasses": sea-level threshold (keys of ZONES_BASSES_LEGEND). */
    level?: "phma" | "phma1m";
    /** panels "populationExposee" & "enjeuxCategories": hazard filter. The
     *  category window maps "tous"→0, "chronique"→1, "submersion"→2. */
    alea?: Alea;
    /** panel "coastline": which sub-layer to show — the two dated traits
     *  (default) or the event-driven retreat band. */
    coastlineLayer?: "traits" | "evenementiel";
}

/**
 * Default guided tour: an emblematic French coastal site per tool, following a
 * reading arc — observe the retreat, classify the risk, switch to the other
 * hazard (submersion), then read the impacts (who / what is exposed).
 * Coordinates reuse the iconic sites of viewpoints.ts.
 */
export const TOUR_SCENARIO: ScenarioStep[] = [
    {
        id: "trait-cote-observe",
        title: {
            en: "Observe coastline retreat",
            fr: "Observer le recul du trait de côte",
        },
        narration: {
            en: "In Soulac-sur-Mer, the « Le Signal » building had to be evacuated as the sea advanced. Compare the old and recent coastlines: the gap measures the retreat already observed.",
            fr: "À Soulac-sur-Mer, l'immeuble « Le Signal » a été évacué face à la mer. Comparez le trait de côte ancien et récent : l'écart mesure le recul déjà observé.",
        },
        viewpoint: { lon: -1.14, lat: 45.514 },
        panel: "coastline",
        coastlineLayer: "traits",
        tilt: 0.8, // oblique view — reveals the shore/dune relief in 3D
        extent: 0.028, // zoom in, centered on the town of Soulac
        duration: 15,
    },
    {
        id: "trait-cote-evenementiel",
        title: {
            en: "Cliffs retreat in sudden jumps",
            fr: "Le recul par à-coups des falaises",
        },
        narration: {
            en: "At the Ault cliffs, the coast does not retreat gradually but in sudden jumps: a single storm can carry away several metres of chalk at once. The band shows the reference maximum retreat along this stretch.",
            fr: "Aux falaises d'Ault, la côte ne recule pas au fil de l'eau mais par à-coups : une tempête peut emporter plusieurs mètres de craie d'un coup. La bande montre le recul maximal de référence sur ce linéaire.",
        },
        viewpoint: { lon: 1.448, lat: 50.103 },
        panel: "coastline",
        coastlineLayer: "evenementiel",
        tilt: 1.2, // strong inclination — near eye-level, dramatic cliff shot
        bearing: 3.5, // face roughly SW, looking at the cliff from over the sea
        extent: 0.02, // ~2 km back from the cliff
        rgeTerrain: true, // high-res relief so the cliff reads in 3D
        duration: 15,
    },
    {
        id: "zones-risque-2050",
        title: {
            en: "Project the risk to the 2050 horizon",
            fr: "Projeter le risque à l'horizon 2050",
        },
        narration: {
            en: "At the tip of Cap Ferret, the Cerema erosion indicator extends the observed retreat rate to map, on the ground, the areas potentially reached by the 2050 horizon.",
            fr: "À la pointe du Cap Ferret, l'indicateur d'érosion Cerema reconduit le rythme de recul observé pour délimiter, au sol, les zones potentiellement atteintes à l'horizon 2050.",
        },
        viewpoint: { lon: -1.2503, lat: 44.6295 },
        panel: "risk",
        horizon: 2050,
        depthMode: "ground",
        tilt: 0.35, // slight inclination — enough to read the ground band
        extent: 0.045,
        duration: 15,
    },
    {
        id: "zones-risque-2100",
        title: {
            en: "… then to the 2100 horizon",
            fr: "… puis à l'horizon 2100",
        },
        narration: {
            en: "Same method, further horizon: the risk band projected on the ground extends inland. Switching from 2050 to 2100 shows how the stakes worsen at the same place.",
            fr: "Même méthode, horizon plus lointain : la bande à risque projetée au sol s'étend vers l'intérieur des terres. Basculer de 2050 à 2100 rend visible l'aggravation de l'enjeu au même endroit.",
        },
        viewpoint: { lon: -1.2503, lat: 44.6295 },
        panel: "risk",
        horizon: 2100,
        depthMode: "ground",
        tilt: 0.35,
        extent: 0.045,
        duration: 15,
    },
    {
        id: "zones-risque-3d",
        title: {
            en: "Read the impact in 3D relief",
            fr: "Lire l'impact en relief 3D",
        },
        narration: {
            en: "The same 2100 projection, this time in 3D: the impact depth reads in the terrain relief, beyond the mere ground footprint.",
            fr: "La même projection 2100, cette fois en 3D : la profondeur d'impact se lit dans le relief du terrain, au-delà de la simple emprise au sol.",
        },
        viewpoint: { lon: -1.2503, lat: 44.6295 },
        panel: "risk",
        horizon: 2100,
        depthMode: "compare3d",
        tilt: 1.0, // strong tilt — near eye-level to read the 3D extrusion
        extent: 0.045,
        duration: 15,
    },
    {
        id: "submersion-phma",
        title: {
            en: "The other hazard: marine flooding",
            fr: "L'autre aléa : la submersion marine",
        },
        narration: {
            en: "On the Sète lido, a low-lying sand barrier, land below the highest astronomical tide (HAT) is the first exposed to overflow.",
            fr: "Sur le lido de Sète, cordon littoral bas, les terrains situés sous le niveau des plus hautes mers astronomiques (PHMA) sont les premiers exposés au débordement.",
        },
        viewpoint: { lon: 3.612, lat: 43.357 },
        panel: "zonesBasses",
        level: "phma",
        extent: 0.12, // same regional zoom as the population step
        duration: 15,
    },
    {
        id: "submersion-phma1m",
        title: {
            en: "Simulate sea-level rise",
            fr: "Simuler l'élévation du niveau marin",
        },
        narration: {
            en: "Adding +1 m to the sea level (a sea-level-rise proxy) enlarges the floodable footprint: this is the simulated effect of rising waters on the same barrier.",
            fr: "En ajoutant +1 m au niveau marin (proxy d'élévation), l'emprise submersible s'agrandit : c'est l'effet simulé de la montée des eaux sur ce même cordon.",
        },
        viewpoint: { lon: 3.612, lat: 43.357 },
        panel: "zonesBasses",
        level: "phma1m",
        extent: 0.12, // same regional zoom as the population step
        duration: 15,
    },
    {
        id: "population-exposee",
        title: { en: "Who is exposed?", fr: "Qui est exposé ?" },
        narration: {
            en: "The resident population (INSEE Filosofi) within the flooding footprint reveals the inhabitants concerned — here around Sète.",
            fr: "La population résidente (INSEE Filosofi) présente dans l'emprise de la submersion révèle les habitants concernés — ici autour de Sète.",
        },
        viewpoint: { lon: 3.612, lat: 43.357 },
        panel: "populationExposee",
        alea: "submersion",
        extent: 0.12, // zoom out — the heatmap reads at a regional scale
        duration: 15,
    },
    {
        id: "occupation-sol",
        title: { en: "What is exposed?", fr: "Quoi est exposé ?" },
        narration: {
            en: "In Capbreton, land use (CORINE Land Cover) crossed with the hazards qualifies the nature of the threatened footprint: urban, natural, agricultural…",
            fr: "À Capbreton, l'occupation du sol (CORINE Land Cover) croisée avec les aléas qualifie la nature de l'emprise menacée : urbanisé, naturel, agricole…",
        },
        viewpoint: { lon: -1.446, lat: 43.642 },
        panel: "enjeuxCategories",
        alea: "tous",
        duration: 15,
    },
];
