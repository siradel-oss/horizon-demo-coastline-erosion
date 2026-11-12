import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { Button } from "./button";
import { Icon } from "./icon";

/**
 * Expanding thematic menu rail: an icon-only column that widens on hover to
 * reveal a section title and the item labels (labels are simply clipped by the
 * rail's `overflow-hidden` while collapsed). Children are <app-menu-button>.
 */
@Component({
    selector: "app-menu-section",
    changeDetection: ChangeDetectionStrategy.OnPush,
    // display:contents -> the sized inner <div> is the real flex item (the host
    // box would otherwise stretch every rail to the widest one).
    styles: [":host { display: contents; }"],
    template: `
        <div
            class="group/rail z-50 ui-surface rounded-xl p-2 flex flex-col gap-1 overflow-hidden
                   w-14 hover:w-60 transition-[width] duration-200 ease-out"
        >
            <!-- Section title: grows in from 0 height on hover, no collapsed gap. -->
            <div
                class="grid grid-rows-[0fr] group-hover/rail:grid-rows-[1fr]
                       opacity-0 group-hover/rail:opacity-100 transition-all duration-200"
            >
                <div class="overflow-hidden">
                    <div
                        class="px-2 pb-3 mt-3 text-body-2xs font-bold uppercase tracking-wide
                               text-text-lightest whitespace-nowrap"
                    >
                        {{ title() }}
                    </div>
                </div>
            </div>
            <ng-content />
        </div>
    `,
})
export class MenuSection {
    readonly title = input.required<string>();
}

/**
 * One row of a <app-menu-section>: a fixed-position icon plus a label revealed
 * when the rail expands. Click bubbles natively from the inner <button>, so
 * parents bind (click) on <app-menu-button> (like <app-icon-button>).
 */
@Component({
    selector: "app-menu-button",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Button, Icon],
    styles: [":host { display: contents; }"],
    template: `
        <button
            app-button
            class="w-full flex flex-row items-center gap-3 p-1"
            [active]="active()"
        >
            <span class="relative shrink-0">
                <app-icon [icon]="icon()" size="lg" />
                @if (badge()) {
                    <span
                        class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-accent ring-2 ring-[color:var(--ui-surface-bg)]"
                    ></span>
                }
            </span>
            <span class="whitespace-nowrap text-body-sm">{{ label() }}</span>
        </button>
    `,
})
export class MenuButton {
    readonly active = input(false);
    readonly icon = input.required<string>();
    readonly label = input.required<string>();
    /** Shows a small "layer active" dot (even when the panel is closed). */
    readonly badge = input(false);
}
