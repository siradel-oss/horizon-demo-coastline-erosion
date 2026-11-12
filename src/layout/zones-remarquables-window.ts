import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    model,
    signal,
} from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { IconButton } from "../components/icon-button";
import { Window } from "../components/window";
import { LocalityList, Locality } from "../components/locality-list";
import { Attribution } from "../components/attribution";
import { AleaSelector, Alea } from "../components/alea-selector";
import { HorizonService } from "../horizon.service";
import { VIEWPOINTS, flyTo } from "../viewpoints";
import { dataUrl } from "../layers/_shared";
import { I18n } from "../i18n";

/** Exposed-population impacts per coastal sector (pre-generated JSON). */
interface SectorImpact {
    key: string;
    name: string;
    lon: number;
    lat: number;
    phma: number;
    phma1m: number;
}

/**
 * "Notable sites" navigation tool — lives in Exploration, with a PER-TOOL
 * hazard selector (each hazard has its own hotspots), built on
 * {@link LocalityList}: retreat = curated erosion sites ranked by local retreat
 * rate; flooding = coastal sectors ranked by exposed population at HAT + 1 m.
 * Click a row to fly there.
 */
@Component({
    selector: "app-zones-remarquables-window",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Window, IconButton, LocalityList, AleaSelector, Attribution],
    template: `
        @if (open()) {
            <app-window
                side="left"
                class="absolute top-0 left-0 w-80 max-h-[calc(100vh-6rem)] p-lg"
            >
                <div class="flex flex-row items-center mb-lg">
                    <h1 class="grow text-xl font-semibold">
                        {{
                            t({ en: "Notable sites", fr: "Zones remarquables" })
                        }}
                    </h1>
                    <app-icon-button
                        icon="close"
                        iconSize="md"
                        (click)="open.set(false)"
                    />
                </div>

                @if (alea() === "chronique") {
                    <p class="mt-2 text-body-md text-text-body/90">
                        @if (lang() === "fr") {
                            Sites d'érosion littorale emblématiques, classés par
                            <b>taux de recul</b> local. Cliquez pour vous y
                            rendre, puis activez l'indicateur d'érosion pour
                            visualiser le recul.
                        } @else {
                            Iconic coastal erosion sites, ranked by local
                            <b>retreat rate</b>. Click to fly there, then turn
                            on the erosion indicator to see the retreat.
                        }
                    </p>
                } @else {
                    <p class="mt-2 text-body-md text-text-body/90">
                        @if (lang() === "fr") {
                            Habitants en zone basse submersible au scénario
                            <b>PHMA + 1 m</b> (élévation simulée du niveau
                            marin), par secteur littoral, classés par population
                            exposée. Cliquez pour vous y rendre.
                        } @else {
                            Inhabitants of low-lying floodable areas under the
                            <b>HAT + 1 m</b> scenario (simulated sea-level
                            rise), per coastal sector, ranked by exposed
                            population. Click to fly there.
                        }
                    </p>
                }

                <div class="mt-3">
                    <div class="text-body-2xs text-text-lightest mb-1">
                        {{ t({ en: "Hazard", fr: "Aléa" }) }}
                    </div>
                    <app-alea-selector [(value)]="alea" />
                </div>

                <div class="mt-3">
                    <app-locality-list
                        [items]="localities()"
                        [icon]="icon()"
                        [empty]="
                            t({
                                en: 'Estimate unavailable for now.',
                                fr: 'Estimation indisponible pour le moment.',
                            })
                        "
                        (select)="goTo($event)"
                    />
                </div>

                @if (alea() === "chronique") {
                    <p class="mt-3 text-body-2xs text-text-lightest">
                        {{
                            t({
                                en: "Rate = local maximum retreat (~10 km) from the indicator.",
                                fr: "Taux = recul max local (~10 km) de l'indicateur.",
                            })
                        }}
                    </p>
                    <app-attribution
                        [sources]="[
                            t({
                                en: 'Cerema — national coastal erosion indicator',
                                fr: 'Cerema — indicateur national d’érosion côtière',
                            }),
                        ]"
                    />
                } @else {
                    <p class="mt-3 text-body-2xs text-text-lightest">
                        @if (lang() === "fr") {
                            Habitants exposés à PHMA + 1 m, estimés par carreau
                            INSEE 200 m. Lecture indicative, pas une prévision
                            locale.
                        } @else {
                            Inhabitants exposed at HAT + 1 m, estimated per 200
                            m INSEE grid cell. Indicative reading, not a local
                            forecast.
                        }
                    </p>
                    <app-attribution
                        [sources]="[
                            t({
                                en: 'Cerema / GéoLittoral — low-lying areas',
                                fr: 'Cerema / GéoLittoral — zones basses',
                            }),
                            'INSEE Filosofi 2019',
                        ]"
                    />
                }
            </app-window>
        }
    `,
})
export class ZonesRemarquablesWindow {
    readonly open = model(false);
    readonly alea = signal<Alea>("chronique");

    private readonly i18n = inject(I18n);
    protected readonly t = this.i18n.t;
    protected readonly lang = this.i18n.lang;

    /** Curated erosion sites, ranked by descending retreat rate. */
    private readonly erosionSites = [...VIEWPOINTS].sort(
        (a, b) => b.taux - a.taux,
    );

    /** Flooding sectors, ranked by +1 m exposure (0-exposure ones hidden). */
    private readonly sectors = signal<SectorImpact[]>([]);

    /** Rows of the selected hazard, resolved in the current language. */
    readonly localities = computed<Locality[]>(() => {
        const { t, num } = this.i18n;
        if (this.alea() === "chronique") {
            const unit = t({ en: "m/yr", fr: "m/an" });
            return this.erosionSites.map((vp) => ({
                name: t(vp.name),
                detail: t(vp.detail),
                metric: `${num(vp.taux, { maximumFractionDigits: 1 })} ${unit}`,
                lon: vp.lon,
                lat: vp.lat,
            }));
        }
        return this.sectors().map((s) => ({
            name: s.name,
            detail: t({
                en: `HAT: ${num(s.phma)} inh.`,
                fr: `PHMA : ${num(s.phma)} hab`,
            }),
            metric: num(s.phma1m),
            lon: s.lon,
            lat: s.lat,
        }));
    });
    readonly icon = computed(() =>
        this.alea() === "chronique" ? "trending_down" : "location_on",
    );

    private readonly horizonService = inject(HorizonService);
    private readonly api = signal<HrzApi.AsyncApi | null>(null);

    constructor() {
        this.horizonService.onApiReady((a) => this.api.set(a));
        // Optional, non-blocking: sorted by +1 m exposure, 0-exposure hidden.
        fetch(dataUrl("submersion_impacts.json"))
            .then((res) =>
                res.ok ? (res.json() as Promise<SectorImpact[]>) : [],
            )
            .then((data) =>
                this.sectors.set(
                    data
                        .filter((s) => s.phma1m > 0)
                        .sort((a, b) => b.phma1m - a.phma1m),
                ),
            )
            .catch(() => {});
    }

    goTo(it: Locality) {
        const a = this.api();
        if (a) flyTo(a, it.lon, it.lat);
    }
}
