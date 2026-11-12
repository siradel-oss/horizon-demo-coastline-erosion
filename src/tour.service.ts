import {
    computed,
    DestroyRef,
    inject,
    Injectable,
    signal,
} from "@angular/core";
import { ScenarioStep, TOUR_SCENARIO } from "./scenarios";

/**
 * Guided-tour engine. Holds the tour state as signals and exposes manual
 * stepping (`next`/`prev`/`goTo`/`stop`) plus auto-play (`play`/`pause`/
 * `toggle`) with a timer — a kiosk-style mode: the tour advances on its own
 * and loops back to the first step after the last one.
 *
 * Deliberately engine-agnostic: it knows nothing about the camera or the
 * layers. App reacts to `current()` to fly the camera and open the panel, so
 * the tour logic stays decoupled from Horizon.
 */
@Injectable({ providedIn: "root" })
export class TourService {
    private readonly destroyRef = inject(DestroyRef);

    /** Ordered steps of the active scenario. */
    readonly steps: readonly ScenarioStep[] = TOUR_SCENARIO;
    readonly total = this.steps.length;

    /** Current step index; `-1` when the tour is not running. */
    private readonly _index = signal(-1);
    readonly index = this._index.asReadonly();

    readonly active = computed(() => this._index() >= 0);
    readonly current = computed<ScenarioStep | null>(() =>
        this.active() ? this.steps[this._index()] : null,
    );
    readonly isFirst = computed(() => this._index() <= 0);
    readonly isLast = computed(() => this._index() >= this.steps.length - 1);

    /** Auto-play state. */
    private readonly _playing = signal(false);
    readonly playing = this._playing.asReadonly();
    private timer: ReturnType<typeof setTimeout> | null = null;

    /** Playback speed multiplier (auto-play). Cycles 1× → 2× → 0.5×. */
    private static readonly SPEEDS = [1, 2, 0.5] as const;
    private readonly _speed = signal<number>(1);
    readonly speed = this._speed.asReadonly();

    constructor() {
        this.destroyRef.onDestroy(() => this.clearTimer());
    }

    /** Start (or restart) the tour at the first step. */
    start(): void {
        this.goTo(0);
    }

    goTo(i: number): void {
        if (i < 0 || i >= this.steps.length) return;
        this._index.set(i);
        if (this._playing()) this.scheduleNext();
    }

    next(): void {
        // Loops back to the start on the last step (kiosk attract loop).
        this.goTo(this.isLast() ? 0 : this._index() + 1);
    }

    prev(): void {
        if (this.isFirst()) return;
        this.goTo(this._index() - 1);
    }

    /** Stop the tour entirely (leaves auto-play off). */
    stop(): void {
        this.pause();
        this._index.set(-1);
    }

    /** Begin auto-advancing (starts the tour if idle). */
    play(): void {
        if (!this.active()) this._index.set(0);
        this._playing.set(true);
        this.scheduleNext();
    }

    /** Toggle auto-play on/off. */
    toggle(): void {
        if (this._playing()) this.pause();
        else this.play();
    }

    /** Cycle the playback speed (1× → 2× → 0.5×) and re-arm the timer if playing. */
    cycleSpeed(): void {
        const speeds = TourService.SPEEDS;
        const next =
            speeds[(speeds.indexOf(this._speed() as 1) + 1) % speeds.length];
        this._speed.set(next);
        if (this._playing()) this.scheduleNext();
    }

    /** Halt auto-advancing but keep the current step visible. */
    pause(): void {
        this._playing.set(false);
        this.clearTimer();
    }

    /** Arm the timer to advance after the current step's duration. */
    private scheduleNext(): void {
        this.clearTimer();
        const step = this.current();
        if (!step) return;
        this.timer = setTimeout(
            () => {
                // Loop back to the start after the last step (kiosk attract loop).
                this.goTo(this.isLast() ? 0 : this._index() + 1);
            },
            (step.duration * 1000) / this._speed(),
        );
    }

    private clearTimer(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}
