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
import { HrzProtocol, HrzProtocolHelper } from "@siradel-oss/horizon-protocol";
import { IconButton } from "../components/icon-button";
import { TextButton } from "../components/button";
import { Window } from "../components/window";
import { Icon } from "../components/icon";
import { OpacitySlider } from "../components/opacity-slider";
import { HorizonService } from "../horizon.service";
import { PickService } from "../pick.service";
import { Attribution } from "../components/attribution";
import { PanelActivityService } from "../panel-activity.service";
import { TourService } from "../tour.service";
import { I18n, type Text } from "../i18n";
import {
    addEnjeuxCategoriesLayer,
    ENJEUX_CATEGORIES_LEGEND,
    ENJEUX_CATEGORIES_ALEAS,
    ENJEUX_CATEGORIES_DEFAULT_OPACITY,
    ENJEUX_CATEGORIES_OPACITY_RANGE,
    ENJEUX_CATEGORIES_PICK_ATTR,
    ENJEUX_CATEGORIES_IMPACTS,
    clcOfAc,
    aleaBitsOfAc,
    AleaFilter,
    ClcCode,
    CLC_LABEL,
} from "../layers";

const ENJEUX_CATEGORIES_LAYER_ID = 24;

type Handles = {
    data: HrzProtocol.LayerHandle;
    tiles: HrzProtocol.LayerHandle;
};
type PickInfo = { label: Text; color: string; impacts: Text[] };

/**
 * "Exposed land use" panel — the single, multi-hazard land-use layer.
 * Colours CORINE Land Cover pieces clipped to the hazards by land-use class,
 * filterable by hazard (all / retreat / flooding). Click a piece → its land-use
 * class (clc pick). One panel serves all hazards.
 */
@Component({
    selector: "app-enjeux-categories-window",
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
                        {{
                            t({
                                en: "Exposed land use",
                                fr: "Occupation du sol exposée",
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
                        Quelle <b>occupation du sol</b> est exposée aux aléas
                        côtiers — <b>recul</b> du trait de côte et
                        <b>submersion</b> marine. Filtrez par aléa ; cliquez une
                        zone pour lire sa classe. Les cartes montrent le
                        <b>scénario le plus défavorable</b> (recul à 2100,
                        submersion PHMA + 1 m). Estimation, pas un zonage
                        réglementaire.
                    } @else {
                        Which <b>land use</b> is exposed to coastal hazards —
                        coastline <b>retreat</b> and marine <b>flooding</b>.
                        Filter by hazard; click an area to read its class. The
                        maps show the <b>worst-case scenario</b> (retreat by
                        2100, flooding at HAT + 1 m). An estimate, not a
                        regulatory zoning.
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
                            en: "Show land use",
                            fr: "Afficher l'occupation du sol",
                        })
                    }}
                </button>

                @if (visible()) {
                    <div class="mt-3">
                        <div class="text-body-2xs text-text-lightest mb-1">
                            {{ t({ en: "Hazard", fr: "Aléa" }) }}
                        </div>
                        <div class="seg">
                            @for (f of aleas; track f.value) {
                                <button
                                    class="segBtn"
                                    [class.active]="alea() === f.value"
                                    (click)="alea.set(f.value)"
                                >
                                    {{ t(f.label) }}
                                </button>
                            }
                        </div>
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
                        @for (item of legend; track item.code) {
                            <div
                                class="flex flex-row items-center gap-2 text-body-2xs text-text-body"
                            >
                                <span
                                    class="inline-block w-4 h-3 rounded-sm shrink-0"
                                    [style.background-color]="item.color"
                                ></span>
                                {{ t(item.label) }}
                            </div>
                        }
                    </div>
                }

                <app-attribution
                    [sources]="[
                        'CORINE Land Cover 2018 (Copernicus / SDES via Géoplateforme IGN)',
                        t({
                            en: 'Cerema — erosion indicator (retreat)',
                            fr: 'Cerema — indicateur d’érosion (recul)',
                        }),
                        t({
                            en: 'Cerema / GéoLittoral — low-lying areas (flooding)',
                            fr: 'Cerema / GéoLittoral — zones basses (submersion)',
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

        @if (picked(); as p) {
            <div
                class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-56 p-3 rounded-lg ui-surface shadow-lg pointer-events-auto text-text-body"
            >
                <div class="flex flex-row items-center gap-2">
                    <span
                        class="inline-block w-4 h-3 rounded-sm shrink-0"
                        [style.background-color]="p.color"
                    ></span>
                    <span class="text-body-sm font-semibold grow">{{
                        t(p.label)
                    }}</span>
                    <app-icon-button
                        icon="close"
                        iconSize="sm"
                        [tooltip]="t({ en: 'Close', fr: 'Fermer' })"
                        (click)="clearPick()"
                    />
                </div>
                @if (p.impacts.length) {
                    <div class="mt-2 text-body-2xs text-text-body">
                        <div class="text-text-lightest">
                            {{ t({ en: "Impacts:", fr: "Impacts :" }) }}
                        </div>
                        @for (imp of p.impacts; track imp) {
                            <div>• {{ t(imp) }}</div>
                        }
                    </div>
                }
                <p class="mt-2 text-body-2xs text-text-lightest">
                    {{
                        t({
                            en: "Land use (CORINE Land Cover 2018).",
                            fr: "Occupation du sol (CORINE Land Cover 2018).",
                        })
                    }}
                </p>
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
                padding: 0.25rem 0.55rem;
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
export class EnjeuxCategoriesWindow {
    protected readonly t = inject(I18n).t;
    protected readonly lang = inject(I18n).lang;
    readonly open = model(false);
    readonly visible = signal(false);
    readonly alea = signal<AleaFilter>(0);
    readonly opacity = signal(ENJEUX_CATEGORIES_DEFAULT_OPACITY);
    readonly aleas = ENJEUX_CATEGORIES_ALEAS;
    readonly legend = ENJEUX_CATEGORIES_LEGEND;
    readonly range = ENJEUX_CATEGORIES_OPACITY_RANGE;
    readonly picked = signal<PickInfo | null>(null);

    private readonly horizonService = inject(HorizonService);
    private readonly pickService = inject(PickService);
    private readonly panelActivity = inject(PanelActivityService);
    private readonly tour = inject(TourService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly api = signal<HrzApi.AsyncApi | null>(null);

    private current: Handles | null = null;
    private seq = 0;

    constructor() {
        this.horizonService.onApiReady((a) => this.api.set(a));

        effect(() => {
            const a = this.api();
            const show = this.visible();
            const f = this.alea();
            const op = this.opacity();
            if (!a) return;
            void this.reconcile(a, show, f, op);
        });

        // Turn a click pick into a land-use popup when this layer is hit.
        effect(() => {
            const pick = this.pickService.lastPick();
            untracked(() => this.picked.set(pick ? this.toPick(pick) : null));
        });

        // Report layer activity to the rail (badge).
        effect(() =>
            this.panelActivity.setActive("enjeuxCategories", this.visible()),
        );

        // Guided tour: show this tool's layer while a step targets it (and
        // preselect the step's hazard filter, mapping the shared "tous/
        // chronique/submersion" vocabulary onto this tool's 0/1/2 filter), hide
        // it otherwise — including when the tour ends (current() === null), so
        // finishing the tour turns the tool off. Outside a tour it never re-runs.
        effect(() => {
            const step = this.tour.current();
            const mine = step?.panel === "enjeuxCategories";
            untracked(() => {
                this.visible.set(mine);
                if (mine && step?.alea) {
                    const filter: AleaFilter =
                        step.alea === "chronique"
                            ? 1
                            : step.alea === "submersion"
                              ? 2
                              : 0;
                    this.alea.set(filter);
                }
            });
        });

        this.destroyRef.onDestroy(() => {
            const a = this.api();
            if (a) this.destroyCurrent(a);
        });
    }

    clearPick() {
        this.pickService.clear();
    }

    /** Builds the popup from the picked layers, or null if this layer was not hit. */
    private toPick(results: HrzProtocol.IPickLayerResult[]): PickInfo | null {
        const tiles = this.current?.tiles;
        if (!tiles) return null;
        for (const r of results) {
            if (r.layer?.type !== HrzProtocol.LayerType.VECTOR_TILES) continue;
            const vec = r.vector;
            if (!vec || r.layer.handle?.opaque == null) continue;
            if (String(r.layer.handle.opaque) !== String(tiles.opaque))
                continue;
            // Single packed attribute `ac = primary*100 + also*10 + clc`.
            const ac = this.attr(vec, ENJEUX_CATEGORIES_PICK_ATTR.AC);
            if (ac == null) return null;
            const clc = clcOfAc(ac) as ClcCode;
            if (!(clc in CLC_LABEL)) return null;
            const item = this.legend.find((l) => l.code === clc);
            const bits = aleaBitsOfAc(ac);
            const impacts = ENJEUX_CATEGORIES_IMPACTS.filter(
                (i) => (bits & i.bit) !== 0,
            ).map((i) => i.label);
            return {
                label: CLC_LABEL[clc],
                color: item?.color ?? "#888",
                impacts,
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

    /** Create-before-destroy; ignores stale requests (fast filter toggling). */
    private async reconcile(
        api: HrzApi.AsyncApi,
        show: boolean,
        alea: AleaFilter,
        opacity: number,
    ) {
        const my = ++this.seq;
        if (show) {
            const fresh = await addEnjeuxCategoriesLayer(
                api,
                ENJEUX_CATEGORIES_LAYER_ID,
                alea,
                opacity,
            );
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
