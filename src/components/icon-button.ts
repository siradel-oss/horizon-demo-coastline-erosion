import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { Button } from "./button";
import { Icon, IconSize } from "./icon";

/**
 * Icon-only chrome button. Click bubbles natively from the inner <button>, so
 * parents bind (click) on <app-icon-button>. Callers pass icon/tooltip/active
 * only (no layout classes), so no class-forwarding needed.
 */
@Component({
    selector: "app-icon-button",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Button, Icon],
    template: `
        <button
            app-button
            class="p-1 flex"
            [active]="active()"
            [tooltip]="tooltip()"
        >
            <app-icon [icon]="icon()" [size]="iconSize()" />
        </button>
    `,
})
export class IconButton {
    readonly active = input(false);
    readonly icon = input.required<string>();
    readonly iconSize = input<IconSize>("lg");
    readonly tooltip = input<string>();
}
