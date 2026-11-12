import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    model,
    signal,
    viewChild,
} from "@angular/core";
import { HrzApi } from "@siradel-oss/horizon-api";
import { IconButton } from "../components/icon-button";
import { TextButton } from "../components/button";
import { Window } from "../components/window";
import { HorizonService } from "../horizon.service";
import { flyTo } from "../viewpoints";
import { I18n, type Text } from "../i18n";
import {
    addSearchMarker,
    setSearchMarker,
    clearSearchMarker,
    removeSearchMarker,
    MarkerHandles,
} from "../layers";

/** One geocoder suggestion (IGN Géoplateforme completion result). */
interface Suggestion {
    label: string;
    lon: number;
    lat: number;
}

/** IGN Géoplateforme (BAN) address/POI autocompletion endpoint — open, no key. */
const COMPLETION_URL = "https://data.geopf.fr/geocodage/completion";
const DEBOUNCE_MS = 250;
const MIN_CHARS = 3;
const MAX_RESULTS = 6;
/** Camera half-extent (degrees) when flying to a picked address (~3 km). */
const SEARCH_EXTENT = 0.03;

@Component({
    selector: "app-search-window",
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Window, IconButton, TextButton],
    template: `
        @if (open()) {
            <app-window side="left" class="absolute top-0 left-0 w-80 p-lg">
                <div class="flex flex-row items-center mb-lg">
                    <h1 class="grow text-xl font-semibold">
                        {{
                            t({
                                en: "Address search",
                                fr: "Recherche d'adresse",
                            })
                        }}
                    </h1>
                    <app-icon-button
                        icon="close"
                        iconSize="md"
                        (click)="open.set(false)"
                    />
                </div>

                <form
                    class="mt-2"
                    (submit)="$event.preventDefault(); pickFirst()"
                >
                    <input
                        #searchInput
                        type="text"
                        [placeholder]="
                            t({
                                en: 'Address, municipality, place…',
                                fr: 'Adresse, commune, lieu-dit…',
                            })
                        "
                        autocomplete="off"
                        role="combobox"
                        [attr.aria-label]="
                            t({
                                en: 'Address search',
                                fr: 'Recherche d\\'adresse',
                            })
                        "
                        [attr.aria-expanded]="suggestions().length > 0"
                        [value]="searchTerm()"
                        (input)="onInput(asValue($event))"
                        (keydown.escape)="suggestions.set([])"
                        class="w-full px-3 py-2 bg-form-background-surface placeholder:text-form-text-placeholder border border-form-border-default rounded-lg text-form-text-default focus:border-form-border-focus shadow-[var(--shadow-inner-field)]"
                    />
                </form>

                @if (suggestions().length) {
                    <ul class="mt-2 flex flex-col gap-1" role="listbox">
                        @for (s of suggestions(); track s.label) {
                            <li>
                                <button
                                    app-text-button
                                    role="option"
                                    class="w-full text-left text-body-2xs"
                                    (click)="select(s)"
                                >
                                    {{ s.label }}
                                </button>
                            </li>
                        }
                    </ul>
                } @else if (notice(); as n) {
                    <p class="mt-4 text-sm text-text-lightest">{{ t(n) }}</p>
                }

                <p class="mt-4 text-body-2xs text-text-lightest">
                    {{ t({ en: "Geocoding:", fr: "Géocodage :" }) }}
                    <a
                        href="https://geoservices.ign.fr/services-geoplateforme-geocodage"
                        class="underline"
                        target="_blank"
                        rel="noopener"
                        >IGN — Géoplateforme</a
                    >
                    (Base Adresse Nationale).
                </p>
            </app-window>
        }
    `,
})
export class SearchWindow {
    readonly open = model(false);
    readonly searchTerm = signal("");
    readonly suggestions = signal<Suggestion[]>([]);
    /** Empty-state / error message shown when there is no suggestion list. */
    readonly notice = signal<Text | null>(null);
    protected readonly t = inject(I18n).t;
    private readonly searchInput =
        viewChild<ElementRef<HTMLInputElement>>("searchInput");

    private readonly horizonService = inject(HorizonService);
    private readonly destroyRef = inject(DestroyRef);
    private api: HrzApi.AsyncApi | null = null;
    /** Search pin (created once the engine is ready). */
    private marker: MarkerHandles | null = null;

    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    /** Guards against out-of-order completion responses clobbering newer ones. */
    private reqSeq = 0;

    constructor() {
        this.horizonService.onApiReady((a) => {
            this.api = a;
            void addSearchMarker(a).then((h) => (this.marker = h));
        });
        // Opening: reset + focus. Closing: drop the pin (the marker is tied to
        // the open search).
        effect(() => {
            const opened = this.open();
            const el = this.searchInput()?.nativeElement;
            if (opened && el) {
                this.suggestions.set([]);
                this.notice.set(null);
                el.focus();
            } else if (!opened) {
                // Closing resets the search: clear the field, the suggestions
                // and the dropped pin.
                this.searchTerm.set("");
                this.suggestions.set([]);
                this.notice.set(null);
                if (this.api && this.marker)
                    clearSearchMarker(this.api, this.marker);
            }
        });
        this.destroyRef.onDestroy(() => {
            this.clearDebounce();
            if (this.api && this.marker)
                removeSearchMarker(this.api, this.marker);
        });
    }

    asValue(e: Event): string {
        return (e.target as HTMLInputElement).value;
    }

    /** Debounced query: schedule an autocompletion request as the user types. */
    onInput(value: string) {
        this.searchTerm.set(value);
        this.notice.set(null);
        this.clearDebounce();
        if (value.trim().length < MIN_CHARS) {
            this.suggestions.set([]);
            return;
        }
        this.debounceTimer = setTimeout(
            () => this.fetchCompletion(value.trim()),
            DEBOUNCE_MS,
        );
    }

    /** Fly to the picked place and collapse the suggestion list. */
    select(s: Suggestion) {
        this.searchTerm.set(s.label);
        this.suggestions.set([]);
        this.notice.set(null);
        if (!this.api) return;
        flyTo(this.api, s.lon, s.lat, 0, SEARCH_EXTENT);
        if (this.marker) setSearchMarker(this.api, this.marker, s.lon, s.lat);
    }

    /** Enter in the field jumps to the top suggestion. */
    pickFirst() {
        const first = this.suggestions()[0];
        if (first) this.select(first);
    }

    private fetchCompletion(text: string) {
        const seq = ++this.reqSeq;
        const url =
            `${COMPLETION_URL}?text=${encodeURIComponent(text)}` +
            `&type=StreetAddress,PositionOfInterest&maximumResponses=${MAX_RESULTS}`;
        fetch(url)
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((data: { results?: RawResult[] }) => {
                if (seq !== this.reqSeq) return; // a newer request superseded this one
                const items = (data.results ?? [])
                    .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y))
                    .map<Suggestion>((r) => ({
                        label: r.fulltext,
                        lon: r.x,
                        lat: r.y,
                    }));
                this.suggestions.set(items);
                this.notice.set(
                    items.length
                        ? null
                        : { en: "No results.", fr: "Aucun résultat." },
                );
            })
            .catch(() => {
                if (seq !== this.reqSeq) return;
                this.suggestions.set([]);
                this.notice.set({
                    en: "Geocoding service unavailable.",
                    fr: "Service de géocodage indisponible.",
                });
            });
    }

    private clearDebounce() {
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }
}

/** Raw shape of an IGN completion result (only the fields we consume). */
interface RawResult {
    fulltext: string;
    x: number; // longitude (WGS84)
    y: number; // latitude (WGS84)
}
