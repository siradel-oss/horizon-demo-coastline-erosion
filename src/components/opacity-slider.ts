import {
    ChangeDetectionStrategy,
    Component,
    inject,
    input,
    model,
} from "@angular/core";
import { I18n } from "../i18n";

/**
 * Reusable opacity slider. Emits the new value on release
 * (`change`, not `input`) to avoid recreating a heavy layer at every step.
 * Bounds are configurable — keep `min` > 0 so it never fully disappears.
 */
@Component({
    selector: "app-opacity-slider",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div
            class="flex flex-row items-center justify-between text-body-2xs text-text-lightest mb-1"
        >
            <span>{{ label() ?? t({ en: "Opacity", fr: "Opacité" }) }}</span>
            <span>{{ percent() }}%</span>
        </div>
        <input
            type="range"
            class="w-full"
            [min]="min()"
            [max]="max()"
            [step]="step()"
            [value]="value()"
            (change)="onChange($event)"
        />
    `,
})
export class OpacitySlider {
    readonly value = model.required<number>();
    /** Optional label (already translated); defaults to "Opacity". */
    readonly label = input<string>();
    readonly min = input(0.15);
    readonly max = input(1);
    readonly step = input(0.05);

    protected readonly t = inject(I18n).t;

    readonly percent = () => Math.round(this.value() * 100);

    onChange(e: Event) {
        this.value.set(+(e.target as HTMLInputElement).value);
    }
}
