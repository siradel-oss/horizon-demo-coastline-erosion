import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    model,
    signal,
    untracked,
} from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol, HrzProtocolHelper } from "@siradel-oss/horizon-protocol";
import { IconButton } from "../components/icon-button";
import { TextButton } from "../components/button";
import { Window } from "../components/window";
import { Icon } from "../components/icon";
import { OpacitySlider } from "../components/opacity-slider";
import { HorizonService } from "../horizon.service";
import { PickService } from "../pick.service";
import {
    addRiskZonesLayer,
    addRiskDepthLayer,
    addRiskBandLayer,
    RISK_LEGEND,
    RISK_DEFAULT_OPACITY,
    RISK_OPACITY_RANGE,
    RISK_PICK_ATTR,
    EROSION_BASE_YEAR,
    addErosionIndicatorLayer,
    EROSION_LEGEND,
} from "../layers";
import { Attribution } from "../components/attribution";
import { PanelActivityService } from "../panel-activity.service";
import { TourService } from "../tour.service";
import { I18n, type Text } from "../i18n";

/** Clicked risk sector: measured erosion rate and the horizon it was read at. */
interface SectorInfo {
    /** Measured erosion rate (m/yr, positive). */
    rate: number;
    /** Projected retreat at the horizon (m, rounded). */
    retreat: number;
    horizon: number;
}

const HORIZONS = [2050, 2100] as const;
const RISK_LAYER_ID = 20;
/** Cerema erosion indicator (raw taux-colored polygons) — the base the risk
 *  classes are derived from; shown here as an optional reference layer. */
const EROSION_INDICATOR_LAYER_ID = 12;

/** Depth-of-impact visualization modes. */
type DepthMode = "none" | "ground" | "compare3d";
const DEPTH_MODES: { id: DepthMode; label: Text }[] = [
    { id: "none", label: { en: "None", fr: "Aucune" } },
    { id: "ground", label: { en: "Ground", fr: "Au sol" } },
    { id: "compare3d", label: { en: "3D", fr: "3D" } },
];

type Handles = {
    data: HrzProtocol.LayerHandle;
    tiles: HrzProtocol.LayerHandle;
};

@Component({
    selector: "app-risk-zones-window",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Window, IconButton, TextButton, Icon, OpacitySlider, Attribution],
    template: `
        @if (open()) {
            <app-window
                side="left"
                class="absolute top-0 left-0 w-80 max-h-[calc(100vh-6rem)] p-lg"
            >
                <div class="flex flex-row items-center mb-lg">
                    <h1 class="grow text-xl font-semibold">
                        {{ t({ en: "Risk zones", fr: "Zones à risque" }) }}
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
                        Secteurs colorés par <b>recul projeté</b> à l'horizon
                        choisi, en prolongeant le rythme d'érosion mesuré
                        (Cerema). Ordre de grandeur si la tendance se poursuit —
                        <b>pas une prévision officielle</b>.
                    } @else {
                        Sectors colored by <b>projected retreat</b> at the
                        chosen horizon, extending the measured erosion rate
                        (Cerema). An order of magnitude if the trend continues —
                        <b>not an official forecast</b>.
                    }
                </p>

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
                            en: "Show risk zones",
                            fr: "Afficher les zones à risque",
                        })
                    }}
                </button>

                @if (visible()) {
                    <div class="mt-3">
                        <div class="text-body-2xs text-text-lightest mb-1">
                            {{ t({ en: "Horizon", fr: "Horizon" }) }}
                        </div>
                        <div class="seg">
                            @for (h of horizons; track h) {
                                <button
                                    class="segBtn"
                                    [class.active]="horizon() === h"
                                    (click)="horizon.set(h)"
                                >
                                    {{ h }}
                                </button>
                            }
                        </div>
                    </div>

                    <div class="mt-3">
                        <div class="text-body-2xs text-text-lightest mb-1">
                            {{
                                t({
                                    en: "Impact depth",
                                    fr: "Profondeur d'impact",
                                })
                            }}
                        </div>
                        <div class="seg">
                            @for (m of depthModes; track m.id) {
                                <button
                                    class="segBtn"
                                    [class.active]="depthMode() === m.id"
                                    (click)="depthMode.set(m.id)"
                                >
                                    {{ t(m.label) }}
                                </button>
                            }
                        </div>
                        @if (depthMode() === "ground") {
                            <p class="mt-1 text-body-2xs text-text-lightest">
                                {{
                                    t({
                                        en: "Band of threatened land, sized by the projected retreat and bounded by the coastline (IGN outline). Indicative footprint.",
                                        fr: "Bande de terre menacée, dimensionnée par le recul projeté et bornée au trait de côte (contour IGN). Emprise indicative.",
                                    })
                                }}
                            </p>
                        }
                        @if (depthMode() === "compare3d") {
                            <p class="mt-1 text-body-2xs text-text-lightest">
                                {{
                                    t({
                                        en: "Height = magnitude of the projected retreat (m); tilt the view to compare sectors.",
                                        fr: "Hauteur = ampleur du recul projeté (m) ; inclinez la vue pour comparer les secteurs.",
                                    })
                                }}
                            </p>
                        }
                    </div>

                    <div class="mt-3">
                        <app-opacity-slider
                            [label]="
                                t({
                                    en: 'Fill opacity',
                                    fr: 'Opacité du remplissage',
                                })
                            "
                            [(value)]="opacity"
                            [min]="range.min"
                            [max]="range.max"
                            [step]="range.step"
                        />
                    </div>

                    <div class="mt-3 flex flex-col gap-1">
                        @for (item of legend; track item.color) {
                            <div
                                class="flex flex-row items-center gap-2 text-body-2xs text-text-body"
                            >
                                <span
                                    class="inline-block w-4 h-2 rounded-sm shrink-0"
                                    [style.background-color]="item.color"
                                ></span>
                                {{ t(item.label) }}
                            </div>
                        }
                    </div>

                    <p class="mt-3 text-body-2xs text-text-lightest">
                        @if (lang() === "fr") {
                            Cliquez un secteur pour lire son
                            <b>recul projeté</b>
                            (en mètres) à l'horizon choisi.
                        } @else {
                            Click a sector to read its <b>projected retreat</b>
                            (in metres) at the chosen horizon.
                        }
                    </p>
                }

                <button
                    app-text-button
                    class="w-full text-left flex flex-row items-center gap-4 mt-3"
                    [active]="indicatorVisible()"
                    (click)="indicatorVisible.set(!indicatorVisible())"
                >
                    <app-icon
                        [icon]="
                            indicatorVisible() ? 'visibility' : 'visibility_off'
                        "
                    />
                    {{
                        t({
                            en: "Erosion indicator (Cerema)",
                            fr: "Indicateur d'érosion (Cerema)",
                        })
                    }}
                </button>
                @if (indicatorVisible()) {
                    <p class="mt-2 text-body-2xs text-text-lightest">
                        {{
                            t({
                                en: "Measured rate of change (m/yr) along the shoreline; the risk zones above reclassify it by projected retreat.",
                                fr: "Rythme d'évolution mesuré (m/an) sur le linéaire ; les zones à risque ci-dessus en sont la reclassification par recul projeté.",
                            })
                        }}
                    </p>
                    <div class="mt-2 flex flex-col gap-1">
                        @for (item of erosionLegend; track item.color) {
                            <div
                                class="flex flex-row items-center gap-2 text-body-2xs text-text-body"
                            >
                                <span
                                    class="inline-block w-4 h-1.5 rounded-full shrink-0"
                                    [style.background-color]="item.color"
                                ></span>
                                {{ t(item.label) }}
                            </div>
                        }
                    </div>
                }

                <app-attribution
                    [sources]="[
                        t({
                            en: 'Cerema — national coastal erosion indicator',
                            fr: 'Cerema — indicateur national d’érosion côtière',
                        }),
                    ]"
                    [note]="
                        t({
                            en: 'trend-based estimate, Siradel processing',
                            fr: 'estimation par tendance, traitement Siradel',
                        })
                    "
                />
            </app-window>
        }
        @if (sector(); as info) {
            <div
                class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-64 p-3 rounded-lg ui-surface shadow-lg pointer-events-auto text-text-body"
            >
                <div class="flex flex-row items-center gap-2">
                    <h2 class="grow text-body-sm font-semibold">
                        {{
                            t({ en: "Projected retreat", fr: "Recul projeté" })
                        }}
                    </h2>
                    <app-icon-button
                        icon="close"
                        iconSize="sm"
                        [tooltip]="t({ en: 'Close', fr: 'Fermer' })"
                        (click)="sector.set(null)"
                    />
                </div>
                @for (line of sectorLines(); track line) {
                    <p class="mt-1 text-body-xs text-text-body/90">
                        {{ line }}
                    </p>
                }
            </div>
        }
    `,
    styles: [
        `
            .seg {
                display: inline-flex;
                border: 1px solid var(--color-border-default);
                border-radius: 0.5rem;
                overflow: hidden;
            }
            .segBtn {
                padding: 0.25rem 0.75rem;
                font-size: 0.8rem;
                color: var(--color-text-body);
                cursor: pointer;
                transition: background-color 0.15s;
            }
            .segBtn + .segBtn {
                border-left: 1px solid var(--color-border-default);
            }
            .segBtn:hover {
                background-color: color-mix(
                    in srgb,
                    var(--color-surface-primary) 10%,
                    transparent
                );
            }
            .segBtn.active {
                background-color: var(--color-surface-primary);
                color: rgb(255 255 255 / 1);
            }
        `,
    ],
})
export class RiskZonesWindow {
    readonly open = model(false);
    readonly visible = signal(false);
    readonly horizon = signal<number>(HORIZONS[0]);
    readonly opacity = signal(RISK_DEFAULT_OPACITY);
    readonly depthMode = signal<DepthMode>("none");
    readonly horizons = HORIZONS;
    readonly depthModes = DEPTH_MODES;
    readonly legend = RISK_LEGEND;
    readonly range = RISK_OPACITY_RANGE;
    readonly indicatorVisible = signal(false);
    readonly erosionLegend = EROSION_LEGEND;
    /** Clicked-sector popup (null = hidden). */
    readonly sector = signal<SectorInfo | null>(null);
    /** Popup lines, resolved at render time so they follow the language. */
    readonly sectorLines = computed(() => {
        const s = this.sector();
        if (!s) return [];
        const t = this.t;
        const m = this.i18n.num(s.retreat);
        const rate = this.i18n.num(s.rate, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return [
            t({
                en: `≈ ${m} m by ${s.horizon}`,
                fr: `≈ ${m} m d'ici ${s.horizon}`,
            }),
            t({
                en: `Measured rate: ${rate} m/yr`,
                fr: `Rythme mesuré : ${rate} m/an`,
            }),
            t({
                en: "Trend-based estimate, not a forecast.",
                fr: "Estimation par tendance, pas une prévision.",
            }),
        ];
    });

    private readonly i18n = inject(I18n);
    protected readonly t = this.i18n.t;
    protected readonly lang = this.i18n.lang;

    private readonly horizonService = inject(HorizonService);
    private readonly pickService = inject(PickService);
    private readonly panelActivity = inject(PanelActivityService);
    private readonly tour = inject(TourService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly api = signal<HrzApi.AsyncApi | null>(null);

    private current: Handles | null = null;
    private seq = 0;
    private indicator: Handles | null = null;
    private indicatorSeq = 0;

    constructor() {
        this.horizonService.onApiReady((a) => this.api.set(a));

        effect(() => {
            const a = this.api();
            const show = this.visible();
            const h = this.horizon();
            const op = this.opacity();
            const mode = this.depthMode();
            if (!a) return;
            void this.reconcile(a, show, h, op, mode);
        });

        // Turn a click pick into a popup when a risk sector is hit.
        effect(() => {
            const pick = this.pickService.lastPick();
            untracked(() => this.sector.set(pick ? this.toSector(pick) : null));
        });

        // Optional Cerema erosion indicator (independent toggle).
        effect(() => {
            const a = this.api();
            const show = this.indicatorVisible();
            if (!a) return;
            void this.reconcileIndicator(a, show);
        });

        // Report layer activity to the rail (badge).
        effect(() =>
            this.panelActivity.setActive(
                "risk",
                this.visible() || this.indicatorVisible(),
            ),
        );

        // Guided tour: show this tool's layer while a step targets it (and
        // preselect the step's horizon), hide it otherwise — including when the
        // tour ends (current() === null), so finishing the tour turns the tool
        // off. Outside a tour the effect never re-runs, so manual state is safe.
        effect(() => {
            const step = this.tour.current();
            const mine = step?.panel === "risk";
            untracked(() => {
                this.visible.set(mine);
                if (mine && step?.horizon) this.horizon.set(step.horizon);
                if (mine && step?.depthMode) this.depthMode.set(step.depthMode);
            });
        });

        this.destroyRef.onDestroy(() => {
            const a = this.api();
            if (a) {
                this.destroyCurrent(a);
                if (this.indicator) this.destroyHandles(a, this.indicator);
            }
        });
    }

    /** Builds the popup from the picked layers, or null if no risk sector was hit. */
    private toSector(
        results: HrzProtocol.IPickLayerResult[],
    ): SectorInfo | null {
        const tiles = this.current?.tiles;
        if (!tiles) return null;
        for (const r of results) {
            if (r.layer?.type !== HrzProtocol.LayerType.VECTOR_TILES) continue;
            const vec = r.vector;
            if (!vec || r.layer.handle?.opaque == null) continue;
            if (String(r.layer.handle.opaque) !== String(tiles.opaque))
                continue;
            const taux = this.attr(vec, RISK_PICK_ATTR.TAUX);
            if (taux == null || taux >= 0) return null;
            const years = this.horizon() - EROSION_BASE_YEAR;
            return {
                rate: Math.abs(taux),
                retreat: Math.round(Math.abs(taux) * years),
                horizon: this.horizon(),
            };
        }
        return null;
    }

    /** Reads a numeric pick attribute by its declared id, or null if absent. */
    private attr(
        vec: HrzProtocol.IVectorPickResult,
        id: number,
    ): number | null {
        const i = (vec.ids ?? []).findIndex((x) => Number(x) === id);
        const value = i >= 0 ? vec.values?.[i] : undefined;
        if (!value) return null;
        const n = HrzProtocolHelper.attributeAsNumber(value);
        return Number.isFinite(n) ? n : null;
    }

    /** Create-before-destroy; ignores stale requests (fast horizon/mode switching). */
    private async reconcile(
        api: HrzApi.AsyncApi,
        show: boolean,
        horizon: number,
        opacity: number,
        mode: DepthMode,
    ) {
        const my = ++this.seq;
        if (show) {
            const build =
                mode === "compare3d"
                    ? addRiskDepthLayer
                    : mode === "ground"
                      ? addRiskBandLayer
                      : addRiskZonesLayer;
            const fresh = await build(api, RISK_LAYER_ID, horizon, opacity);
            if (my !== this.seq) {
                this.destroyHandles(api, fresh);
                return;
            }
            const old = this.current;
            this.current = fresh;
            if (old) this.destroyHandles(api, old);
        } else {
            if (my !== this.seq) return;
            this.destroyCurrent(api);
        }
    }

    /** Create-before-destroy for the optional Cerema erosion indicator layer. */
    private async reconcileIndicator(api: HrzApi.AsyncApi, show: boolean) {
        const my = ++this.indicatorSeq;
        if (show) {
            const fresh = await addErosionIndicatorLayer(
                api,
                EROSION_INDICATOR_LAYER_ID,
            );
            if (my !== this.indicatorSeq) {
                this.destroyHandles(api, fresh);
                return;
            }
            const old = this.indicator;
            this.indicator = fresh;
            if (old) this.destroyHandles(api, old);
        } else {
            if (my !== this.indicatorSeq) return;
            if (this.indicator) {
                this.destroyHandles(api, this.indicator);
                this.indicator = null;
            }
        }
    }

    private destroyCurrent(api: HrzApi.AsyncApi) {
        if (this.current) {
            this.destroyHandles(api, this.current);
            this.current = null;
        }
    }

    private destroyHandles(api: HrzApi.AsyncApi, h: Handles) {
        api.LayerService.destroyLayer(h.tiles);
        api.LayerService.destroyLayer(h.data);
    }
}
