import { Injectable, signal } from "@angular/core";

/**
 * Minimal runtime i18n (English / French).
 *
 * Translations live next to the code that displays them, as `Text` pairs
 * (`{ en, fr }`), instead of a central key catalogue: a component reads
 * `t({ en: "Close", fr: "Fermer" })`. Because `t()` reads the `lang` signal,
 * templates and computed signals re-render when the language changes.
 *
 * Non-component modules (layer catalogues, tour steps…) export `Text` values
 * and let the displaying component resolve them with `t()`.
 */

export type Lang = "en" | "fr";

/** A user-facing string in every supported language. */
export type Text = Record<Lang, string>;

export const LANGS: readonly Lang[] = ["en", "fr"];

const LANG_KEY = "dih-shoreline-explorer:lang";

/** BCP 47 locale used for number and date formatting. */
const LOCALES: Record<Lang, string> = { en: "en-GB", fr: "fr-FR" };

function initialLang(): Lang {
    try {
        const stored = localStorage.getItem(LANG_KEY);
        if (stored === "en" || stored === "fr") return stored;
    } catch {
        // Storage unavailable (private mode…): fall back to the browser.
    }
    return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

@Injectable({ providedIn: "root" })
export class I18n {
    readonly lang = signal<Lang>(initialLang());

    constructor() {
        document.documentElement.lang = this.lang();
    }

    /** Resolves a `Text` in the current language (reactive). */
    readonly t = (text: Text): string => text[this.lang()];

    /** Locale of the current language, for `toLocaleString()` & co (reactive). */
    readonly locale = (): string => LOCALES[this.lang()];

    /** Formats a number in the current locale (reactive). */
    readonly num = (
        value: number,
        options?: Intl.NumberFormatOptions,
    ): string => value.toLocaleString(this.locale(), options);

    setLang(lang: Lang) {
        this.lang.set(lang);
        document.documentElement.lang = lang;
        try {
            localStorage.setItem(LANG_KEY, lang);
        } catch {
            // Not persisted: the choice still applies to this session.
        }
    }
}
