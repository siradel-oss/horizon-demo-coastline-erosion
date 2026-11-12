import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    effect,
    inject,
    model,
    signal,
    untracked,
} from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { IconButton } from "../components/icon-button";
import { TextButton } from "../components/button";
import { Window } from "../components/window";
import { Icon } from "../components/icon";
import { OpacitySlider } from "../components/opacity-slider";
import { AleaSelector, Alea } from "../components/alea-selector";
import { Attribution } from "../components/attribution";
import { HorizonService } from "../horizon.service";
import { PanelActivityService } from "../panel-activity.service";
import { TourService } from "../tour.service";
import { I18n } from "../i18n";
import {
    addPopulationExposeeLayer,
    ENJEUX_HEATMAP_LEGEND,
    ENJEUX_HORIZONS,
    ENJEUX_DEFAULT_OPACITY,
    ENJEUX_OPACITY_RANGE,
    SUBMERSION_ENJEUX_LEVELS,
} from "../layers";

// One layer per hazard (Horizon can't sum sources in one layer); "All" overlays
// both, each at its own palette scale. Distinct ids so both coexist.
const POPULATION_RECUL_LAYER_ID = 22;
const POPULATION_SUBM_LAYER_ID = 30;

/** CSS gradient mirroring the (shared magma) heatmap palette for the legend. */
const GRADIENT_CSS = `linear-gradient(to right, ${ENJEUX_HEATMAP_LEGEND.map(
    (s) => `${s.hex} ${Math.round(s.t * 100)}%`,
).join(", ")})`;

type Handles = {
    data: HrzProtocol.LayerHandle;
    tiles: HrzProtocol.LayerHandle;
};

/**
 * Impact tool — exposed population as a heatmap, with a hazard selector
 * (chronic retreat / marine flooding / all). Only the worst-case scenario is
 * shown (retreat 2100, flooding HAT + 1 m), consistent with the land-use panel —
 * no per-tool scenario selector. Both hazards render the same magma heatmap, so a
 * single legend/opacity is shared.
 */
@Component({
    selector: "app-population-exposee-window",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        Window,
        IconButton,
        TextButton,
        Icon,
        OpacitySlider,
        AleaSelector,
        Attribution,
    ],
    template: `
        @if (open()) {
            <app-window
                side="left"
                class="absolute top-0 left-0 w-80 max-h-[calc(100vh-6rem)] p-lg"
            >
                <div class="flex flex-row items-center mb-lg">
                    <h1 class="grow text-xl font-semibold">
                        {{
                            t({
                                en: "Exposed population",
                                fr: "Population exposée",
                            })
                        }}
                    </h1>
                    <app-icon-button
                        icon="close"
                        iconSize="md"
                        [tooltip]="t({ en: 'Close', fr: 'Fermer' })"
                        (click)="open.set(false)"
                    />
                </div>

                <p class="mt-2 text-body-md text-text-body/90">
                    @if (lang() === "fr") {
                        Carte de chaleur de la <b>population exposée</b> aux
                        aléas côtiers — <b>recul</b> du trait de côte et
                        <b>submersion</b> marine (carreaux INSEE 200 m).
                        Choisissez l'aléa ; « Tous » superpose les deux. Les
                        cartes montrent le
                        <b>scénario le plus défavorable</b> (recul à 2100,
                        submersion PHMA + 1 m). Estimation, pas une prévision.
                    } @else {
                        Heatmap of the <b>population exposed</b> to coastal
                        hazards — coastline <b>retreat</b> and marine
                        <b>flooding</b> (INSEE 200 m grid cells). Pick the
                        hazard; “All” overlays both. The maps show the
                        <b>worst-case scenario</b> (retreat by 2100, flooding at
                        HAT + 1 m). An estimate, not a forecast.
                    }
                </p>

                <div class="mt-3">
                    <div class="text-body-2xs text-text-lightest mb-1">
                        {{ t({ en: "Hazard", fr: "Aléa" }) }}
                    </div>
                    <app-alea-selector [(value)]="alea" [tous]="true" />
                </div>

                <button
                    app-text-button
                    class="w-full text-left flex flex-row items-center gap-4 mt-3"
                    [active]="visible()"
                    (click)="visible.set(!visible())"
                >
                    <app-icon
                        [icon]="visible() ? 'visibility' : 'visibility_off'"
                    />
                    {{
                        t({
                            en: "Show exposed population",
                            fr: "Afficher la population exposée",
                        })
                    }}
                </button>

                @if (visible()) {
                    <div class="mt-4">
                        <div class="text-body-2xs text-text-lightest mb-1">
                            {{
                                t({
                                    en: "Exposed population density",
                                    fr: "Densité de population exposée",
                                })
                            }}
                        </div>
                        <div
                            class="h-3 rounded-sm"
                            [style.background]="gradient"
                        ></div>
                        <div
                            class="flex flex-row justify-between text-body-2xs text-text-lightest mt-1"
                        >
                            <span>{{ t({ en: "low", fr: "faible" }) }}</span>
                            <span>{{ t({ en: "high", fr: "élevée" }) }}</span>
                        </div>
                    </div>

                    <div class="mt-4">
                        <app-opacity-slider
                            [(value)]="opacity"
                            [min]="range.min"
                            [max]="range.max"
                            [step]="range.step"
                        />
                    </div>
                }

                <app-attribution
                    [sources]="[
                        t({
                            en: 'Cerema — coastal erosion indicator',
                            fr: 'Cerema — indicateur d’érosion côtière',
                        }),
                        t({
                            en: 'Cerema / GéoLittoral — low-lying areas',
                            fr: 'Cerema / GéoLittoral — zones basses',
                        }),
                        t({
                            en: 'INSEE Filosofi 2019 (200 m gridded population)',
                            fr: 'INSEE Filosofi 2019 (population carroyée 200 m)',
                        }),
                    ]"
                    [note]="
                        t({
                            en: 'estimate, worst-case scenario, Siradel processing',
                            fr: 'estimation, scénario le plus défavorable, traitement Siradel',
                        })
                    "
                />
            </app-window>
        }
    `,
})
export class PopulationExposeeWindow {
    protected readonly t = inject(I18n).t;
    protected readonly lang = inject(I18n).lang;
    readonly open = model(false);
    readonly visible = signal(false);
    readonly alea = signal<Alea>("tous"); // default to the all-hazards overview
    readonly opacity = signal(ENJEUX_DEFAULT_OPACITY);
    readonly gradient = GRADIENT_CSS;
    // Worst-case scenario only, consistent with the land-use panel: retreat 2100,
    // flooding HAT + 1 m.
    private readonly horizon = ENJEUX_HORIZONS[ENJEUX_HORIZONS.length - 1];
    private readonly level =
        SUBMERSION_ENJEUX_LEVELS[SUBMERSION_ENJEUX_LEVELS.length - 1];
    readonly range = ENJEUX_OPACITY_RANGE;

    private readonly horizonService = inject(HorizonService);
    private readonly panelActivity = inject(PanelActivityService);
    private readonly tour = inject(TourService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly api = signal<HrzApi.AsyncApi | null>(null);

    // One or two layers (two in "All": retreat + flooding overlaid).
    private current: Handles[] = [];
    private seq = 0;

    constructor() {
        this.horizonService.onApiReady((a) => this.api.set(a));

        effect(() => {
            const a = this.api();
            const show = this.visible();
            const alea = this.alea();
            const op = this.opacity();
            if (!a) return;
            void this.reconcile(a, show, alea, op);
        });

        // Report layer activity to the rail (badge).
        effect(() =>
            this.panelActivity.setActive("populationExposee", this.visible()),
        );

        // Guided tour: show this tool's layer while a step targets it (and
        // preselect the step's hazard filter), hide it otherwise — including
        // when the tour ends (current() === null), so finishing the tour turns
        // the tool off. Outside a tour the effect never re-runs.
        effect(() => {
            const step = this.tour.current();
            const mine = step?.panel === "populationExposee";
            untracked(() => {
                this.visible.set(mine);
                if (mine && step?.alea) this.alea.set(step.alea);
            });
        });

        this.destroyRef.onDestroy(() => {
            const a = this.api();
            if (a) this.destroyCurrent(a);
        });
    }

    /** Create-before-destroy; ignores stale requests (fast hazard/sub switching). */
    private async reconcile(
        api: HrzApi.AsyncApi,
        show: boolean,
        alea: Alea,
        opacity: number,
    ) {
        const my = ++this.seq;
        if (!show) {
            if (my === this.seq) this.destroyCurrent(api);
            return;
        }
        // One layer per active hazard ("All" = both, overlaid, own scales).
        const fresh: Handles[] = [];
        if (alea === "chronique" || alea === "tous") {
            fresh.push(
                await addPopulationExposeeLayer(
                    api,
                    POPULATION_RECUL_LAYER_ID,
                    {
                        hazard: "recul",
                        horizon: this.horizon,
                        level: this.level,
                        opacity,
                    },
                ),
            );
        }
        if (alea === "submersion" || alea === "tous") {
            fresh.push(
                await addPopulationExposeeLayer(api, POPULATION_SUBM_LAYER_ID, {
                    hazard: "submersion",
                    horizon: this.horizon,
                    level: this.level,
                    opacity,
                }),
            );
        }
        if (my !== this.seq) {
            for (const h of fresh) this.destroyHandles(api, h);
            return;
        }
        const old = this.current;
        this.current = fresh;
        for (const h of old) this.destroyHandles(api, h);
    }

    private destroyCurrent(api: HrzApi.AsyncApi) {
        for (const h of this.current) this.destroyHandles(api, h);
        this.current = [];
    }

    private destroyHandles(api: HrzApi.AsyncApi, h: Handles) {
        api.LayerService.destroyLayer(h.tiles);
        api.LayerService.destroyLayer(h.data);
    }
}
