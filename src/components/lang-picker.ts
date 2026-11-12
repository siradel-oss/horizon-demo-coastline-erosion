import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Button } from "./button";
import { I18n } from "../i18n";

/**
 * English / French toggle (top-right utilities). Shows the language it
 * switches TO, so the label always reads as an action.
 */
@Component({
    selector: "app-lang-picker",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Button],
    template: `
        <button
            app-button
            class="px-1.5 py-1 flex text-body-xs font-bold tracking-wide"
            [attr.lang]="next()"
            [attr.aria-label]="
                t({ en: 'Passer en français', fr: 'Switch to English' })
            "
            [title]="t({ en: 'Français', fr: 'English' })"
            (click)="i18n.setLang(next())"
        >
            {{ next().toUpperCase() }}
        </button>
    `,
})
export class LangPicker {
    protected readonly i18n = inject(I18n);
    protected readonly t = this.i18n.t;
    protected readonly next = () => (this.i18n.lang() === "fr" ? "en" : "fr");
}
