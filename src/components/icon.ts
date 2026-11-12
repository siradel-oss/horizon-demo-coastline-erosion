import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { ICONS } from "../icons";

export type IconSize = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<IconSize, number> = { sm: 18, md: 24, lg: 32, xl: 40 };

/**
 * Inline SVG icon, coloured via currentColor (clean and minimal, never emoji). Paths come from the static ICONS registry (tabler-style, MIT).
 */
@Component({
    selector: "app-icon",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <svg
            [attr.width]="px()"
            [attr.height]="px()"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            role="img"
            aria-hidden="true"
            [innerHTML]="body()"
        ></svg>
    `,
})
export class Icon {
    readonly icon = input.required<string>();
    readonly size = input<IconSize>("md");

    private readonly sanitizer = inject(DomSanitizer);

    readonly px = computed(() => SIZE_PX[this.size()]);
    readonly body = computed<SafeHtml>(() =>
        this.sanitizer.bypassSecurityTrustHtml(ICONS[this.icon()] ?? ""),
    );
}
