import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    output,
    signal,
} from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { HorizonService } from "../horizon.service";
import { I18n } from "../i18n";

/**
 * Permanent, discreet map credit line (bottom corner) — cartographic convention.
 * Fed by the Horizon attribution feed (SetAttributionEnabled + AttributionsMessage),
 * so it lists ONLY the sources of the layers actually on screen (a hidden layer is not credited). Producer credits carry no licence
 * (see the layer `*_ATTRIBUTION` constants) — the exhaustive sources & licences
 * live in the "Attributions" panel, which a click opens. Single line, truncated;
 * full text on hover.
 */
@Component({
    selector: "app-map-attribution",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button class="credit" [title]="full()" (click)="open.emit()">
            {{ text() }}
        </button>
    `,
    styles: [
        `
            .credit {
                max-width: 55vw;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 0.75rem;
                line-height: 1.2;
                color: var(--color-text-lightest);
                background-color: color-mix(
                    in srgb,
                    var(--color-surface-page) 65%,
                    transparent
                );
                padding: 0.15rem 0.5rem;
                border-radius: 0.25rem;
                pointer-events: auto;
                cursor: pointer;
            }
            .credit:hover {
                text-decoration: underline;
            }
        `,
    ],
})
export class MapAttribution {
    /** Emitted on click — the host opens the full Attributions panel. */
    readonly open = output<void>();

    private readonly t = inject(I18n).t;

    /** Distinct source credits of the currently visible layers (no licence). */
    private readonly items = signal<string[]>([]);

    /** Single-line credit; falls back to the always-present basemap producer. */
    readonly text = computed(() => {
        const it = this.items();
        const sources = it.length ? it.join(" · ") : "IGN — Géoplateforme";
        return `${this.t({ en: "Sources:", fr: "Sources :" })} ${sources}`;
    });
    /** Full multi-line text shown on hover (native title). */
    readonly full = computed(() =>
        [
            ...this.items(),
            this.t({
                en: "Click for details of sources and licenses",
                fr: "Cliquer pour le détail des sources et licences",
            }),
        ].join("\n"),
    );

    private readonly horizonService = inject(HorizonService);
    private api: HrzApi.AsyncApi | null = null;

    constructor() {
        this.horizonService.onApiReady((a) => (this.api = a));

        this.horizonService.onMessage("viewerReady", () =>
            this.api?.ViewerService.setAttributionEnabled({ value: true }),
        );

        this.horizonService.onMessage("attributions", (message) => {
            const msg = (message as HrzProtocol.ITypedMessage).attributions as
                HrzProtocol.IAttributionsMessage | undefined;
            if (!msg) return;
            const texts = (msg.attributions ?? [])
                .map((a) => a.text)
                .filter((t): t is string => !!t);
            // Several visible layers can share a producer -> dedupe.
            this.items.set([...new Set(texts)]);
        });
    }
}
