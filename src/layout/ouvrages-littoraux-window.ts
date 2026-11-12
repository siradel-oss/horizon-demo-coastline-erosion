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
import { I18n, type Text } from "../i18n";
import {
    addOuvragesLittorauxLayer,
    OUVRAGES_LEGEND,
    OUVRAGES_DEFAULT_OPACITY,
    OUVRAGES_OPACITY_RANGE,
    OUVRAGES_PICK_ATTR,
} from "../layers/ouvrages-littoraux";

const OUVRAGES_LAYER_ID = 25;

type Handles = {
    data: HrzProtocol.LayerHandle;
    tiles: HrzProtocol.LayerHandle;
};
/** Clicked structure: its source `type` (data value, untranslated) and category. */
type PickInfo = { type: string | null; category: Text; color: string };

@Component({
    selector: "app-ouvrages-littoraux-window",
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
                                en: "Coastal structures",
                                fr: "Ouvrages littoraux",
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
                        Inventaire national des
                        <b>ouvrages et aménagements</b> du littoral (digues,
                        murs, perrés, épis, brise-lames, accès, bâti,
                        infrastructures portuaires…). <b>Lecture indicative</b>,
                        pas un zonage réglementaire.
                    } @else {
                        National inventory of coastal
                        <b>structures and amenities</b> (dikes, sea walls,
                        revetments, groynes, breakwaters, accesses, buildings,
                        harbour infrastructure…). <b>Indicative reading</b>, not
                        a regulatory zoning.
                    }
                </p>
                <p class="mt-2 text-body-2xs text-text-lightest">
                    @if (lang() === "fr") {
                        Projection Cerema : dans les scénarios nationaux, les
                        ouvrages de protection sont supposés
                        <b>maintenus en 2050</b> (S1B) puis
                        <b>effacés en 2100</b> (S1C) pour borner les enjeux
                        exposés — hypothèse de stress,
                        <b>pas une prévision</b> pour un ouvrage donné (ex. les
                        remparts de Saint-Malo).
                    } @else {
                        Cerema projection: in the national scenarios, protection
                        structures are assumed <b>maintained in 2050</b> (S1B)
                        then <b>removed by 2100</b> (S1C) to bound the exposed
                        assets at stake — a stress hypothesis,
                        <b>not a forecast</b> for any given structure (e.g. the
                        ramparts of Saint-Malo).
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
                            en: "Show structures",
                            fr: "Afficher les ouvrages",
                        })
                    }}
                </button>

                @if (visible()) {
                    <div class="mt-3">
                        <app-opacity-slider
                            [label]="
                                t({
                                    en: 'Line opacity',
                                    fr: 'Opacité des tracés',
                                })
                            "
                            [(value)]="opacity"
                            [min]="range.min"
                            [max]="range.max"
                            [step]="range.step"
                        />
                    </div>

                    <div class="mt-3 flex flex-col gap-1">
                        @for (item of legend; track item.key) {
                            <div
                                class="flex flex-row items-center gap-2 text-body-2xs text-text-body"
                            >
                                <span
                                    class="inline-block w-4 h-1 rounded-sm shrink-0"
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
                            en: 'Cerema / GéoLittoral — coastal structures and amenities',
                            fr: 'Cerema / GéoLittoral — ouvrages et aménagements littoraux',
                        }),
                    ]"
                />
            </app-window>
        }

        @if (picked(); as p) {
            <div
                class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-64 p-3 rounded-lg ui-surface shadow-lg pointer-events-auto text-text-body"
            >
                <div class="flex flex-row items-center gap-2">
                    <span
                        class="inline-block w-4 h-1 rounded-sm shrink-0"
                        [style.background-color]="p.color"
                    ></span>
                    <span class="text-body-sm font-semibold grow">{{
                        p.type ??
                            t({
                                en: "Coastal structure",
                                fr: "Ouvrage littoral",
                            })
                    }}</span>
                    <app-icon-button
                        icon="close"
                        iconSize="sm"
                        [tooltip]="t({ en: 'Close', fr: 'Fermer' })"
                        (click)="clearPick()"
                    />
                </div>
                <div class="mt-1 text-body-2xs text-text-body">
                    {{ t(p.category) }}
                </div>
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
export class OuvragesLittorauxWindow {
    readonly open = model(false);
    readonly visible = signal(false);
    readonly opacity = signal(OUVRAGES_DEFAULT_OPACITY);
    readonly legend = OUVRAGES_LEGEND;
    readonly range = OUVRAGES_OPACITY_RANGE;
    readonly picked = signal<PickInfo | null>(null);

    private readonly i18n = inject(I18n);
    protected readonly t = this.i18n.t;
    protected readonly lang = this.i18n.lang;

    private readonly pickService = inject(PickService);
    private readonly panelActivity = inject(PanelActivityService);

    private readonly horizonService = inject(HorizonService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly api = signal<HrzApi.AsyncApi | null>(null);

    private current: Handles | null = null;
    private seq = 0;

    constructor() {
        this.horizonService.onApiReady((a) => this.api.set(a));

        // Only visibility and opacity drive the layer reconciliation.
        effect(() => {
            const a = this.api();
            const show = this.visible();
            const op = this.opacity();
            if (!a) return;
            void this.reconcile(a, show, op);
        });

        // Turn a click pick into a popup when a structure of this layer is hit.
        effect(() => {
            const pick = this.pickService.lastPick();
            untracked(() => this.picked.set(pick ? this.toPick(pick) : null));
        });

        // Report layer activity to the rail (badge).
        effect(() => this.panelActivity.setActive("ouvrages", this.visible()));

        this.destroyRef.onDestroy(() => {
            const a = this.api();
            if (a) this.destroyCurrent(a);
        });
    }

    /** Create-before-destroy; ignores stale requests (fast toggling). */
    private async reconcile(
        api: HrzApi.AsyncApi,
        show: boolean,
        opacity: number,
    ) {
        const my = ++this.seq;
        if (show) {
            const fresh = await addOuvragesLittorauxLayer(
                api,
                OUVRAGES_LAYER_ID,
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
            const code = this.attrNum(vec, OUVRAGES_PICK_ATTR.CATEGO);
            const item =
                OUVRAGES_LEGEND.find((l) => l.code === code) ??
                OUVRAGES_LEGEND[0];
            return {
                type: this.attrStr(vec, OUVRAGES_PICK_ATTR.TYPE),
                category: item.label,
                color: item.color,
            };
        }
        return null;
    }

    /** Reads a numeric pick attribute by its declared id, or null if absent. */
    private attrNum(
        vec: HrzProtocol.IVectorPickResult,
        id: number,
    ): number | null {
        const i = (vec.ids ?? []).findIndex((x) => Number(x) === id);
        const value = i >= 0 ? vec.values?.[i] : undefined;
        if (!value) return null;
        const n = HrzProtocolHelper.attributeAsNumber(value);
        return Number.isFinite(n) ? n : null;
    }

    /** Reads a text pick attribute by its declared id, or null if absent/empty. */
    private attrStr(
        vec: HrzProtocol.IVectorPickResult,
        id: number,
    ): string | null {
        const i = (vec.ids ?? []).findIndex((x) => Number(x) === id);
        const value = i >= 0 ? vec.values?.[i] : undefined;
        if (!value) return null;
        const v = HrzProtocolHelper.attributeAsAny(value);
        const s = v == null ? "" : String(v).trim();
        return s.length ? s : null;
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
