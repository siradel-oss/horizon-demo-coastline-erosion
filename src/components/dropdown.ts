import {
    ChangeDetectionStrategy,
    Component,
    input,
    model,
    signal,
} from "@angular/core";
import { Icon } from "./icon";

/**
 * Compact dropdown matching the bottom-right basemap controls (dark, opaque —
 * no glass). The menu is anchored to the right edge and opens upward, so it
 * never overflows the right side of the screen (controls sit bottom-right).
 */
@Component({
    selector: "app-dropdown",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Icon],
    template: `
        <div class="root" tabindex="-1" (focusout)="open.set(false)">
            <button
                type="button"
                class="trigger ui-surface"
                [title]="title() ?? ''"
                (click)="open.set(!open())"
            >
                <app-icon [icon]="icon()" size="md" class="leadIcon" />
                <span class="label">{{ options()[value()] }}</span>
                <app-icon
                    icon="arrow_down"
                    size="sm"
                    class="chevron"
                    [class.rot]="open()"
                />
            </button>
            @if (open()) {
                <ul
                    class="menu ui-surface"
                    [class.down]="openDown()"
                    (mousedown)="$event.preventDefault()"
                >
                    @for (opt of options(); track $index) {
                        <li>
                            <button
                                type="button"
                                class="item"
                                [class.active]="$index === value()"
                                (click)="select($index)"
                            >
                                {{ opt }}
                            </button>
                        </li>
                    }
                </ul>
            }
        </div>
    `,
    styles: [
        `
            .root {
                position: relative;
                pointer-events: auto;
            }
            .trigger {
                display: flex;
                align-items: center;
                gap: 0.375rem;
                min-height: 2.5rem;
                max-width: 14rem;
                padding: 0.375rem 0.625rem;
                border-radius: 0.5rem;
                color: var(--color-text-headings);
                font-size: 0.8125rem;
                cursor: pointer;
                transition: border-color 0.15s;
            }
            .trigger:hover {
                border-color: var(--color-border-primary);
            }
            .leadIcon {
                color: var(--color-text-body);
                flex-shrink: 0;
            }
            .label {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .chevron {
                color: var(--color-text-lightest);
                flex-shrink: 0;
                transition: transform 0.15s;
            }
            .chevron.rot {
                transform: rotate(180deg);
            }
            .menu {
                position: absolute;
                bottom: calc(100% + 0.375rem);
                right: 0;
            }
            /* Opens downward instead (for controls anchored near the top). */
            .menu.down {
                top: calc(100% + 0.375rem);
                bottom: auto;
                min-width: 100%;
                max-width: 16rem;
                max-height: 60vh;
                overflow-y: auto;
                list-style: none;
                margin: 0;
                padding: 0.25rem;
                border-radius: 0.5rem;
            }
            .item {
                width: 100%;
                text-align: left;
                white-space: nowrap;
                padding: 0.375rem 0.5rem;
                border-radius: 0.375rem;
                font-size: 0.75rem;
                color: var(--color-text-body);
                cursor: pointer;
                transition: background-color 0.12s;
            }
            .item:hover {
                background-color: color-mix(
                    in srgb,
                    var(--color-surface-primary) 12%,
                    transparent
                );
            }
            .item.active {
                background-color: var(--color-surface-primary);
                color: rgb(255 255 255 / 1);
            }
        `,
    ],
})
export class Dropdown {
    readonly icon = input.required<string>();
    readonly options = input.required<string[]>();
    readonly title = input<string>();
    /** Open the menu downward (default: upward, for bottom-anchored controls). */
    readonly openDown = input(false);
    readonly value = model.required<number>();
    readonly open = signal(false);

    select(i: number) {
        this.value.set(i);
        this.open.set(false);
    }
}
