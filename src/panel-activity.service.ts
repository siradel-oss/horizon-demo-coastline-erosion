import { Injectable, signal } from "@angular/core";

/**
 * Tracks which feature panels currently display at least one layer, so the menu
 * rail can show an "active" dot on a panel's button even when the panel is
 * closed. Decoupled: each window reports its own state by a stable key
 * (`setActive('coastline', anyVisible)`); the rail reads it via `isActive(key)`.
 */
@Injectable({ providedIn: "root" })
export class PanelActivityService {
    private readonly state = signal<Record<string, boolean>>({});

    /** A panel reports whether it currently shows ≥1 layer. */
    setActive(key: string, active: boolean): void {
        const cur = this.state();
        if (!!cur[key] === active) return;
        this.state.set({ ...cur, [key]: active });
    }

    /** Reactive read for the rail: does this panel have an active layer? */
    isActive(key: string): boolean {
        return !!this.state()[key];
    }
}
