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
    WritableSignal,
} from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol, HrzProtocolHelper } from "@siradel-oss/horizon-protocol";
import { IconButton } from "../components/icon-button";
import { TextButton } from "../components/button";
import { Window } from "../components/window";
import { Icon } from "../components/icon";
import { HorizonService } from "../horizon.service";
import { PickService } from "../pick.service";
import {
    addTraitCoteLayer,
    addReculEvenementielLayer,
    RECUL_EVENEMENTIEL_LEGEND,
    TRAIT_COTE_PICK_ATTR,
} from "../layers";
import { Attribution } from "../components/attribution";
import { PanelActivityService } from "../panel-activity.service";
import { TourService } from "../tour.service";
import { I18n, type Text } from "../i18n";

type Handles = {
    data: HrzProtocol.LayerHandle;
    tiles: HrzProtocol.LayerHandle;
};
interface ToggleLayer {
    name: Text;
    /** Legend swatch color (CSS hex) matching the rendered line/band. */
    color: string;
    /** Dated caption (per-segment survey years from the source attributes). */
    note?: Text;
    visible: WritableSignal<boolean>;
    /** Tiles layer handle once created (used to match click picks). */
    tiles: WritableSignal<HrzProtocol.LayerHandle | null>;
}

/** Clicked coastline segment: its layer name and the picked survey attributes. */
interface SegmentInfo {
    title: Text;
    /** First survey year (ANNEE1). */
    a1: number | null;
    /** Last survey year (ANNEE2, recent coastline only). */
    a2: number | null;
    /** Positional uncertainty in metres (INCERT, recent coastline only). */
    inc: number | null;
}

@Component({
    selector: "app-trait-cote-window",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Window, IconButton, TextButton, Icon, Attribution],
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
                                en: "Coastline retreat",
                                fr: "Recul du trait de côte",
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
                        Comparez le trait de côte <b>ancien</b> et <b>récent</b>
                        (l'écart = recul ou avancée) ; la bande de
                        <b>recul événementiel</b> ajoute le recul maximal de
                        référence lors d'événements (tempêtes, mouvements de
                        falaise).
                    } @else {
                        Compare the <b>old</b> and <b>recent</b> coastlines (the
                        gap = retreat or advance); the
                        <b>event-driven retreat</b> band adds the reference
                        maximum retreat during events (storms, cliff collapses).
                    }
                </p>
                <div class="flex flex-col gap-md mt-md">
                    @for (layer of layers; track layer) {
                        <button
                            app-text-button
                            class="w-full text-left flex flex-row items-center gap-4"
                            [active]="layer.visible()"
                            (click)="layer.visible.set(!layer.visible())"
                        >
                            <app-icon
                                [icon]="
                                    layer.visible()
                                        ? 'visibility'
                                        : 'visibility_off'
                                "
                            />
                            <span
                                class="inline-block w-4 h-1.5 rounded-full shrink-0"
                                [style.background-color]="layer.color"
                            ></span>
                            <span class="flex flex-col">
                                <span>{{ t(layer.name) }}</span>
                                @if (layer.note) {
                                    <span
                                        class="text-body-2xs text-text-lightest font-normal"
                                        >{{ t(layer.note) }}</span
                                    >
                                }
                            </span>
                        </button>
                    }
                </div>
                <p class="mt-3 text-body-2xs text-text-lightest">
                    {{
                        t({
                            en: "Each segment dates from its sector's survey: the old coastline combines surveys from 1920 to 1957, so it does not match a single dated orthophoto.",
                            fr: "Chaque tronçon date du relevé de son secteur : le trait ancien agrège des levés de 1920 à 1957, il ne coïncide donc pas avec une orthophoto datée unique.",
                        })
                    }}
                </p>
                <app-attribution
                    [sources]="[
                        t({
                            en: 'Cerema — natural coastlines',
                            fr: 'Cerema — traits de côte naturels',
                        }),
                        t({
                            en: 'Cerema / GéoLittoral — event-driven retreat',
                            fr: 'Cerema / GéoLittoral — recul événementiel',
                        }),
                    ]"
                />
            </app-window>
        }
        @if (segment(); as info) {
            <div
                class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-64 p-3 rounded-lg ui-surface shadow-lg pointer-events-auto text-text-body"
            >
                <div class="flex flex-row items-center gap-2">
                    <h2 class="grow text-body-sm font-semibold">
                        {{ t(info.title) }}
                    </h2>
                    <app-icon-button
                        icon="close"
                        iconSize="sm"
                        [tooltip]="t({ en: 'Close', fr: 'Fermer' })"
                        (click)="segment.set(null)"
                    />
                </div>
                @for (line of segmentLines(); track line) {
                    <p class="mt-1 text-body-xs text-text-body/90">
                        {{ line }}
                    </p>
                }
            </div>
        }
    `,
})
export class TraitCoteWindow {
    readonly open = model(false);
    /** Clicked-segment popup (null = hidden). */
    readonly segment = signal<SegmentInfo | null>(null);
    /** Popup lines, resolved at render time so they follow the language. */
    readonly segmentLines = computed(() => {
        const info = this.segment();
        return info ? this.formatYears(info) : [];
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

    readonly ancien = this.makeLayer(
        { en: "Old coastline", fr: "Trait de côte ancien" },
        "#ff1a99", // neon magenta — matches the rendered line color
        (api) =>
            addTraitCoteLayer(api, {
                id: 10,
                key: "ancien",
                name: "Old coastline",
                color: { r: 1.0, g: 0.1, b: 0.6, a: 1 }, // neon magenta
                zIndex: 10,
            }),
        {
            en: "Surveyed 1920–1957 depending on the sector (mostly around 1952).",
            fr: "Levés de 1920 à 1957 selon le secteur (majorité vers 1952).",
        },
    );
    readonly recent = this.makeLayer(
        { en: "Recent coastline", fr: "Trait de côte récent" },
        "#38ff14", // fluorescent green — matches the rendered line color
        (api) =>
            addTraitCoteLayer(api, {
                id: 11,
                key: "recent",
                name: "Recent coastline",
                color: { r: 0.22, g: 1.0, b: 0.08, a: 1 }, // fluorescent green
                zIndex: 20,
            }),
        {
            en: "Surveyed 2005–2014 depending on the sector (mostly around 2011).",
            fr: "Levés de 2005 à 2014 selon le secteur (majorité vers 2011).",
        },
    );
    readonly evenementiel = this.makeLayer(
        { en: "Event-driven retreat", fr: "Recul événementiel" },
        RECUL_EVENEMENTIEL_LEGEND[0].color, // violet band fill
        (api) => addReculEvenementielLayer(api, 26),
        {
            en: "Reference maximum retreat (storms, cliffs) along the natural shoreline — indicative, not a local forecast.",
            fr: "Recul maximal de référence (tempêtes, falaises) sur le linéaire naturel — indicatif, pas une prévision locale.",
        },
    );
    readonly layers = [this.ancien, this.recent, this.evenementiel];

    constructor() {
        this.horizonService.onApiReady((a) => this.api.set(a));

        // Turn a click pick into a popup when an old/recent coastline segment is hit.
        effect(() => {
            const pick = this.pickService.lastPick();
            untracked(() =>
                this.segment.set(pick ? this.toSegment(pick) : null),
            );
        });

        // Report layer activity to the rail (badge), even when the panel is closed.
        effect(() =>
            this.panelActivity.setActive(
                "coastline",
                this.layers.some((l) => l.visible()),
            ),
        );

        // Guided tour: on a coastline step show either the two dated traits
        // (their gap = the observed retreat) or the event-driven retreat band,
        // per the step's `coastlineLayer`; hide everything otherwise — including
        // when the tour ends (current() === null), so finishing the tour turns
        // the tool off. Outside a tour the effect never re-runs.
        effect(() => {
            const step = this.tour.current();
            const mine = step?.panel === "coastline";
            const showEvent = mine && step?.coastlineLayer === "evenementiel";
            const showTraits = mine && !showEvent;
            untracked(() => {
                this.ancien.visible.set(showTraits);
                this.recent.visible.set(showTraits);
                this.evenementiel.visible.set(showEvent);
            });
        });
    }

    /** Builds the popup from the picked layers, or null if no coastline was hit. */
    private toSegment(
        results: HrzProtocol.IPickLayerResult[],
    ): SegmentInfo | null {
        const byOpaque = new Map<string, Text>();
        const ancien = this.ancien.tiles();
        const recent = this.recent.tiles();
        if (ancien) byOpaque.set(String(ancien.opaque), this.ancien.name);
        if (recent) byOpaque.set(String(recent.opaque), this.recent.name);

        for (const r of results) {
            if (r.layer?.type !== HrzProtocol.LayerType.VECTOR_TILES) continue;
            const vec = r.vector;
            const opaque = r.layer.handle?.opaque;
            if (!vec || opaque == null) continue;
            const title = byOpaque.get(String(opaque));
            if (!title) continue;
            return {
                title,
                a1: this.attr(vec, TRAIT_COTE_PICK_ATTR.ANNEE1),
                a2: this.attr(vec, TRAIT_COTE_PICK_ATTR.ANNEE2),
                inc: this.attr(vec, TRAIT_COTE_PICK_ATTR.INCERT),
            };
        }
        return null;
    }

    /** Human-readable survey years / uncertainty (current language). */
    private formatYears({ a1, a2, inc }: SegmentInfo): string[] {
        const t = this.t;
        const lines: string[] = [];
        if (a1) {
            lines.push(
                a2 && a2 > 0 && a2 !== a1
                    ? t({
                          en: `Surveyed between ${a1} and ${a2}`,
                          fr: `Levé entre ${a1} et ${a2}`,
                      })
                    : t({ en: `Surveyed in ${a1}`, fr: `Levé en ${a1}` }),
            );
        }
        if (inc && inc > 0) {
            const m = this.i18n.num(inc);
            lines.push(
                t({
                    en: `Positional uncertainty: ±${m} m`,
                    fr: `Incertitude de position : ±${m} m`,
                }),
            );
        }
        if (lines.length === 0) {
            lines.push(
                t({
                    en: "Survey year not available",
                    fr: "Année de levé non renseignée",
                }),
            );
        }
        return lines;
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

    /** Lazily creates a layer and drives its visibility from a toggle signal. */
    private makeLayer(
        name: Text,
        color: string,
        factory: (api: HrzApi.AsyncApi) => Promise<Handles>,
        note?: Text,
    ): ToggleLayer {
        const visible = signal(false);
        const tiles = signal<HrzProtocol.LayerHandle | null>(null);
        let handles: Handles | null = null;

        effect(() => {
            const a = this.api();
            const vis = visible();
            if (!a) return;
            void (async () => {
                if (!handles && vis) {
                    handles = await factory(a);
                    tiles.set(handles.tiles);
                }
                if (handles) {
                    await HrzApi.VectorTilesLayerPathBuilder.create(
                        handles.tiles,
                    )
                        .visible()
                        .set(a, vis);
                }
            })();
        });

        this.destroyRef.onDestroy(() => {
            const a = this.api();
            if (a && handles) {
                a.LayerService.destroyLayer(handles.tiles);
                a.LayerService.destroyLayer(handles.data);
                handles = null;
                tiles.set(null);
            }
        });

        return { name, color, note, visible, tiles };
    }
}
