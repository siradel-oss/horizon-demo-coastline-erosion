import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * SCE ecosystem pin (the marker used on the Horizon and SCE websites), inlined
 * so it follows `currentColor`. The viewBox is cropped to the drawing. Size it
 * from the host (e.g. `class="h-6"`).
 */
@Component({
    selector: "app-sce-pin",
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: "inline-flex", role: "img", "aria-label": "SCE" },
    template: `
        <svg
            viewBox="0 11 18 20.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
            class="h-full w-auto"
        >
            <path d="M1.43751 23.6492L8.86063 30.3798L16.2846 23.5033" />
            <path
                d="M16.7211 19.8608C16.7211 15.5194 13.2018 12 8.86055 12C4.51929 12 1 15.5194 1 19.8608"
            />
            <path
                d="M8.85954 17.6962C10.2367 17.6962 11.3537 18.813 11.3537 20.1903C11.3534 21.5673 10.2365 22.6835 8.85954 22.6835C7.48275 22.6832 6.36663 21.5672 6.36638 20.1903C6.36638 18.8132 7.48259 17.6964 8.85954 17.6962Z"
            />
        </svg>
    `,
})
export class ScePin {}
