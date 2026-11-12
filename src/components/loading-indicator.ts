import { ChangeDetectionStrategy, Component } from "@angular/core";

/** Indeterminate progress bar shown while the engine is busy. */
@Component({
    selector: "app-loading-indicator",
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="ui-surface rounded">
            <div class="w-60 h-1 overflow-hidden relative">
                <div
                    class="absolute w-4 h-1 bg-surface-darkest rounded-sm animate-bounce-horizontal"
                ></div>
            </div>
        </div>
    `,
    styles: [
        `
            @keyframes bounce-horizontal {
                0%,
                100% {
                    transform: translateX(0);
                }
                50% {
                    transform: translateX(14rem);
                }
            }
            .animate-bounce-horizontal {
                animation: bounce-horizontal 1.5s ease-in-out infinite;
            }
        `,
    ],
})
export class LoadingIndicator {}
