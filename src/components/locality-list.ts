import {
    ChangeDetectionStrategy,
    Component,
    inject,
    input,
    output,
} from "@angular/core";
import { I18n } from "../i18n";
import { Icon } from "./icon";
import { TextButton } from "./button";

/** One clickable locality: a named place, an optional detail line and metric. */
export interface Locality {
    name: string;
    /** Secondary line (context, secondary figure…). */
    detail?: string;
    /** Right-aligned headline figure, pre-formatted (e.g. "5.3 m/yr", "169,160"). */
    metric?: string;
    lon: number;
    lat: number;
}

/**
 * Shared "list of localities" used by the notable-sites panel (erosion sites /
 * flooding sectors): one clickable row per place, with an optional metric — so
 * both hazards expose the SAME elements (only their notice differs) and let the
 * user jump to the most-affected zones. Rows stay ordered
 * by the caller (most-affected first); the metric column carries the ranking.
 */
@Component({
    selector: "app-locality-list",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Icon, TextButton],
    template: `
        @if (items().length) {
            <div class="flex flex-col gap-2">
                @for (it of items(); track it.name) {
                    <button
                        app-text-button
                        class="w-full text-left flex flex-row items-center gap-3"
                        (click)="select.emit(it)"
                    >
                        <app-icon [icon]="icon()" />
                        <span class="grow text-body-2xs">
                            {{ it.name }}
                            @if (it.detail) {
                                <span class="block text-text-lightest">{{
                                    it.detail
                                }}</span>
                            }
                        </span>
                        @if (it.metric) {
                            <span
                                class="shrink-0 text-body-sm font-semibold tabular-nums"
                                >{{ it.metric }}</span
                            >
                        }
                    </button>
                }
            </div>
        } @else {
            <p class="text-body-2xs text-text-lightest">
                {{
                    empty() ??
                        t({
                            en: "List unavailable for now.",
                            fr: "Liste indisponible pour le moment.",
                        })
                }}
            </p>
        }
    `,
})
export class LocalityList {
    readonly items = input.required<Locality[]>();
    readonly icon = input("location_on");
    /** Empty-state message (already translated); a generic one by default. */
    readonly empty = input<string>();
    readonly select = output<Locality>();
    protected readonly t = inject(I18n).t;
}
