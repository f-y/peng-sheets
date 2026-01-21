/**
 * AppStore - Singleton store for application-wide UI state.
 *
 * This store manages:
 * - activeTabIndex: Currently selected tab
 * - tabs: Tab definitions for the bottom tab bar
 * - isLoading: Loading indicator state
 *
 * Components can subscribe to changes via addEventListener('change', ...).
 *
 * Pattern follows existing clipboard-store.ts implementation.
 */

import type { TabDefinition } from '../types';

export interface AppState {
    activeTabIndex: number;
    tabs: TabDefinition[];
    isLoading: boolean;
    errorMessage: string | null;
}

class AppStoreClass extends EventTarget {
    private _state: AppState = {
        activeTabIndex: 0,
        tabs: [],
        isLoading: true,
        errorMessage: null
    };

    /**
     * Get current state (readonly)
     */
    get state(): Readonly<AppState> {
        return this._state;
    }

    /**
     * Get active tab index
     */
    get activeTabIndex(): number {
        return this._state.activeTabIndex;
    }

    /**
     * Get tabs array
     */
    get tabs(): readonly TabDefinition[] {
        return this._state.tabs;
    }

    /**
     * Get loading state
     */
    get isLoading(): boolean {
        return this._state.isLoading;
    }

    /**
     * Set active tab index and emit change event
     */
    setActiveTab(index: number): void {
        if (this._state.activeTabIndex !== index) {
            this._state = { ...this._state, activeTabIndex: index };
            this.dispatchEvent(new CustomEvent('change', { detail: { property: 'activeTabIndex' } }));
        }
    }

    /**
     * Set tabs array and emit change event
     */
    setTabs(tabs: TabDefinition[]): void {
        this._state = { ...this._state, tabs };
        this.dispatchEvent(new CustomEvent('change', { detail: { property: 'tabs' } }));
    }

    /**
     * Set loading state and emit change event
     */
    setLoading(isLoading: boolean): void {
        if (this._state.isLoading !== isLoading) {
            this._state = { ...this._state, isLoading };
            this.dispatchEvent(new CustomEvent('change', { detail: { property: 'isLoading' } }));
        }
    }

    /**
     * Set error message and emit change event
     */
    setError(message: string | null): void {
        this._state = { ...this._state, errorMessage: message };
        this.dispatchEvent(new CustomEvent('change', { detail: { property: 'errorMessage' } }));
    }

    /**
     * Reset state for testing purposes
     */
    _resetForTesting(): void {
        this._state = {
            activeTabIndex: 0,
            tabs: [],
            isLoading: true,
            errorMessage: null
        };
    }
}

/** Singleton instance of AppStore */
export const AppStore = new AppStoreClass();
