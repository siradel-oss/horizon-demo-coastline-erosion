import { Directive, input } from "@angular/core";

/**
 * Base chrome button styling, applied directly on a native <button> so that
 * caller classes and (click) work without wrapper indirection.
 *   <button app-button [active]="..." [tooltip]="...">…</button>
 * Visual look lives in the global `.ui-btn` class (index.css).
 */
@Directive({
    selector: "button[app-button]",
    host: {
        class: "ui-btn",
        "[class.active]": "active()",
        "[attr.title]": "tooltip() ?? null",
    },
})
export class Button {
    readonly active = input(false);
    readonly tooltip = input<string>();
}

/** Text/label variant: same look, with comfortable padding. */
@Directive({
    selector: "button[app-text-button]",
    host: {
        class: "ui-btn px-4 py-2",
        "[class.active]": "active()",
    },
})
export class TextButton {
    readonly active = input(false);
}
