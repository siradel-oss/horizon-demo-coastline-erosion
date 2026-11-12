import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    signal,
    untracked,
} from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { HorizonService } from "../horizon.service";
import { TourService } from "../tour.service";
import { CompareService } from "../compare.service";
import { applyClarityLighting, applyTerrainLook } from "../lighting";
import { Icon } from "../components/icon";
import { Dropdown } from "../components/dropdown";
import { I18n, type Text } from "../i18n";
import {
    ORTHO_TIME_LAYERS,
    PLAN_IGN_LAYER,
    addWmtsImageryLayer,
    addIgnSrtmDtmLayer,
    addIgnRgeAltiDtmLayer,
    serveRgeDtmAsset,
    addBuildingsLayer,
} from "../layers";

type LayerFactory = (api: HrzApi.AsyncApi) => Promise<HrzProtocol.LayerHandle>;

// Relief / terrain — IGN sources only.
const TERRAINS: { label: string; factory: LayerFactory }[] = [
    { label: "IGN SRTM3", factory: addIgnSrtmDtmLayer },
    { label: "IGN RGE ALTI®", factory: addIgnRgeAltiDtmLayer },
];
const RGE_ALTI_INDEX = 1; // index of the high-res RGE ALTI® source in TERRAINS

@Component({
    selector: "app-basemap-controls",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Icon, Dropdown],
    template: `
        <div class="flex flex-col items-end gap-2 pointer-events-none">
            <!-- Basemap: Ortho / Plan / Comparison (3 states). When comparing,
                 the 2 ortho selectors live in the divider overlay (one per
                 view); in single view, the date selector shows below. -->
            <div class="flex flex-col items-end gap-2">
                <div
                    class="ui-surface flex flex-row gap-1 p-1 rounded-lg pointer-events-auto"
                >
                    <button
                        class="iconToggle"
                        [class.active]="
                            !compare.active() && imageryMode() === 'ortho'
                        "
                        [title]="
                            t({
                                en: 'Orthophoto (aerial view)',
                                fr: 'Orthophoto (vue aérienne)',
                            })
                        "
                        (click)="
                            compare.setActive(false); imageryMode.set('ortho')
                        "
                    >
                        <app-icon icon="photo" size="md" />
                    </button>
                    <button
                        class="iconToggle"
                        [class.active]="
                            !compare.active() && imageryMode() === 'plan'
                        "
                        [title]="t(planLabel)"
                        (click)="
                            compare.setActive(false); imageryMode.set('plan')
                        "
                    >
                        <app-icon icon="map" size="md" />
                    </button>
                    <button
                        class="iconToggle"
                        [class.active]="compare.active()"
                        [title]="
                            t({
                                en: 'Compare two orthophotos (split screen)',
                                fr: 'Comparer deux orthophotos (écran partagé)',
                            })
                        "
                        (click)="compare.setActive(true)"
                    >
                        <app-icon icon="compare" size="md" />
                    </button>
                </div>
                @if (!compare.active() && imageryMode() === "ortho") {
                    <app-dropdown
                        icon="history"
                        [title]="
                            t({
                                en: 'Photo date',
                                fr: 'Date de la prise de vue',
                            })
                        "
                        [options]="compare.orthoLabels()"
                        [value]="sliceIndex()"
                        (valueChange)="sliceIndex.set($event)"
                    />
                }
            </div>

            <!-- Relief: source (left, when on) + toggle (right) -->
            <div class="flex flex-row items-center gap-2">
                @if (terrainOn()) {
                    <app-dropdown
                        icon="mountain"
                        [title]="
                            t({ en: 'Relief source', fr: 'Source du relief' })
                        "
                        [options]="terrainLabels"
                        [value]="terrainIndex()"
                        (valueChange)="terrainIndex.set($event)"
                    />
                }
                <button
                    class="ui-surface iconToggle standalone rounded-lg"
                    [class.active]="terrainOn()"
                    [title]="
                        t({
                            en: 'Relief (elevation model)',
                            fr: 'Relief (modèle d\\'élévation)',
                        })
                    "
                    (click)="terrainOn.set(!terrainOn())"
                >
                    <app-icon icon="mountain" size="md" />
                </button>
            </div>

            <!-- 3D buildings: simple toggle -->
            <button
                class="ui-surface iconToggle standalone rounded-lg"
                [class.active]="buildingsOn()"
                [title]="t({ en: '3D buildings', fr: 'Bâtiments 3D' })"
                (click)="buildingsOn.set(!buildingsOn())"
            >
                <app-icon icon="buildings" size="md" />
            </button>
        </div>
    `,
    styles: [
        `
            .iconToggle {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 0.375rem;
                color: var(--color-text-headings);
                cursor: pointer;
                transition: all 0.15s;
            }
            .iconToggle:hover {
                color: var(--color-text-headings);
            }
            .iconToggle.active {
                background-color: var(--color-surface-primary);
                color: rgb(255 255 255 / 1);
            }
            .standalone {
                width: 2.75rem;
                height: 2.75rem;
                pointer-events: auto;
            }
        `,
    ],
})
export class BasemapControls {
    private readonly horizonService = inject(HorizonService);
    private readonly tour = inject(TourService);
    protected readonly compare = inject(CompareService);
    protected readonly t = inject(I18n).t;
    protected readonly planLabel: Text = PLAN_IGN_LAYER.label;
    private readonly destroyRef = inject(DestroyRef);
    private readonly api = signal<HrzApi.AsyncApi | null>(null);

    /** Manual relief state captured at tour start, restored when it ends. */
    private tourReliefSnapshot: { on: boolean; idx: number } | null = null;

    readonly imageryMode = signal<"ortho" | "plan">("ortho");
    readonly sliceIndex = signal(ORTHO_TIME_LAYERS.length - 1); // most recent (single view)

    readonly terrainOn = signal(false);
    readonly terrainIndex = signal(0);
    readonly terrainLabels = TERRAINS.map((t) => t.label);

    readonly buildingsOn = signal(false);
    private readonly cameraAlt = signal(0);
    private readonly buildingsVisible = computed(
        () => this.buildingsOn() && this.cameraAlt() < 2000,
    );

    private readonly imagerySlot = this.makeLayerSlot();
    private readonly compareSlot = this.makeLayerSlot(); // right-view ortho (multiview)
    private readonly terrainSlot = this.makeLayerSlot();
    private buildingsData: HrzProtocol.LayerHandle | null = null;
    private buildingsTiles: HrzProtocol.LayerHandle | null = null;

    constructor() {
        this.horizonService.onApiReady((api) => {
            this.api.set(api);
            // Serves the cleaned RGE ALTI® DTM `client:` tiles (sea → 0 m).
            this.horizonService.onMessage("assetRequest", (msg) =>
                serveRgeDtmAsset(api, msg.assetRequest),
            );
            setInterval(async () => {
                const cam = await api.CameraService.getCameraPose({
                    camera: HrzProtocol.CameraIndex.CAMERA_0,
                });
                this.cameraAlt.set(cam.position?.altitude ?? 0);
            }, 500);
        });

        // Left / single-view imagery. In comparison mode it always shows an
        // ortho (the Plan toggle is hidden then); otherwise dated ortho or plan.
        effect(() => {
            const comparing = this.compare.active();
            const mode = this.imageryMode();
            const cfg = comparing
                ? ORTHO_TIME_LAYERS[this.compare.leftIndex()]
                : mode === "plan"
                  ? PLAN_IGN_LAYER
                  : ORTHO_TIME_LAYERS[this.sliceIndex()];
            if (!this.api()) return;
            this.imagerySlot.set((a) =>
                addWmtsImageryLayer(a, {
                    name: `IGN Imagery (${cfg.layerIdentifier})`,
                    layerIdentifier: cfg.layerIdentifier,
                    capabilitiesUrl: cfg.capabilitiesUrl,
                    sceneViews: 1, // view 0 (left)
                }),
            );
        });

        // Right-view ortho — only while comparing (scene view 1).
        effect(() => {
            const comparing = this.compare.active();
            const cfg = ORTHO_TIME_LAYERS[this.compare.rightIndex()];
            if (!this.api()) return;
            this.compareSlot.set(
                comparing
                    ? (a) =>
                          addWmtsImageryLayer(a, {
                              name: `IGN Imagery right (${cfg.layerIdentifier})`,
                              layerIdentifier: cfg.layerIdentifier,
                              capabilitiesUrl: cfg.capabilitiesUrl,
                              sceneViews: 2, // view 1 (right)
                          })
                    : null,
            );
        });

        // Multiview scene wiring: split into two synced views (activeViews=3),
        // both on CAMERA_0, scissored at the divider position; or back to one.
        effect(() => {
            const comparing = this.compare.active();
            const pos = this.compare.position();
            const a = this.api();
            if (!a) return;
            void this.applyMultiview(a, comparing, pos);
        });

        // On activation, give scene view 1 the SAME look as view 0 (lighting +
        // terrain) — otherwise it renders with default settings (no atmosphere,
        // different lighting). Keyed on `active` only, so it runs once per entry.
        effect(() => {
            const comparing = this.compare.active();
            const a = this.api();
            if (!a || !comparing) return;
            const V1 = HrzProtocol.SceneViewIndex.SCENE_VIEW_1;
            void applyClarityLighting(a, V1);
            void applyTerrainLook(a, V1);
        });

        // Relief: toggle + source.
        effect(() => {
            const on = this.terrainOn();
            const idx = this.terrainIndex();
            if (!this.api()) return;
            this.terrainSlot.set(on ? TERRAINS[idx].factory : null);
        });

        // Guided tour: drive the relief per step (RGE ALTI® on the steps that
        // ask for it, off otherwise) so cliff faces read in 3D. Snapshots the
        // user's manual state on tour start and restores it on tour end
        // (current() === null). Outside a tour the effect never re-runs, so
        // manual relief control is left untouched.
        effect(() => {
            const step = this.tour.current();
            untracked(() => {
                if (step) {
                    if (this.tourReliefSnapshot === null) {
                        this.tourReliefSnapshot = {
                            on: this.terrainOn(),
                            idx: this.terrainIndex(),
                        };
                    }
                    const wantRge = step.rgeTerrain === true;
                    this.terrainOn.set(wantRge);
                    if (wantRge) this.terrainIndex.set(RGE_ALTI_INDEX);
                } else if (this.tourReliefSnapshot !== null) {
                    this.terrainOn.set(this.tourReliefSnapshot.on);
                    this.terrainIndex.set(this.tourReliefSnapshot.idx);
                    this.tourReliefSnapshot = null;
                }
            });
        });

        // Buildings: creation/destruction + altitude-based visibility.
        effect(() => {
            const on = this.buildingsOn();
            const visible = this.buildingsVisible();
            const a = this.api();
            if (!a) return;
            void (async () => {
                if (on) {
                    if (!this.buildingsTiles) {
                        const r = await addBuildingsLayer(a, 0);
                        this.buildingsData = r.data;
                        this.buildingsTiles = r.tiles;
                    }
                    HrzApi.VectorTilesLayerPathBuilder.create(
                        this.buildingsTiles,
                    )
                        .visible()
                        .set(a, visible);
                } else if (this.buildingsTiles) {
                    a.LayerService.destroyLayer(this.buildingsTiles);
                    if (this.buildingsData)
                        a.LayerService.destroyLayer(this.buildingsData);
                    this.buildingsTiles = null;
                    this.buildingsData = null;
                }
            })();
        });

        this.destroyRef.onDestroy(() => {
            this.imagerySlot.destroy();
            this.compareSlot.destroy();
            this.terrainSlot.destroy();
            const a = this.api();
            if (a) void this.applyMultiview(a, false, 0.5); // back to single view
            if (a && this.buildingsTiles)
                a.LayerService.destroyLayer(this.buildingsTiles);
            if (a && this.buildingsData)
                a.LayerService.destroyLayer(this.buildingsData);
        });
    }

    /** Full-canvas rectangle (no clipping). */
    private static readonly FULL_RECT: HrzProtocol.IBbox = {
        xMin: 0,
        xMax: 1,
        yMin: 0,
        yMax: 1,
    };

    /**
     * Applies (or clears) the split multiview: two synced scene views scissored
     * left/right at `pos` when comparing, or a single full view otherwise.
     * Mirrors the Horizon "multiview" demo (SceneSettings + per-view viewport).
     */
    private async applyMultiview(
        a: HrzApi.AsyncApi,
        comparing: boolean,
        pos: number,
    ): Promise<void> {
        const V = HrzProtocol.SceneViewIndex;
        const full = BasemapControls.FULL_RECT;
        await HrzApi.SceneSettingsPathBuilder.create().set(a, {
            activeViews: { bits: comparing ? 3 : 1 },
            mainView: V.SCENE_VIEW_0,
        });
        if (!comparing) {
            // Restore view 0 to the whole canvas.
            await HrzApi.SceneViewSettingsPathBuilder.create(V.SCENE_VIEW_0)
                .viewport()
                .set(a, { viewport: full, scissor: full });
            return;
        }
        const splits = [0, pos, 1];
        for (let i = 0; i < 2; i++) {
            const scissor: HrzProtocol.IBbox = {
                xMin: splits[i],
                xMax: splits[i + 1],
                yMin: 0,
                yMax: 1,
            };
            await HrzApi.SceneViewSettingsPathBuilder.create(V.SCENE_VIEW_0 + i)
                .viewport()
                .set(a, { viewport: full, scissor });
            // Both views share CAMERA_0 → synchronized viewpoint.
            await HrzApi.SceneViewSettingsPathBuilder.create(V.SCENE_VIEW_0 + i)
                .camera()
                .set(a, HrzProtocol.CameraIndex.CAMERA_0);
        }
    }

    /**
     * Single layer "slot": creates the new layer before destroying the old one
     * (no flicker) and ignores stale requests (fast slider). `set(factory|null)`.
     */
    private makeLayerSlot() {
        let handle: HrzProtocol.LayerHandle | null = null;
        let seq = 0;
        const set = async (create: LayerFactory | null) => {
            const a = this.api();
            if (!a) return;
            const my = ++seq;
            const fresh = create ? await create(a) : null;
            if (my !== seq) {
                if (fresh) a.LayerService.destroyLayer(fresh);
                return;
            }
            const old = handle;
            handle = fresh;
            if (old) a.LayerService.destroyLayer(old);
        };
        const destroy = () => {
            const a = this.api();
            if (handle && a) a.LayerService.destroyLayer(handle);
            handle = null;
        };
        return { set, destroy };
    }
}
