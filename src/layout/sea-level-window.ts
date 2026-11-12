import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    effect,
    inject,
    model,
    signal,
    untracked,
} from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { IconButton } from "../components/icon-button";
import { TextButton } from "../components/button";
import { Window } from "../components/window";
import { Icon } from "../components/icon";
import { HorizonService } from "../horizon.service";
import { PanelActivityService } from "../panel-activity.service";
import { I18n } from "../i18n";
import {
    addSeaLevelPlane,
    updateSeaLevelPlane,
    SeaLevelOrigin,
} from "../layers";

/** Default plane origin if the camera target can't be read (Aquitaine coast). */
const DEFAULT_ORIGIN: SeaLevelOrigin = { latitude: 45.0, longitude: -1.2 };

/**
 * Sea level panel: a height slider drives a horizontal Horizon clipping plane,
 * shown as a translucent grid over the terrain; where it cuts the relief it
 * traces the waterline. Real-time, no precomputed data. See
 * layers/sea-level.ts for the assumed limits.
 */
@Component({
    selector: "app-sea-level-window",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Window, IconButton, TextButton, Icon],
    template: `
        @if (open()) {
            <app-window
                side="left"
                class="absolute top-0 left-0 w-80 max-h-[calc(100vh-6rem)] p-lg"
            >
                <div class="flex flex-row items-center mb-lg">
                    <h1 class="grow text-xl font-semibold">
                        {{ t({ en: "Sea level", fr: "Niveau marin" }) }}
                    </h1>
                    <app-icon-button
                        icon="close"
                        iconSize="md"
                        [tooltip]="t({ en: 'Close', fr: 'Fermer' })"
                        (click)="open.set(false)"
                    />
                </div>
                <p class="mt-2 text-body-md text-text-body/90">
                    @if (lang() === "fr") {
                        Simulation d'un <b>niveau d'eau</b> : un plan horizontal
                        translucide à hauteur réglable. Superposé au
                        <b>relief</b>
                        (activez-le via les contrôles de fond de carte), il
                        matérialise la ligne d'eau là où il recoupe le terrain.
                    } @else {
                        Simulates a <b>water level</b>: a translucent horizontal
                        plane at an adjustable height. Overlaid on the
                        <b>relief</b> (turn it on from the basemap controls), it
                        draws the waterline where it cuts through the terrain.
                    }
                </p>

                <button
                    app-text-button
                    class="w-full text-left flex flex-row items-center gap-4 mt-3"
                    [active]="active()"
                    (click)="active.set(!active())"
                >
                    <app-icon
                        [icon]="active() ? 'visibility' : 'visibility_off'"
                    />
                    {{
                        t({
                            en: "Enable sea level",
                            fr: "Activer le niveau marin",
                        })
                    }}
                </button>

                @if (active()) {
                    <div class="mt-4">
                        <div
                            class="flex flex-row items-center justify-between text-body-2xs text-text-lightest mb-1"
                        >
                            <span>{{
                                t({ en: "Water height", fr: "Hauteur d'eau" })
                            }}</span>
                            <span class="text-text-body"
                                >{{
                                    num(altitude(), {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })
                                }}
                                m</span
                            >
                        </div>
                        <input
                            type="range"
                            class="w-full"
                            min="0"
                            max="10"
                            step="0.25"
                            [attr.aria-label]="
                                t({ en: 'Water height', fr: 'Hauteur d\\'eau' })
                            "
                            [value]="altitude()"
                            (input)="onAltitude($event)"
                        />
                    </div>

                    <button
                        app-text-button
                        class="w-full text-left flex flex-row items-center gap-4 mt-3"
                        (click)="recenter()"
                    >
                        <app-icon icon="location_on" />
                        {{
                            t({
                                en: "Recenter the plane on the view",
                                fr: "Recentrer le plan sur la vue",
                            })
                        }}
                    </button>

                    <p class="mt-3 text-body-2xs text-text-lightest">
                        {{
                            t({
                                en: "Indicative: local horizontal plane (recenter it on the area you look at); the level only reads where the relief is on. No connectivity to the sea.",
                                fr: "Indicatif : plan horizontal local (à recentrer sur le secteur regardé) ; lecture du niveau visible seulement là où le relief est activé. Sans connectivité à la mer.",
                            })
                        }}
                    </p>
                }
            </app-window>
        }
    `,
})
export class SeaLevelWindow {
    protected readonly t = inject(I18n).t;
    protected readonly lang = inject(I18n).lang;
    protected readonly num = inject(I18n).num;
    readonly open = model(false);
    readonly active = signal(false);
    readonly altitude = signal(1);

    private readonly horizonService = inject(HorizonService);
    private readonly panelActivity = inject(PanelActivityService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly api = signal<HrzApi.AsyncApi | null>(null);

    private origin: SeaLevelOrigin = DEFAULT_ORIGIN;
    private plane: HrzProtocol.LayerHandle | null = null;

    constructor() {
        this.horizonService.onApiReady((a) => this.api.set(a));

        // Create / destroy the plane on activation.
        effect(() => {
            const a = this.api();
            const on = this.active();
            if (!a) return;
            untracked(() => void this.reconcile(a, on));
        });

        // Height slider → move the plane.
        effect(() => {
            const a = this.api();
            const alt = this.altitude();
            if (!a || !this.plane) return;
            untracked(() =>
                updateSeaLevelPlane(a, this.plane!, this.origin, alt),
            );
        });

        // Report layer activity to the rail (badge).
        effect(() => this.panelActivity.setActive("seaLevel", this.active()));

        this.destroyRef.onDestroy(() => {
            const a = this.api();
            if (a) this.deactivate(a);
        });
    }

    onAltitude(e: Event) {
        this.altitude.set((e.target as HTMLInputElement).valueAsNumber);
    }

    /** Reads the camera target and recenters the plane there (flat-plane fix). */
    async recenter() {
        const a = this.api();
        if (!a || !this.plane) return;
        await this.readCameraOrigin(a);
        updateSeaLevelPlane(a, this.plane, this.origin, this.altitude());
    }

    private async reconcile(api: HrzApi.AsyncApi, on: boolean) {
        if (on && !this.plane) {
            await this.readCameraOrigin(api);
            this.plane = await addSeaLevelPlane(
                api,
                this.origin,
                this.altitude(),
            );
        } else if (!on && this.plane) {
            this.deactivate(api);
        }
    }

    private deactivate(api: HrzApi.AsyncApi) {
        if (this.plane) api.LayerService.destroyLayer(this.plane);
        this.plane = null;
    }

    private async readCameraOrigin(api: HrzApi.AsyncApi) {
        try {
            const vp = await api.CameraService.getCameraAngularViewpoint({
                camera: HrzProtocol.CameraIndex.CAMERA_0,
            });
            const t = vp.target;
            if (t?.latitude != null && t?.longitude != null) {
                this.origin = { latitude: t.latitude, longitude: t.longitude };
            }
        } catch {
            // Keep the previous / default origin.
        }
    }
}
