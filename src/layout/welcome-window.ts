import {
    ChangeDetectionStrategy,
    Component,
    inject,
    model,
    output,
} from "@angular/core";
import { Window } from "../components/window";
import { Icon } from "../components/icon";
import { IconButton } from "../components/icon-button";
import { TextButton } from "../components/button";
import { ScePin } from "../components/sce-pin";
import { SiradelLogo } from "../components/siradel-logo";
import { LangPicker } from "../components/lang-picker";
import { I18n, Text } from "../i18n";
import { LINKS } from "../links";

/**
 * First-launch "About" popin. States what the app is (a demonstrator of the
 * Horizon 3D engine), credits the Cerema study it is inspired by, notes that
 * the data is reprocessed, and links to Horizon, SCE, Siradel
 * and the open source contact. Two CTAs: explore freely (dismiss) or start the
 * guided tour. Re-openable from the `?` button; the "seen" state is owned by App.
 */
@Component({
    selector: "app-welcome-window",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        Window,
        Icon,
        IconButton,
        TextButton,
        ScePin,
        SiradelLogo,
        LangPicker,
    ],
    template: `
        @if (open()) {
            <div
                class="fixed inset-0 z-[500] flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="welcome-title"
            >
                <!-- Backdrop: click dismisses (= explore freely). -->
                <div
                    class="absolute inset-0 bg-black/50"
                    (click)="explore.emit()"
                ></div>

                <app-window
                    class="relative w-full max-w-[42rem] max-h-[85vh] p-6 flex flex-col"
                >
                    <div class="flex flex-row items-start gap-3">
                        <div class="grow">
                            <h1 id="welcome-title" class="text-h5 font-black">
                                {{
                                    t({
                                        en: "Welcome to Shoreline Explorer",
                                        fr: "Bienvenue sur Shoreline Explorer",
                                    })
                                }}
                            </h1>
                        </div>
                        <div class="flex flex-row items-center gap-1">
                            <app-lang-picker />
                            <app-icon-button
                                icon="close"
                                iconSize="md"
                                [tooltip]="t({ en: 'Close', fr: 'Fermer' })"
                                (click)="explore.emit()"
                            />
                        </div>
                    </div>

                    <p class="mt-3 text-body-sm text-text-body/90">
                        @if (lang() === "fr") {
                            Shoreline Explorer retrace le
                            <b>recul du trait de côte</b> sur le littoral de
                            France métropolitaine, pour comprendre l'influence
                            du temps et du changement climatique.
                        } @else {
                            Shoreline Explorer traces the
                            <b>retreat of the coastline</b> along the shores of
                            metropolitan France, to help understand the
                            influence of time and climate change.
                        }
                    </p>

                    <div class="mt-4 flex flex-col gap-3 overflow-auto">
                        <div class="flex flex-row gap-3">
                            <app-icon
                                icon="target"
                                size="md"
                                class="text-text-primary shrink-0 mt-0.5"
                            />
                            <div>
                                <h2 class="text-body-sm font-semibold">
                                    {{
                                        t({
                                            en: "A demonstrator of the Horizon engine",
                                            fr: "Un démonstrateur du moteur Horizon",
                                        })
                                    }}
                                </h2>
                                <p
                                    class="text-body-xs text-text-body/90 mt-0.5"
                                >
                                    @if (lang() === "fr") {
                                        Cette application est un démonstrateur
                                        de
                                        <a
                                            [href]="links.horizon"
                                            target="_blank"
                                            rel="noopener"
                                            class="underline"
                                            >Horizon</a
                                        >, le moteur 3D géospatial open source
                                        de Siradel, issu de l'écosystème
                                        <a
                                            [href]="links.sce"
                                            target="_blank"
                                            rel="noopener"
                                            class="underline"
                                            >SCE</a
                                        >.
                                    } @else {
                                        This application is a demonstrator of
                                        <a
                                            [href]="links.horizon"
                                            target="_blank"
                                            rel="noopener"
                                            class="underline"
                                            >Horizon</a
                                        >, Siradel's open source geospatial 3D
                                        engine, born from the
                                        <a
                                            [href]="links.sce"
                                            target="_blank"
                                            rel="noopener"
                                            class="underline"
                                            >SCE</a
                                        >
                                        ecosystem.
                                    }
                                </p>
                            </div>
                        </div>
                        <div class="flex flex-row gap-3">
                            <app-icon
                                icon="bulb"
                                size="md"
                                class="text-text-primary shrink-0 mt-0.5"
                            />
                            <div>
                                <h2 class="text-body-sm font-semibold">
                                    {{
                                        t({
                                            en: "Inspired by the Cerema study",
                                            fr: "Inspiré de l'étude du Cerema",
                                        })
                                    }}
                                </h2>
                                <p
                                    class="text-body-xs text-text-body/90 mt-0.5"
                                >
                                    @if (lang() === "fr") {
                                        Le cadre s'inspire de l'étude du Cerema
                                        de 2024
                                        <a
                                            [href]="links.ceremaStudy"
                                            target="_blank"
                                            rel="noopener"
                                            class="underline"
                                            >« Projection du trait de côte et
                                            analyse des enjeux au niveau
                                            national, horizons 2050 et 2100 »</a
                                        >
                                        et de ses trois aléas : recul chronique,
                                        recul événementiel et submersion marine.
                                        Toutes les données sont ouvertes
                                        (Cerema, GéoLittoral, IGN, INSEE…),
                                        sourcées dans chaque panneau et dans les
                                        Attributions.
                                    } @else {
                                        The framework draws on the 2024 Cerema
                                        study
                                        <a
                                            [href]="links.ceremaStudy"
                                            target="_blank"
                                            rel="noopener"
                                            class="underline"
                                            >"Coastline projection and national
                                            analysis of assets at stake, 2050
                                            and 2100 horizons"</a
                                        >
                                        and its three hazards: chronic retreat,
                                        event-driven retreat and marine
                                        flooding. All data is open (Cerema,
                                        GéoLittoral, IGN, INSEE…), credited in
                                        each panel and in the Attributions.
                                    }
                                </p>
                            </div>
                        </div>
                        <div class="flex flex-row gap-3">
                            <app-icon
                                icon="alert"
                                size="md"
                                class="text-text-primary shrink-0 mt-0.5"
                            />
                            <div>
                                <h2 class="text-body-sm font-semibold">
                                    {{
                                        t({
                                            en: "An experiment",
                                            fr: "Une expérimentation",
                                        })
                                    }}
                                </h2>
                                <p
                                    class="text-body-xs text-text-body/90 mt-0.5"
                                >
                                    {{
                                        t({
                                            en: "This explorer remains an experiment: the data is reprocessed and may contain marginal errors.",
                                            fr: "Cet explorer reste une expérimentation : les données sont retraitées et peuvent contenir des erreurs à la marge.",
                                        })
                                    }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <ul
                        class="mt-5 pt-4 border-t border-border-default grid grid-cols-2 gap-x-4 gap-y-2 text-body-xs"
                    >
                        @for (l of footerLinks; track l.href) {
                            <li>
                                <a
                                    [href]="l.href"
                                    [attr.target]="l.external ? '_blank' : null"
                                    [attr.rel]="l.external ? 'noopener' : null"
                                    class="group flex flex-row items-center gap-2 text-text-body/90 hover:text-text-headings"
                                >
                                    <span
                                        class="w-5 h-5 shrink-0 flex items-center justify-center text-text-primary"
                                    >
                                        @if (l.icon === "pin") {
                                            <app-sce-pin class="h-5" />
                                        } @else {
                                            <app-icon
                                                [icon]="l.icon"
                                                size="sm"
                                            />
                                        }
                                    </span>
                                    <span class="flex flex-col leading-tight">
                                        @if (l.label) {
                                            <span
                                                class="font-semibold text-text-headings"
                                                >{{ t(l.label) }}</span
                                            >
                                        } @else {
                                            <app-siradel-logo
                                                class="h-3 my-0.5 text-text-headings"
                                            />
                                        }
                                        <span
                                            class="text-body-2xs group-hover:underline"
                                            >{{ l.text }}</span
                                        >
                                    </span>
                                </a>
                            </li>
                        }
                    </ul>

                    <div class="mt-5 flex flex-row justify-end gap-2">
                        <button app-text-button (click)="explore.emit()">
                            {{
                                t({
                                    en: "Explore freely",
                                    fr: "Explorer librement",
                                })
                            }}
                        </button>
                        <button
                            app-text-button
                            [active]="true"
                            class="flex flex-row items-center gap-2"
                            (click)="startTour.emit()"
                        >
                            <app-icon icon="route" size="sm" />
                            {{ t({ en: "Guided tour", fr: "Tour guidé" }) }}
                        </button>
                    </div>
                </app-window>
            </div>
        }
    `,
})
export class WelcomeWindow {
    readonly open = model(false);
    /** Dismiss without tour (also used by backdrop/close). */
    readonly explore = output<void>();
    /** Dismiss and launch the guided tour. */
    readonly startTour = output<void>();

    private readonly i18n = inject(I18n);
    protected readonly t = this.i18n.t;
    protected readonly lang = this.i18n.lang;
    protected readonly links = LINKS;

    protected readonly footerLinks: {
        icon: string;
        /** Omitted = the Siradel logotype stands in for the label. */
        label?: Text;
        text: string;
        href: string;
        external: boolean;
    }[] = [
        {
            icon: "box",
            label: { en: "Horizon 3D engine", fr: "Moteur 3D Horizon" },
            text: "horizon.oss.siradel.com",
            href: LINKS.horizon,
            external: true,
        },
        {
            icon: "pin",
            label: { en: "SCE ecosystem", fr: "Écosystème SCE" },
            text: "sce.oss.siradel.com",
            href: LINKS.sce,
            external: true,
        },
        {
            icon: "world",
            text: "www.siradel.com",
            href: LINKS.siradel,
            external: true,
        },
        {
            icon: "github",
            label: { en: "Source code", fr: "Code source" },
            text: "github.com/siradel-oss/dih-shoreline-explorer",
            href: LINKS.repo,
            external: true,
        },
        {
            icon: "mail",
            label: { en: "Contact", fr: "Contact" },
            text: LINKS.contactEmail,
            href: `mailto:${LINKS.contactEmail}`,
            external: false,
        },
    ];
}
