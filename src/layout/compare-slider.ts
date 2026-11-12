import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Icon } from "../components/icon";
import { Dropdown } from "../components/dropdown";
import { CompareService } from "../compare.service";
import { I18n } from "../i18n";

/**
 * Full-frame comparison overlay (ortho multiview): a draggable vertical divider
 * plus one ortho selector per view, flanking the split at the bottom (left view
 * → left of the divider, right view → right of it). Purely a view over
 * {@link CompareService}; BasemapControls reacts to its signals to drive the
 * Horizon scene/layers. Shown only while comparison is active.
 */
@Component({
    selector: "app-compare-slider",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Icon, Dropdown],
    template: `
        @if (compare.active()) {
            <div class="fixed inset-0 z-[300] pointer-events-none">
                <!-- Vertical split line, centered on the position. -->
                <div
                    class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)]"
                    [style.left.%]="compare.position() * 100"
                ></div>

                <!-- Drag handle — dark surface + white arrows, like the
                     other floating toggles. -->
                <button
                    type="button"
                    class="ui-surface text-text-headings
                           absolute top-1/2 -translate-x-1/2 -translate-y-1/2
                           flex flex-row items-center justify-center
                           w-11 h-11 rounded-full shadow-lg cursor-ew-resize
                           pointer-events-auto touch-none
                           focus-visible:outline focus-visible:outline-2"
                    [style.left.%]="compare.position() * 100"
                    role="separator"
                    aria-orientation="vertical"
                    [attr.aria-label]="
                        t({
                            en: 'Move the comparison divider',
                            fr: 'Déplacer le comparateur',
                        })
                    "
                    tabindex="0"
                    (pointerdown)="onDown($event)"
                    (pointermove)="onMove($event)"
                    (pointerup)="onUp($event)"
                    (keydown)="onKey($event)"
                >
                    <app-icon icon="arrow_left" size="md" class="-mr-1.5" />
                    <app-icon icon="arrow_right" size="md" class="-ml-1.5" />
                </button>

                <!-- Left-view ortho selector (ends just left of the divider). -->
                <div
                    class="absolute top-4 pointer-events-auto"
                    [style.right]="
                        'calc(' +
                        (100 - compare.position() * 100) +
                        '% + 0.75rem)'
                    "
                >
                    <app-dropdown
                        icon="arrow_left"
                        [title]="
                            t({
                                en: 'Orthophoto — left view',
                                fr: 'Orthophoto — vue de gauche',
                            })
                        "
                        [openDown]="true"
                        [options]="compare.orthoLabels()"
                        [value]="compare.leftIndex()"
                        (valueChange)="compare.leftIndex.set($event)"
                    />
                </div>

                <!-- Right-view ortho selector (starts just right of the divider). -->
                <div
                    class="absolute top-4 pointer-events-auto"
                    [style.left]="
                        'calc(' + compare.position() * 100 + '% + 0.75rem)'
                    "
                >
                    <app-dropdown
                        icon="arrow_right"
                        [title]="
                            t({
                                en: 'Orthophoto — right view',
                                fr: 'Orthophoto — vue de droite',
                            })
                        "
                        [openDown]="true"
                        [options]="compare.orthoLabels()"
                        [value]="compare.rightIndex()"
                        (valueChange)="compare.rightIndex.set($event)"
                    />
                </div>
            </div>
        }
    `,
})
export class CompareSlider {
    protected readonly compare = inject(CompareService);
    protected readonly t = inject(I18n).t;
    private dragging = false;

    onDown(e: PointerEvent) {
        this.dragging = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
    }

    onMove(e: PointerEvent) {
        if (!this.dragging) return;
        this.compare.setPosition(e.clientX / window.innerWidth);
    }

    onUp(e: PointerEvent) {
        this.dragging = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }

    onKey(e: KeyboardEvent) {
        const step = 0.02;
        if (e.key === "ArrowLeft") {
            this.compare.setPosition(this.compare.position() - step);
            e.preventDefault();
        } else if (e.key === "ArrowRight") {
            this.compare.setPosition(this.compare.position() + step);
            e.preventDefault();
        }
    }
}
