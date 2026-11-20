import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    effect,
    ElementRef,
    inject,
    signal,
    untracked,
    viewChild,
    WritableSignal,
} from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzCoreBackend } from "@siradel-oss/horizon-core";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { HorizonService } from "./horizon.service";
import { PickService } from "./pick.service";
import { PanelActivityService } from "./panel-activity.service";
import { applyClarityLighting, applyTerrainLook } from "./lighting";
import { IconButton } from "./components/icon-button";
import { MenuSection, MenuButton } from "./components/menu-section";
import { LoadingIndicator } from "./components/loading-indicator";
import { TraitCoteWindow } from "./layout/trait-cote-window";
import { ZonesRemarquablesWindow } from "./layout/zones-remarquables-window";
import { RiskZonesWindow } from "./layout/risk-zones-window";
import { ZonesBassesWindow } from "./layout/zones-basses-window";
import { SeaLevelWindow } from "./layout/sea-level-window";
import { PopulationExposeeWindow } from "./layout/population-exposee-window";
import { EnjeuxCategoriesWindow } from "./layout/enjeux-categories-window";
import { OuvragesLittorauxWindow } from "./layout/ouvrages-littoraux-window";
import { SearchWindow } from "./layout/search-window";
import { AttributionsWindow } from "./layout/attributions-window";
import { CompassOverlay } from "./layout/compass-overlay";
import { BasemapControls } from "./layout/basemap-controls";
import { MapAttribution } from "./layout/map-attribution";
import { ThemePicker } from "./components/theme-picker";
import { LangPicker } from "./components/lang-picker";
import { SiradelLogo } from "./components/siradel-logo";
import { ScePin } from "./components/sce-pin";
import { I18n } from "./i18n";
import { LINKS } from "./links";
import { WelcomeWindow } from "./layout/welcome-window";
import { TourOverlay } from "./layout/tour-overlay";
import { CompareSlider } from "./layout/compare-slider";
import { TourService } from "./tour.service";
import { ScenarioStep } from "./scenarios";
import { flyTo } from "./viewpoints";
import { baseUrl } from "./layers/_shared";
import { fixPointerScale } from "./device";

const VIEWER_OPTIONS: HrzProtocol.IViewerOptions = {
    showLoadingScreen: true,
    keyBindings: {
        bindings: [
            {
                action: HrzProtocol.KeyAction.TOGGLE_DEV_UI,
                key: HrzProtocol.Key.K_P,
            },
            {
                action: HrzProtocol.KeyAction.RESET_NORTH,
                key: HrzProtocol.Key.K_R,
            },
            // CTRL activates tilt mode: hold CTRL + left drag to tilt the camera
            {
                action: HrzProtocol.KeyAction.MOD_KEY,
                key: HrzProtocol.Key.K_CTRL,
            },
        ],
    },
    graphicsSettingsOverrides: { atmosphereEnabled: true },
};

async function goToDefaultViewpoint(api: HrzApi.AsyncApi, duration: number) {
    api.CameraService.setOrbit({
        cameraIndex: HrzProtocol.CameraIndex.CAMERA_0,
        bounds: {
            bounds: {
                west: -5.668945,
                south: 41.804078,
                east: 10.371094,
                north: 52.025459,
                minHeight: 0,
                maxHeight: 0,
            },
            tilt: 0,
        },
        goToAnimation: {
            duration,
            easingExponent: 2,
            easingFunction: HrzProtocol.EasingFunctions.EASE_INOUT,
            trajectoryType: HrzProtocol.TrajectoryType.BALLISTIC,
        },
        maxAltitude: 100000000,
        minTilt: 0,
        maxTilt: Math.PI,
    });
}

type LeftPanel =
    | "zonesRemarquables"
    | "coastline"
    | "risk"
    | "zonesBasses"
    | "seaLevel"
    | "populationExposee"
    | "enjeuxCategories"
    | "ouvrages"
    | "search";

@Component({
    selector: "app-root",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        IconButton,
        MenuSection,
        MenuButton,
        LoadingIndicator,
        TraitCoteWindow,
        ZonesRemarquablesWindow,
        RiskZonesWindow,
        ZonesBassesWindow,
        SeaLevelWindow,
        PopulationExposeeWindow,
        EnjeuxCategoriesWindow,
        OuvragesLittorauxWindow,
        SearchWindow,
        AttributionsWindow,
        CompassOverlay,
        BasemapControls,
        CompareSlider,
        MapAttribution,
        ThemePicker,
        LangPicker,
        SiradelLogo,
        ScePin,
        WelcomeWindow,
        TourOverlay,
    ],
    template: `
        <div
            class="w-screen h-dvh relative bg-surface-page overflow-clip select-none"
            [class.touring]="tour.active()"
            (keydown)="onKeyDown($event)"
        >
            <div class="absolute inset-0">
                <canvas
                    #hrzCanvas
                    id="hrz-canvas"
                    class="w-full h-full focus:outline-none"
                    style="touch-action: none;"
                    (contextmenu)="$event.preventDefault()"
                    (click)="onCanvasClick($event)"
                    (pointerdown)="dismissPick()"
                    (wheel)="dismissPick()"
                ></canvas>
            </div>

            <!-- Header: SCE pin (links to the SCE ecosystem) and app name. -->
            <div
                class="absolute top-4 left-4 z-50 h-12 flex flex-row items-center gap-2.5 rounded-xl ui-surface ps-3 pe-4 select-none shadow-lg"
            >
                <a
                    [href]="links.sce"
                    target="_blank"
                    rel="noopener"
                    class="flex text-text-headings hover:text-brand-accent transition-colors"
                    [title]="t({ en: 'SCE ecosystem', fr: 'Écosystème SCE' })"
                >
                    <app-sce-pin class="h-7" />
                </a>
                <div
                    class="app-title font-bold text-lg leading-none tracking-tight text-brand-strong"
                >
                    Shoreline<span class="text-brand-accent">Explorer</span>
                </div>
            </div>

            <!-- Top right: utilities (horizontal) -->
            <div
                class="absolute top-4 right-4 z-50 h-12 flex flex-row items-center gap-1 rounded-xl ui-surface px-2 pointer-events-auto"
            >
                <app-icon-button
                    icon="help"
                    [tooltip]="
                        t({
                            en: 'About this demo',
                            fr: 'À propos de cette démo',
                        })
                    "
                    [active]="welcomeOpen()"
                    (click)="reopenWelcome()"
                />
                <app-icon-button
                    [icon]="isFullscreen() ? 'fullscreen_exit' : 'fullscreen'"
                    [tooltip]="t({ en: 'Full screen', fr: 'Plein écran' })"
                    [active]="isFullscreen()"
                    (click)="toggleFullscreen()"
                />
                <app-lang-picker />
                <app-theme-picker />
                <app-icon-button
                    icon="license"
                    [tooltip]="t({ en: 'Attributions', fr: 'Attributions' })"
                    [active]="attributionsOpen()"
                    (click)="attributionsOpen.set(!attributionsOpen())"
                />
            </div>

            <!-- Left, below the header: separate vertical thematic blocks. -->
            <div
                class="rail-area absolute top-24 bottom-4 left-4 gap-4 flex flex-row items-start pointer-events-none"
            >
                <!-- Fixed-width rail: expanded sections overlay to the right
                     (z-50) instead of reflowing the open windows. -->
                <div
                    class="rail flex flex-col gap-4 w-14 shrink-0 pointer-events-auto"
                >
                    <!-- Exploration (navigation: search + notable sites per hazard) -->
                    <app-menu-section
                        [title]="t({ en: 'Exploration', fr: 'Exploration' })"
                        class="z-50"
                    >
                        <app-menu-button
                            icon="search"
                            [label]="
                                t({
                                    en: 'Address search',
                                    fr: 'Recherche d\\'adresse',
                                })
                            "
                            [active]="searchOpen()"
                            (click)="toggleLeft('search')"
                        />
                        <app-menu-button
                            icon="location_on"
                            [label]="
                                t({
                                    en: 'Notable sites',
                                    fr: 'Zones remarquables',
                                })
                            "
                            [active]="zonesRemarquablesOpen()"
                            (click)="toggleLeft('zonesRemarquables')"
                        />
                    </app-menu-section>

                    <!-- Phenomena: one block per hazard (hazard-specific tools) -->
                    <app-menu-section
                        [title]="
                            t({
                                en: 'Coastline retreat',
                                fr: 'Recul du trait de côte',
                            })
                        "
                        class="z-50"
                    >
                        <app-menu-button
                            icon="waves"
                            [label]="
                                t({ en: 'Coastline', fr: 'Trait de côte' })
                            "
                            [active]="coastlineOpen()"
                            [badge]="panelActivity.isActive('coastline')"
                            (click)="toggleLeft('coastline')"
                        />
                        <app-menu-button
                            icon="alert"
                            [label]="
                                t({ en: 'Risk zones', fr: 'Zones à risque' })
                            "
                            [active]="riskOpen()"
                            [badge]="panelActivity.isActive('risk')"
                            (click)="toggleLeft('risk')"
                        />
                        <app-menu-button
                            icon="buildings"
                            [label]="
                                t({
                                    en: 'Coastal structures',
                                    fr: 'Ouvrages littoraux',
                                })
                            "
                            [active]="ouvragesOpen()"
                            [badge]="panelActivity.isActive('ouvrages')"
                            (click)="toggleLeft('ouvrages')"
                        />
                    </app-menu-section>
                    <app-menu-section
                        [title]="
                            t({
                                en: 'Marine flooding',
                                fr: 'Submersion marine',
                            })
                        "
                        class="z-50"
                    >
                        <app-menu-button
                            icon="droplet"
                            [label]="
                                t({ en: 'Low-lying areas', fr: 'Zones basses' })
                            "
                            [active]="zonesBassesOpen()"
                            [badge]="panelActivity.isActive('zonesBasses')"
                            (click)="toggleLeft('zonesBasses')"
                        />
                        <app-menu-button
                            icon="mountain"
                            [label]="t({ en: 'Sea level', fr: 'Niveau marin' })"
                            [active]="seaLevelOpen()"
                            [badge]="panelActivity.isActive('seaLevel')"
                            (click)="toggleLeft('seaLevel')"
                        />
                    </app-menu-section>

                    <!-- Impacts: symmetric tools, each filterable by hazard -->
                    <app-menu-section
                        [title]="t({ en: 'Impacts', fr: 'Impacts' })"
                        class="z-50"
                    >
                        <app-menu-button
                            icon="users"
                            [label]="
                                t({
                                    en: 'Exposed population',
                                    fr: 'Population exposée',
                                })
                            "
                            [active]="populationExposeeOpen()"
                            [badge]="
                                panelActivity.isActive('populationExposee')
                            "
                            (click)="toggleLeft('populationExposee')"
                        />
                        <app-menu-button
                            icon="category"
                            [label]="
                                t({ en: 'Land use', fr: 'Occupation du sol' })
                            "
                            [active]="enjeuxCategoriesOpen()"
                            [badge]="panelActivity.isActive('enjeuxCategories')"
                            (click)="toggleLeft('enjeuxCategories')"
                        />
                    </app-menu-section>
                </div>
                <div class="relative">
                    <app-trait-cote-window
                        [open]="coastlineOpen()"
                        (openChange)="coastlineOpen.set($event)"
                        class="pointer-events-auto"
                    />
                    <app-zones-remarquables-window
                        [open]="zonesRemarquablesOpen()"
                        (openChange)="zonesRemarquablesOpen.set($event)"
                        class="pointer-events-auto"
                    />
                    <app-risk-zones-window
                        [open]="riskOpen()"
                        (openChange)="riskOpen.set($event)"
                        class="pointer-events-auto"
                    />
                    <app-zones-basses-window
                        [open]="zonesBassesOpen()"
                        (openChange)="zonesBassesOpen.set($event)"
                        class="pointer-events-auto"
                    />
                    <app-sea-level-window
                        [open]="seaLevelOpen()"
                        (openChange)="seaLevelOpen.set($event)"
                        class="pointer-events-auto"
                    />
                    <app-population-exposee-window
                        [open]="populationExposeeOpen()"
                        (openChange)="populationExposeeOpen.set($event)"
                        class="pointer-events-auto"
                    />
                    <app-enjeux-categories-window
                        [open]="enjeuxCategoriesOpen()"
                        (openChange)="enjeuxCategoriesOpen.set($event)"
                        class="pointer-events-auto"
                    />
                    <app-ouvrages-littoraux-window
                        [open]="ouvragesOpen()"
                        (openChange)="ouvragesOpen.set($event)"
                        class="pointer-events-auto"
                    />
                    <app-search-window
                        [open]="searchOpen()"
                        (openChange)="searchOpen.set($event)"
                        class="pointer-events-auto"
                    />
                </div>
            </div>

            <div
                class="map-controls absolute bottom-4 right-4 flex flex-col items-end gap-3 pointer-events-none"
            >
                <app-basemap-controls />
                <app-compass-overlay />
                <app-compare-slider />
            </div>

            <!-- Bottom-left: Siradel credit + permanent map credit (opens the panel). -->
            <div
                class="credits absolute bottom-1.5 left-4 z-40 flex flex-row items-center gap-2 pointer-events-none"
            >
                <a
                    [href]="links.siradel"
                    target="_blank"
                    rel="noopener"
                    class="pointer-events-auto text-text-lightest hover:text-text-headings transition-colors"
                    title="Siradel"
                >
                    <app-siradel-logo class="h-3" />
                </a>
                <app-map-attribution (open)="attributionsOpen.set(true)" />
            </div>

            <app-attributions-window
                [open]="attributionsOpen()"
                (openChange)="attributionsOpen.set($event)"
            />

            <!-- Guided-tour narration overlay (driven by TourService). -->
            <app-tour-overlay />

            <!-- First-launch welcome popin (approach and inspiration). -->
            <app-welcome-window
                [open]="welcomeOpen()"
                (explore)="onExploreFreely()"
                (startTour)="onStartTour()"
            />

            @if (successiveIsNotWorking() < 5) {
                <app-loading-indicator
                    class="loading absolute bottom-4 left-1/2 -translate-x-1/2 transition-opacity"
                />
            }
        </div>
    `,
})
export class App {
    private readonly canvas =
        viewChild.required<ElementRef<HTMLCanvasElement>>("hrzCanvas");
    private readonly horizonService = inject(HorizonService);
    private readonly pickService = inject(PickService);
    /** Rail badge state: which panels currently show ≥1 layer. */
    protected readonly panelActivity = inject(PanelActivityService);
    protected readonly tour = inject(TourService);
    private api: HrzApi.AsyncApi | null = null;

    /** First-launch welcome popin visibility (persisted seen-state below). */
    private static readonly WELCOME_SEEN_KEY =
        "horizon-demo-coastline-erosion:welcome-seen";
    readonly welcomeOpen = signal(!localStorage.getItem(App.WELCOME_SEEN_KEY));

    protected readonly t = inject(I18n).t;
    protected readonly links = LINKS;

    readonly attributionsOpen = signal(false);
    readonly zonesRemarquablesOpen = signal(false);
    readonly coastlineOpen = signal(false);
    readonly riskOpen = signal(false);
    readonly zonesBassesOpen = signal(false);
    readonly seaLevelOpen = signal(false);
    readonly populationExposeeOpen = signal(false);
    readonly enjeuxCategoriesOpen = signal(false);
    readonly ouvragesOpen = signal(false);
    readonly searchOpen = signal(false);
    readonly isFullscreen = signal(false);
    readonly successiveIsNotWorking = signal(0);

    private readonly leftPanels: Record<LeftPanel, WritableSignal<boolean>> = {
        zonesRemarquables: this.zonesRemarquablesOpen,
        coastline: this.coastlineOpen,
        risk: this.riskOpen,
        zonesBasses: this.zonesBassesOpen,
        seaLevel: this.seaLevelOpen,
        populationExposee: this.populationExposeeOpen,
        enjeuxCategories: this.enjeuxCategoriesOpen,
        ouvrages: this.ouvragesOpen,
        search: this.searchOpen,
    };

    constructor() {
        this.horizonService.onApiReady((api) => this.onHorizonReady(api));

        // Drive the map from the tour state: fly to the step's viewpoint and
        // open its panel (reusing the existing left-panel toggles). When the
        // tour stops, close the tour-opened windows.
        effect(() => {
            const step = this.tour.current();
            untracked(() => this.applyTourStep(step));
        });

        document.addEventListener("fullscreenchange", () =>
            this.isFullscreen.set(!!document.fullscreenElement),
        );

        afterNextRender(() => {
            HrzCoreBackend.init(
                this.canvas().nativeElement,
                // Root where hrz_core.{js,wasm} are served, as an absolute URL
                // under the deploy base.
                baseUrl(),
                VIEWER_OPTIONS,
                (backend, initStatus) => {
                    if (
                        initStatus ===
                            HrzProtocol.ViewerInitStatus.INIT_SUCCESS &&
                        backend
                    ) {
                        fixPointerScale(this.canvas().nativeElement);
                        this.horizonService.setApi(
                            new HrzApi.AsyncApi(backend),
                        );
                    }
                },
            );
        });
    }

    private async onHorizonReady(api: HrzApi.AsyncApi) {
        this.api = api;
        await goToDefaultViewpoint(api, 0);
        await applyClarityLighting(api);

        setInterval(async () => {
            const working = await api.ViewerService.isWorking();
            this.successiveIsNotWorking.update((n) =>
                working.value ? 0 : n + 1,
            );
        }, 100);

        this.horizonService.onMessage(
            "viewerReady",
            () => void applyTerrainLook(api),
        );
    }

    onCanvasClick(event: MouseEvent) {
        void this.pickService.pickFromClick(event, this.canvas().nativeElement);
    }

    /** Hides the pick popup as soon as the camera starts moving/zooming. */
    dismissPick() {
        this.pickService.clear();
    }

    /** Applies a tour step (or clears the tour when null). */
    private applyTourStep(step: ScenarioStep | null) {
        this.closeLeftWindows();
        if (!step) return;
        this.leftPanels[step.panel].set(true);
        if (this.api) {
            flyTo(
                this.api,
                step.viewpoint.lon,
                step.viewpoint.lat,
                step.tilt ?? 0,
                step.extent ?? 0.05,
                step.bearing,
            );
        }
    }

    /** Marks the welcome popin as seen so it no longer opens on launch. */
    private markWelcomeSeen() {
        localStorage.setItem(App.WELCOME_SEEN_KEY, "1");
    }

    onExploreFreely() {
        this.markWelcomeSeen();
        this.welcomeOpen.set(false);
    }

    onStartTour() {
        this.markWelcomeSeen();
        this.welcomeOpen.set(false);
        this.tour.start();
    }

    /** Re-open the welcome popin from the chrome `?` button (keeps seen-state). */
    reopenWelcome() {
        this.welcomeOpen.set(true);
    }

    toggleLeft(panel: LeftPanel) {
        const willOpen = !this.leftPanels[panel]();
        this.closeLeftWindows();
        this.leftPanels[panel].set(willOpen);
    }

    closeLeftWindows() {
        for (const sig of Object.values(this.leftPanels)) sig.set(false);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }

    onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            if (this.welcomeOpen()) {
                this.onExploreFreely();
            } else if (this.tour.active()) {
                this.tour.stop();
            } else if (this.attributionsOpen()) {
                this.attributionsOpen.set(false);
            } else {
                this.closeLeftWindows();
            }
        }
    }
}
