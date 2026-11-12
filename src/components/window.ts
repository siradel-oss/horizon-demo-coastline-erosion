import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * Panel surface (dark, opaque — no glass). The host element IS the box, so
 * callers position/size it directly via classes:
 *   @if (open()) { <app-window side="left" class="absolute top-0 left-0 w-80 …"> … }
 * Visibility is owned by the parent (@if); a side-aware enter animation plays
 * on insertion.
 */
@Component({
    selector: "app-window",
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: "ui-surface block rounded-lg overflow-auto text-text-body win",
        "[class.win-left]": "side() === 'left'",
        "[class.win-right]": "side() === 'right'",
    },
    template: `<ng-content></ng-content>`,
    styles: [
        `
            :host {
                animation: win-fade 0.25s ease-out;
            }
            :host(.win-left) {
                animation-name: win-left;
            }
            :host(.win-right) {
                animation-name: win-right;
            }
            @keyframes win-fade {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }
            @keyframes win-left {
                from {
                    opacity: 0;
                    transform: translateX(-100%);
                }
                to {
                    opacity: 1;
                    transform: none;
                }
            }
            @keyframes win-right {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: none;
                }
            }
        `,
    ],
})
export class Window {
    readonly side = input<"left" | "right">("left");
}
