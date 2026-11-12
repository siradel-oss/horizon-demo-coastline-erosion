import {
    ChangeDetectionStrategy,
    Component,
    inject,
    model,
} from "@angular/core";
import { IconButton } from "../components/icon-button";
import { Icon } from "../components/icon";
import { Window } from "../components/window";
import { I18n, type Text } from "../i18n";
import { LINKS } from "../links";

/** A data producer, the datasets reused from it, and the license they fall under. */
interface DataSource {
    producer: string;
    datasets: Text;
    license: string;
    /** Credit line the producer asks for, when it differs from its name. */
    credit?: string;
}

/** The Cerema study the whole tool is modelled on (hosted on the Cerema site). */
const CEREMA_STUDY: { title: Text; subtitle: Text; href: string } = {
    title: {
        en: "Cerema — Coastline projection and national analysis of assets at stake, 2050 and 2100 horizons",
        fr: "Cerema — Projection du trait de côte et analyse des enjeux au niveau national, horizons 2050 et 2100",
    },
    subtitle: {
        en: "National reference study (April 2024) this application is inspired by. The application is not affiliated with or endorsed by Cerema.",
        fr: "Étude nationale de référence (avril 2024) dont s'inspire cette application. L'application n'est ni affiliée au Cerema, ni validée par lui.",
    },
    href: LINKS.ceremaStudy,
};

/**
 * Exhaustive list of the source datasets, with their vintage and license —
 * always shown in full (independent of which layers are currently displayed), so
 * every data license is recalled, not only the on-screen ones.
 */
const DATA_SOURCES: DataSource[] = [
    {
        producer: "Cerema",
        datasets: {
            en: "National coastal erosion indicator (06/2018), old and recent natural coastlines, coastal structures and developments (11/2017), coastal low-lying areas below HAT and HAT + 1 m (07/2024), event-driven retreat (04/2024) — distributed through GéoLittoral (French Ministry for the Ecological Transition)",
            fr: "Indicateur national de l'érosion côtière (06/2018), traits de côte naturels anciens et récents, ouvrages et aménagements littoraux (11/2017), zones basses du littoral sous PHMA et PHMA + 1 m (07/2024), recul événementiel (04/2024) — diffusés via GéoLittoral (ministère de la Transition écologique)",
        },
        license: "Licence Ouverte 2.0",
    },
    {
        producer: "INSEE",
        datasets: {
            en: "Filosofi 2019 — population on a 200 m grid",
            fr: "Filosofi 2019 — population carroyée 200 m",
        },
        license: "Licence Ouverte 2.0",
    },
    {
        producer: "CORINE Land Cover 2018",
        datasets: {
            en: "Land use, distributed in France by SDES through IGN Géoplateforme",
            fr: "Occupation du sol, diffusée en France par le SDES via la Géoplateforme IGN",
        },
        license: "Copernicus — free, full and open",
        credit: "© European Union, Copernicus Land Monitoring Service 2018, European Environment Agency (EEA)",
    },
    {
        producer: "IGN — Géoplateforme",
        datasets: {
            en: "Orthoimagery (BD ORTHO®) and Plan IGN basemaps, RGE ALTI® elevation, 3D buildings and place names (BD TOPO®), ADMIN EXPRESS land boundary, address search — streamed at runtime",
            fr: "Fonds orthophoto (BD ORTHO®) et Plan IGN, relief RGE ALTI®, bâti 3D et toponymes (BD TOPO®), contour terre ADMIN EXPRESS, recherche d'adresse — diffusés en direct",
        },
        license: "Licence Ouverte 2.0",
    },
    {
        producer: "NASA — SRTM",
        datasets: {
            en: "SRTM3 elevation (optional relief), served by IGN Géoplateforme",
            fr: "Relief SRTM3 (relief optionnel), servi par la Géoplateforme IGN",
        },
        license: "Public domain",
    },
];

/**
 * Datasets computed by this application from the sources above: what the
 * Licence Ouverte calls "derived information". Listed so no layer reads as a
 * producer's own publication.
 */
const PROCESSING: Text[] = [
    {
        en: "2050 / 2100 retreat zones and impact depth: linear extrapolation of the 2018 erosion indicator (rate × years since 2018), clipped to the land",
        fr: "Zones à risque et profondeur d'impact 2050 / 2100 : extrapolation linéaire de l'indicateur d'érosion 2018 (taux × années depuis 2018), découpée sur la terre",
    },
    {
        en: "Event-driven retreat band: each coastline segment buffered by its reference retreat, clipped to the land",
        fr: "Bande de recul événementiel : chaque segment de côte élargi de son recul de référence, découpé sur la terre",
    },
    {
        en: "Exposed population, assets at stake and their land-use categories: crossings of the hazard zones with INSEE Filosofi and CORINE Land Cover",
        fr: "Population exposée, enjeux et leurs catégories d'occupation du sol : croisements des zones d'aléa avec INSEE Filosofi et CORINE Land Cover",
    },
    {
        en: "Low-lying areas: smallest polygons dropped and detail reduced for display",
        fr: "Zones basses : plus petits polygones écartés et détail réduit pour l'affichage",
    },
];

/**
 * "Attributions" panel — three parts:
 *   1. Inspiration: the Cerema study (link to the Cerema site).
 *   2. Data & licenses: the exhaustive list of source datasets and their
 *      licenses. Static so every license is always recalled, not just the
 *      layers currently on screen.
 *   3. Processing: what the application derived from those sources, as the
 *      Licence Ouverte asks reusers to state.
 *
 * Embedded font/icon licenses (OFL / MIT) are NOT listed here: their notices ship
 * with the build (resources/*-OFL.txt, *-LICENSE.txt copied to the dist root),
 * which is what those licenses require — no need to surface them in this UI.
 */
@Component({
    selector: "app-attributions-window",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Window, IconButton, Icon],
    template: `
        @if (open()) {
            <app-window
                side="right"
                class="absolute top-4 right-4 bottom-4 w-96 p-5"
            >
                <div class="flex flex-row items-center mb-lg">
                    <h1 class="grow text-xl font-semibold">
                        {{ t({ en: "Attributions", fr: "Attributions" }) }}
                    </h1>
                    <app-icon-button
                        icon="close"
                        iconSize="md"
                        (click)="open.set(false)"
                    />
                </div>

                <!-- 1. Inspiration ------------------------------------------------->
                <section class="mt-5">
                    <div class="sec-label">
                        {{
                            t({ en: "Inspiration", fr: "Source d'inspiration" })
                        }}
                    </div>
                    <a
                        class="card group"
                        [href]="study.href"
                        target="_blank"
                        rel="noopener"
                    >
                        <app-icon
                            icon="history"
                            size="md"
                            class="text-brand-muted shrink-0 mt-0.5"
                        />
                        <span class="grow">
                            <span class="block text-body-sm font-medium">
                                {{ t(study.title) }}
                            </span>
                            <span
                                class="block text-body-2xs text-text-lightest mt-0.5"
                            >
                                {{ t(study.subtitle) }}
                            </span>
                            <span
                                class="block text-body-2xs text-brand-muted mt-1 group-hover:underline"
                            >
                                {{
                                    t({
                                        en: "View the study on the Cerema website ↗",
                                        fr: "Voir l'étude sur le site du Cerema ↗",
                                    })
                                }}
                            </span>
                        </span>
                    </a>
                </section>

                <!-- 2. Data & licenses --------------------------------------------->
                <section class="mt-5">
                    <div class="sec-label">
                        {{
                            t({
                                en: "Data & licenses",
                                fr: "Données & licences",
                            })
                        }}
                    </div>
                    <ul class="flex flex-col gap-3">
                        @for (src of dataSources; track src.producer) {
                            <li class="flex flex-row gap-2">
                                <app-icon
                                    icon="map"
                                    size="sm"
                                    class="text-text-lightest shrink-0 mt-0.5"
                                />
                                <div class="grow">
                                    <div class="text-body-xs font-medium">
                                        {{ src.producer }}
                                    </div>
                                    <div
                                        class="text-body-2xs text-text-lightest"
                                    >
                                        {{ t(src.datasets) }}
                                    </div>
                                    @if (src.credit) {
                                        <div
                                            class="text-body-2xs text-text-lightest italic mt-0.5"
                                        >
                                            {{ src.credit }}
                                        </div>
                                    }
                                    <span class="license-pill">{{
                                        src.license
                                    }}</span>
                                </div>
                            </li>
                        }
                    </ul>
                </section>

                <!-- 3. Processing -------------------------------------------------->
                <section class="mt-5">
                    <div class="sec-label">
                        {{
                            t({
                                en: "Processing by Siradel",
                                fr: "Traitements Siradel",
                            })
                        }}
                    </div>
                    <p class="text-body-2xs text-text-lightest mb-2">
                        {{
                            t({
                                en: "The layers below are derived information computed by this application from the sources above. They are neither published nor validated by their producers.",
                                fr: "Les couches ci-dessous sont des informations dérivées, calculées par cette application à partir des sources ci-dessus. Elles ne sont ni publiées ni validées par leurs producteurs.",
                            })
                        }}
                    </p>
                    <ul class="flex flex-col gap-1.5 list-disc ps-4">
                        @for (p of processing; track $index) {
                            <li class="text-body-2xs">{{ t(p) }}</li>
                        }
                    </ul>
                </section>
            </app-window>
        }
    `,
    styles: [
        `
            .sec-label {
                font-size: 0.7rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--color-text-lightest);
                margin-bottom: 0.5rem;
            }
            .card {
                display: flex;
                flex-direction: row;
                gap: 0.625rem;
                padding: 0.75rem;
                border: 1px solid var(--color-border-default);
                border-radius: 0.5rem;
                transition: background-color 0.15s;
            }
            .card:hover {
                background-color: color-mix(
                    in srgb,
                    var(--color-surface-primary) 8%,
                    transparent
                );
            }
            .license-pill {
                display: inline-block;
                margin-top: 0.25rem;
                padding: 0.05rem 0.4rem;
                border-radius: 0.25rem;
                font-size: 0.65rem;
                color: var(--color-brand-muted);
                background-color: color-mix(
                    in srgb,
                    var(--color-brand-muted) 12%,
                    transparent
                );
            }
        `,
    ],
})
export class AttributionsWindow {
    readonly open = model(false);
    readonly study = CEREMA_STUDY;
    readonly dataSources = DATA_SOURCES;
    readonly processing = PROCESSING;
    protected readonly t = inject(I18n).t;
}
