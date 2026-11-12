import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from "@angular/core";
import { I18n } from "../i18n";

/**
 * Normalized data-source notice shown at the bottom of feature panels.
 * Centralizes the boilerplate (sources + optional disclaimer + styling) so each
 * panel only declares its own sources. Inputs are already-resolved strings.
 *
 *   <app-attribution
 *       [sources]="['Cerema — erosion indicator', 'INSEE Filosofi 2019']"
 *       [note]="t({ en: 'Estimate', fr: 'Estimation' })" />
 *
 * Renders: "Sources: Cerema — erosion indicator · INSEE Filosofi 2019. Estimate."
 */
@Component({
    selector: "app-attribution",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<p class="mt-3 text-body-2xs text-text-lightest">
        {{ line() }}
    </p>`,
})
export class Attribution {
    /** Distinct sources of this panel (each "Producer — dataset"). */
    readonly sources = input.required<readonly string[]>();
    /** Optional short disclaimer (e.g. "Estimate"). */
    readonly note = input("");

    private readonly t = inject(I18n).t;

    readonly line = computed(() => {
        // French typography puts a space before the colon.
        const label = this.t({ en: "Sources:", fr: "Sources :" });
        const src = `${label} ${this.sources().join(" · ")}.`;
        const note = this.note();
        return note ? `${src} ${note}.` : src;
    });
}
