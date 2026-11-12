import { computed, inject, Injectable, signal } from "@angular/core";
import { I18n } from "./i18n";
import { ORTHO_TIME_LAYERS } from "./layers";

/** Divider stays within these bounds so a sliver of each view is always shown. */
const MIN_POS = 0.02;
const MAX_POS = 0.98;

/**
 * Ortho-comparison (multiview) UI state — shared between the basemap controls
 * (which drive the Horizon scene/layers) and the full-frame CompareSlider
 * overlay (which hosts the divider AND the per-view ortho selectors, flanking
 * the split at the bottom). Holds only UI state (on/off, split position, and the
 * chosen ortho index per view); the Horizon wiring reacts to these signals in
 * BasemapControls.
 */
@Injectable({ providedIn: "root" })
export class CompareService {
    private readonly t = inject(I18n).t;

    /** Ortho date labels in the current language (shared with the single-view selector). */
    readonly orthoLabels = computed(() =>
        ORTHO_TIME_LAYERS.map((s) => this.t(s.label)),
    );

    private readonly _active = signal(false);
    readonly active = this._active.asReadonly();

    /** Vertical split position, 0 (far left) → 1 (far right). */
    private readonly _position = signal(0.5);
    readonly position = this._position.asReadonly();

    /** Chosen ortho per view (index into ORTHO_TIME_LAYERS). Both start on the
     *  most recent; `setActive(true)` re-applies this baseline each time. */
    readonly leftIndex = signal(ORTHO_TIME_LAYERS.length - 1);
    readonly rightIndex = signal(ORTHO_TIME_LAYERS.length - 1);

    setActive(v: boolean): void {
        // Entering comparison: start both views on the most recent ortho, so the
        // user picks what to compare against from a common, current baseline.
        if (v) {
            const recent = ORTHO_TIME_LAYERS.length - 1;
            this.leftIndex.set(recent);
            this.rightIndex.set(recent);
        }
        this._active.set(v);
    }

    setPosition(p: number): void {
        this._position.set(Math.min(MAX_POS, Math.max(MIN_POS, p)));
    }
}
