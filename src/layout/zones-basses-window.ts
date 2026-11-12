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
import { HorizonService } from "../horizon.service";
import { Attribution } from "../components/attribution";
import { PanelActivityService } from "../panel-activity.service";
import { TourService } from "../tour.service";
import { I18n } from "../i18n";
import {
    addZonesBassesLayer,
    ZONES_BASSES_LEGEND,
    ZONES_BASSES_DEFAULT_OPACITY,
    ZONES_BASSES_OPACITY_RANGE,
} from "../layers";

type Level = (typeof ZONES_BASSES_LEGEND)[number]["key"];
const LEVELS = ZONES_BASSES_LEGEND.map((l) => l.key) as readonly Level[];
const ZONES_BASSES_LAYER_ID = 21;

type Handles = {
    data: HrzProtocol.LayerHandle;
    tiles: HrzProtocol.LayerHandle;
};

@Component({
    selector: "app-zones-basses-window",
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
                        {{ t({ en: "Low-lying areas", fr: "Zones basses" }) }}
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
                        Terres situées
                        <b>sous le niveau des plus hautes mers</b> astronomiques
                        (PHMA), donc potentiellement submersibles à marée haute
                        exceptionnelle. La variante <b>+ 1 m</b> simule
                        l'élévation du niveau marin. <b>Lecture indicative</b>,
                        pas un zonage réglementaire.
                    } @else {
                        Land lying
                        <b>below the highest astronomical tide</b> (HAT), hence
                        potentially flooded at an exceptional high tide. The
                        <b>+ 1 m</b> variant simulates sea-level rise.
                        <b>Indicative reading</b>, not a regulatory zoning.
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
                            en: "Show low-lying areas",
                            fr: "Afficher les zones basses",
                        })
                    }}
                </button>

                @if (visible()) {
                    <div class="mt-3">
                        <div class="text-body-2xs text-text-lightest mb-1">
                            {{ t({ en: "Level", fr: "Niveau" }) }}
                        </div>
                        <div class="seg">
                            @for (l of levels; track l) {
                                <button
                                    class="segBtn"
                                    [class.active]="level() === l"
                                    (click)="level.set(l)"
                                >
                                    {{
                                        l === "phma"
                                            ? t({ en: "HAT", fr: "PHMA" })
                                            : t({
                                                  en: "HAT + 1 m",
                                                  fr: "PHMA + 1 m",
                                              })
                                    }}
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
                        @for (item of legend; track item.key) {
                            <div
                                class="flex flex-row items-center gap-2 text-body-2xs"
                                [class.text-text-body]="level() === item.key"
                                [class.text-text-lightest]="
                                    level() !== item.key
                                "
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
                        t({
                            en: 'Cerema / GéoLittoral — low-lying coastal areas',
                            fr: 'Cerema / GéoLittoral — zones basses du littoral',
                        }),
                    ]"
                />
            </app-window>
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
export class ZonesBassesWindow {
    protected readonly t = inject(I18n).t;
    protected readonly lang = inject(I18n).lang;
    readonly open = model(false);
    readonly visible = signal(false);
    readonly level = signal<Level>(LEVELS[0]);
    readonly opacity = signal(ZONES_BASSES_DEFAULT_OPACITY);
    readonly levels = LEVELS;
    readonly legend = ZONES_BASSES_LEGEND;
    readonly range = ZONES_BASSES_OPACITY_RANGE;

    private readonly horizonService = inject(HorizonService);
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
            const lvl = this.level();
            const op = this.opacity();
            if (!a) return;
            void this.reconcile(a, show, lvl, op);
        });

        // Report layer activity to the rail (badge).
        effect(() =>
            this.panelActivity.setActive("zonesBasses", this.visible()),
        );

        // Guided tour: show this tool's layer while a step targets it (and
        // preselect the step's sea-level threshold), hide it otherwise —
        // including when the tour ends (current() === null), so finishing the
        // tour turns the tool off. Outside a tour the effect never re-runs.
        effect(() => {
            const step = this.tour.current();
            const mine = step?.panel === "zonesBasses";
            untracked(() => {
                this.visible.set(mine);
                if (mine && step?.level) this.level.set(step.level);
            });
        });

        this.destroyRef.onDestroy(() => {
            const a = this.api();
            if (a) this.destroyCurrent(a);
        });
    }

    /** Create-before-destroy; ignores stale requests (fast level toggling). */
    private async reconcile(
        api: HrzApi.AsyncApi,
        show: boolean,
        level: Level,
        opacity: number,
    ) {
        const my = ++this.seq;
        if (show) {
            const fresh = await addZonesBassesLayer(
                api,
                ZONES_BASSES_LAYER_ID,
                level,
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
