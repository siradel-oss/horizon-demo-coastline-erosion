import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    model,
} from "@angular/core";
import { I18n, type Text } from "../i18n";

/**
 * Hazard ("aléa") shared by the symmetric impact tools. `tous` = all hazards at
 * once (union/overlay), offered per-tool via the `tous` input.
 */
export type Alea = "chronique" | "submersion" | "tous";

/** Base hazards, in rail order. Short labels for the segmented control. */
export const ALEAS: readonly { value: Alea; label: Text }[] = [
    { value: "chronique", label: { en: "Retreat", fr: "Recul" } },
    { value: "submersion", label: { en: "Flooding", fr: "Submersion" } },
] as const;

const TOUS: { value: Alea; label: Text } = {
    value: "tous",
    label: { en: "All", fr: "Tous" },
};

/**
 * Per-tool hazard selector (segmented control). Each impact tool (population
 * heatmap, notable sites…) carries its OWN selector so hazards are filtered
 * independently — no global mode (a global one would force the phenomenon
 * blocks to expose every tool). Set `tous` to add the "All" (overlay all)
 * option — only for tools that can render every hazard at once.
 */
@Component({
    selector: "app-alea-selector",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="seg">
            @for (a of options(); track a.value) {
                <button
                    class="segBtn"
                    [class.active]="value() === a.value"
                    (click)="value.set(a.value)"
                >
                    {{ t(a.label) }}
                </button>
            }
        </div>
    `,
    styles: [
        `
            .seg {
                display: inline-flex;
                border: 1px solid var(--color-border-default);
                border-radius: 0.5rem;
                overflow: hidden;
            }
            .segBtn {
                padding: 0.25rem 0.75rem;
                font-size: 0.8rem;
                color: var(--color-text-body);
                cursor: pointer;
                transition: background-color 0.15s;
            }
            .segBtn + .segBtn {
                border-left: 1px solid var(--color-border-default);
            }
            .segBtn:hover {
                background-color: color-mix(
                    in srgb,
                    var(--color-surface-primary) 10%,
                    transparent
                );
            }
            .segBtn.active {
                background-color: var(--color-surface-primary);
                color: rgb(255 255 255 / 1);
            }
        `,
    ],
})
export class AleaSelector {
    readonly value = model<Alea>("chronique");
    /** Append the "All" (overlay all hazards) option. */
    readonly tous = input(false);
    protected readonly t = inject(I18n).t;
    readonly options = computed(() => (this.tous() ? [TOUS, ...ALEAS] : ALEAS));
}
