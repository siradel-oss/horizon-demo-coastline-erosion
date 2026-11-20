import { Injectable, signal } from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { HrzProtocol } from "@siradel-oss/horizon-protocol";
import { HorizonService } from "./horizon.service";

/**
 * Wraps Horizon asynchronous picking. A click on the canvas schedules a
 * `pickScreen` request; the engine answers later on the message queue, matched
 * by ticket. The latest hit layers are published as a signal so feature panels
 * can react (e.g. show the survey year of the clicked coastline segment).
 * Generic: it knows nothing about which layers are interesting.
 */
@Injectable({ providedIn: "root" })
export class PickService {
    /** Layers hit by the last click, or null when the popup should be hidden. */
    readonly lastPick = signal<HrzProtocol.IPickLayerResult[] | null>(null);

    private api: HrzApi.AsyncApi | null = null;
    private readonly pending = new Map<
        string,
        (results: HrzProtocol.IPickResults) => void
    >();

    constructor(horizonService: HorizonService) {
        horizonService.onApiReady((api) => (this.api = api));
        horizonService.onMessage("pick", (message) => {
            const pick = message.pick;
            if (!pick) return;
            const resolve = this.pending.get(String(pick.ticket?.opaque));
            if (resolve) {
                this.pending.delete(String(pick.ticket?.opaque));
                resolve(pick.results ?? {});
            }
        });
    }

    /** Picks at a canvas click and publishes the hit layers to `lastPick`. */
    async pickFromClick(event: MouseEvent, canvas: HTMLCanvasElement) {
        const api = this.api;
        if (!api) return;
        // Horizon 26.1 applies the device pixel ratio twice to pick positions
        // too (see fixPointerScale): hand it CSS pixels divided by the ratio,
        // or a tap on a phone picks far below and right of the finger.
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const results = await this.pick(api, {
            x: Math.round((event.clientX - rect.left) / dpr),
            y: Math.round((event.clientY - rect.top) / dpr),
        });
        this.lastPick.set(results.results ?? []);
    }

    /** Hides any open pick popup (e.g. when the camera starts moving). */
    clear() {
        this.lastPick.set(null);
    }

    /** Schedules a pick and resolves once the engine replies on the queue. */
    private async pick(
        api: HrzApi.AsyncApi,
        coords: { x: number; y: number },
    ): Promise<HrzProtocol.IPickResults> {
        const { ticket } = await api.ViewerService.pickScreen({
            coords,
            includedRasters: [],
        });
        return new Promise((resolve) =>
            this.pending.set(String(ticket?.opaque), resolve),
        );
    }
}
