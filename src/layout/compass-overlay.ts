import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
} from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { HorizonService } from "../horizon.service";
import { Icon } from "../components/icon";
import { assetUrl } from "../layers/_shared";
import { I18n } from "../i18n";

// Per-click increments; the sign sets the direction of each move.
const ZOOM_IN_RATIO = 1.6; // > 1 = move closer (zoom in)
const ZOOM_OUT_RATIO = 1 / ZOOM_IN_RATIO;
const TILT_STEP = 0.18; // rad, relative delta (+ = toward the horizon)
const BEARING_STEP = 0.26; // rad, relative delta (+ = toward the right)

@Component({
    selector: "app-compass-overlay",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Icon],
    template: `
        <div class="flex flex-col items-end gap-2 pointer-events-none">
            <!-- Compass on the left, zoom block on the right; items-center
                 aligns the altitude with the centre of the compass. -->
            <div class="flex flex-row items-center gap-3">
                <!-- Control rose: compass in the centre, cardinal directions -->
                <div class="nav-rose relative w-32 h-32">
                    <button
                        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto rounded-full p-1.5 ui-surface cursor-pointer transition-colors"
                        [title]="
                            t({ en: 'Reset to north', fr: 'Remettre au nord' })
                        "
                        (click)="resetView(); $event.stopPropagation()"
                    >
                        <div
                            class="w-12 h-12 bg-surface-darkest mask-center mask-no-repeat mask-contain transition-transform"
                            [style.mask-image]="compassMask"
                            [style.-webkit-mask-image]="compassMask"
                            [style.transform]="compassTransform()"
                        ></div>
                    </button>

                    <button
                        class="cardBtn top-0 left-1/2 -translate-x-1/2"
                        [title]="
                            t({
                                en: 'Tilt toward the horizon',
                                fr: 'Incliner vers l\\'horizon',
                            })
                        "
                        (click)="tiltBy(TILT_STEP); $event.stopPropagation()"
                    >
                        <app-icon icon="arrow_up" size="md" />
                    </button>
                    <button
                        class="cardBtn bottom-0 left-1/2 -translate-x-1/2"
                        [title]="
                            t({
                                en: 'Top-down view',
                                fr: 'Vue verticale (zénithale)',
                            })
                        "
                        (click)="tiltBy(-TILT_STEP); $event.stopPropagation()"
                    >
                        <app-icon icon="arrow_down" size="md" />
                    </button>
                    <button
                        class="cardBtn left-0 top-1/2 -translate-y-1/2"
                        [title]="
                            t({ en: 'Rotate left', fr: 'Tourner à gauche' })
                        "
                        (click)="
                            rotateBy(-BEARING_STEP); $event.stopPropagation()
                        "
                    >
                        <app-icon icon="arrow_left" size="md" />
                    </button>
                    <button
                        class="cardBtn right-0 top-1/2 -translate-y-1/2"
                        [title]="
                            t({ en: 'Rotate right', fr: 'Tourner à droite' })
                        "
                        (click)="
                            rotateBy(BEARING_STEP); $event.stopPropagation()
                        "
                    >
                        <app-icon icon="arrow_right" size="md" />
                    </button>
                </div>

                <!-- Zoom group (+ / altitude / −), right of the compass -->
                <div
                    class="nav-zoom pointer-events-auto flex flex-col items-stretch ui-surface rounded-lg overflow-hidden"
                >
                    <button
                        class="navBtn"
                        [title]="t({ en: 'Zoom in', fr: 'Zoom avant' })"
                        (click)="zoom(ZOOM_IN_RATIO); $event.stopPropagation()"
                    >
                        <app-icon icon="zoom_in" size="md" />
                    </button>
                    <div class="h-px bg-border-default"></div>
                    <div class="altCell">{{ altitudeLabel() }}</div>
                    <div class="h-px bg-border-default"></div>
                    <button
                        class="navBtn"
                        [title]="t({ en: 'Zoom out', fr: 'Zoom arrière' })"
                        (click)="zoom(ZOOM_OUT_RATIO); $event.stopPropagation()"
                    >
                        <app-icon icon="zoom_out" size="md" />
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .navBtn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 2.5rem;
                color: var(--color-text-headings);
                cursor: pointer;
                transition: background-color 0.15s;
            }
            .altCell {
                padding: 0.25rem 0.5rem;
                text-align: center;
                font-family: ui-monospace, monospace;
                font-size: 0.7rem;
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
                color: var(--color-text-body);
            }
            .navBtn:hover {
                background-color: color-mix(
                    in srgb,
                    var(--color-surface-primary) 15%,
                    transparent
                );
            }
            .navBtn:active {
                background-color: color-mix(
                    in srgb,
                    var(--color-surface-primary) 25%,
                    transparent
                );
            }
            .cardBtn {
                position: absolute;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 2.25rem;
                height: 2.25rem;
                border-radius: 9999px;
                color: var(--color-text-headings);
                background-color: var(--ui-surface-bg);
                border: 1px solid var(--color-border-default);
                box-shadow: var(--ui-surface-shadow);
                cursor: pointer;
                pointer-events: auto;
                transition: background-color 0.15s;
            }
            .cardBtn:hover {
                background-color: var(--color-surface-primary);
            }
        `,
    ],
})
export class CompassOverlay {
    /** Base-relative mask URL so the compass icon resolves under the deploy subpath. */
    protected readonly compassMask = `url(${assetUrl("compass.svg")})`;

    protected readonly ZOOM_IN_RATIO = ZOOM_IN_RATIO;
    protected readonly ZOOM_OUT_RATIO = ZOOM_OUT_RATIO;
    protected readonly TILT_STEP = TILT_STEP;
    protected readonly BEARING_STEP = BEARING_STEP;

    private readonly horizonService = inject(HorizonService);
    private readonly i18n = inject(I18n);
    protected readonly t = this.i18n.t;
    private api: HrzApi.AsyncApi | null = null;

    private readonly heading = signal(0);
    private readonly tilt = signal(0);
    private readonly altitude = signal(0);

    readonly compassTransform = computed(() => {
        const squish = Math.pow(Math.cos(this.tilt()), 3) * 0.65;
        return `scaleY(${1 - squish}) rotate(${-this.heading()}rad)`;
    });

    readonly altitudeLabel = computed(() => {
        const alt = this.altitude();
        const num = this.i18n.num;
        if (alt >= 1_000_000)
            return `${num(alt / 1_000_000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mm`;
        if (alt >= 1_000) return `${num(Math.round(alt / 1_000))} km`;
        return `${num(Math.round(alt))} m`;
    });

    constructor() {
        this.horizonService.onApiReady((api) => {
            this.api = api;
            setInterval(async () => {
                if (!this.api) return;
                const cam = await this.api.CameraService.getCameraPose({
                    camera: HrzProtocol.CameraIndex.CAMERA_0,
                });
                this.heading.set(cam.bearing);
                this.tilt.set(cam.tilt);
                this.altitude.set(cam.position?.altitude ?? 0);
            }, 100);
        });
    }

    zoom(ratio: number) {
        this.api?.CameraService.move({
            cameraIndex: HrzProtocol.CameraIndex.CAMERA_0,
            zoom: { ratio },
        });
    }

    tiltBy(delta: number) {
        this.api?.CameraService.move({
            cameraIndex: HrzProtocol.CameraIndex.CAMERA_0,
            rotation: { tilt: delta },
        });
    }

    rotateBy(delta: number) {
        this.api?.CameraService.move({
            cameraIndex: HrzProtocol.CameraIndex.CAMERA_0,
            rotation: { bearing: delta },
        });
    }

    async resetView() {
        await this.api?.CameraService.resetNorth({
            resetTilt: true,
            cameraIndex: HrzProtocol.CameraIndex.CAMERA_0,
            animationOptions: {
                duration: 1,
                easingExponent: 2,
                easingFunction: HrzProtocol.EasingFunctions.EASE_INOUT,
                trajectoryType: HrzProtocol.TrajectoryType.BALLISTIC,
            },
        });
    }
}
