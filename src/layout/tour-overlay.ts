import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { I18n } from "../i18n";
import { Icon } from "../components/icon";
import { IconButton } from "../components/icon-button";
import { TextButton } from "../components/button";
import { TourService } from "../tour.service";

/**
 * Guided-tour narration overlay. Shows the current step's title and short
 * narration with previous / next / close controls. Bottom-centered,
 * above the map chrome. Purely a view over `TourService` state; the camera
 * flight and panel opening are driven by App reacting to `tour.current()`.
 */
@Component({
    selector: "app-tour-overlay",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Icon, IconButton, TextButton],
    template: `
        @if (tour.current(); as step) {
            <div
                class="tour-card fixed bottom-8 left-1/2 -translate-x-1/2 z-[400] w-[92vw] max-w-[40rem] p-5 rounded-xl ui-surface shadow-2xl text-text-body pointer-events-auto"
                role="dialog"
                [attr.aria-label]="t({ en: 'Guided tour', fr: 'Tour guidé' })"
            >
                <div class="flex flex-row items-center gap-2">
                    <app-icon
                        icon="route"
                        size="md"
                        class="text-text-primary shrink-0"
                    />
                    <h2 class="grow text-body-md font-semibold">
                        {{ t(step.title) }}
                    </h2>
                    <span class="text-body-xs text-text-lightest shrink-0">
                        {{ tour.index() + 1 }} / {{ tour.total }}
                    </span>
                    <app-icon-button
                        icon="close"
                        iconSize="sm"
                        [tooltip]="
                            t({ en: 'Close the tour', fr: 'Fermer le tour' })
                        "
                        (click)="tour.stop()"
                    />
                </div>

                <p class="mt-2 text-body-sm text-text-body/90 leading-relaxed">
                    {{ t(step.narration) }}
                </p>

                <div class="mt-3 flex flex-row items-center justify-between">
                    <button
                        app-text-button
                        class="flex flex-row items-center gap-1.5"
                        [disabled]="tour.isFirst()"
                        [class.opacity-40]="tour.isFirst()"
                        [class.pointer-events-none]="tour.isFirst()"
                        (click)="tour.prev()"
                    >
                        <app-icon icon="arrow_left" size="sm" />
                        {{ t({ en: "Previous", fr: "Précédent" }) }}
                    </button>

                    <!-- Auto-play / pause (loops) + speed cycle. -->
                    <div class="flex flex-row items-center gap-1">
                        <app-icon-button
                            [icon]="tour.playing() ? 'pause' : 'play'"
                            iconSize="sm"
                            [tooltip]="
                                tour.playing()
                                    ? t({ en: 'Pause', fr: 'Mettre en pause' })
                                    : t({
                                          en: 'Auto-play (kiosk mode)',
                                          fr: 'Lecture automatique (mode salon)',
                                      })
                            "
                            (click)="tour.toggle()"
                        />
                        <button
                            app-text-button
                            class="tabular-nums"
                            [active]="tour.speed() !== 1"
                            [title]="
                                t({
                                    en: 'Playback speed',
                                    fr: 'Vitesse de lecture',
                                })
                            "
                            (click)="tour.cycleSpeed()"
                        >
                            {{ tour.speed() }}×
                        </button>
                    </div>

                    @if (tour.isLast() && !tour.playing()) {
                        <button
                            app-text-button
                            [active]="true"
                            (click)="tour.stop()"
                        >
                            {{ t({ en: "Finish", fr: "Terminer" }) }}
                        </button>
                    } @else {
                        <button
                            app-text-button
                            [active]="true"
                            class="flex flex-row items-center gap-1.5"
                            (click)="tour.next()"
                        >
                            {{ t({ en: "Next", fr: "Suivant" }) }}
                            <app-icon icon="arrow_right" size="sm" />
                        </button>
                    }
                </div>
            </div>
        }
    `,
})
export class TourOverlay {
    protected readonly tour = inject(TourService);
    protected readonly t = inject(I18n).t;
}
