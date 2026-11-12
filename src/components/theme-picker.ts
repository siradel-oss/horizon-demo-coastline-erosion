import {
    ChangeDetectionStrategy,
    Component,
    effect,
    inject,
    signal,
} from "@angular/core";
import { I18n } from "../i18n";
import { Button } from "./button";
import { Icon } from "./icon";

const DARK_KEY = "dih-shoreline-explorer:dark";

function readStoredDark(): boolean {
    const stored = localStorage.getItem(DARK_KEY);
    return stored === null ? true : stored === "true";
}

/**
 * Dark / light mode toggle (top-right utilities). Persists to localStorage
 * (default dark) and drives the `.dark` class on <html> (see index.css).
 */
@Component({
    selector: "app-theme-picker",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Button, Icon],
    template: `
        <button
            app-button
            class="p-1 flex"
            [attr.aria-label]="
                dark()
                    ? t({
                          en: 'Switch to light mode',
                          fr: 'Passer en mode clair',
                      })
                    : t({
                          en: 'Switch to dark mode',
                          fr: 'Passer en mode sombre',
                      })
            "
            [title]="
                dark()
                    ? t({ en: 'Light mode', fr: 'Mode clair' })
                    : t({ en: 'Dark mode', fr: 'Mode sombre' })
            "
            (click)="toggleDark()"
        >
            <app-icon [icon]="dark() ? 'sun' : 'moon'" size="lg" />
        </button>
    `,
})
export class ThemePicker {
    protected readonly t = inject(I18n).t;
    readonly dark = signal<boolean>(readStoredDark());

    constructor() {
        effect(() => {
            const isDark = this.dark();
            document.documentElement.classList.toggle("dark", isDark);
            localStorage.setItem(DARK_KEY, String(isDark));
        });
    }

    toggleDark() {
        this.dark.update((d) => !d);
    }
}
