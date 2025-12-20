/**
 * Test helpers for SpreadsheetTable tests after View component refactoring.
 *
 * The SpreadsheetTable (Container) now renders a <spreadsheet-table-view> component.
 * DOM elements are in the View's shadow DOM, not the Container's.
 */

import { SpreadsheetTable } from '../components/spreadsheet-table';
import { SpreadsheetTableView } from '../components/spreadsheet-table-view';

// Side-effect imports to ensure custom elements are registered
import '../components/spreadsheet-table';
import '../components/spreadsheet-table-view';

/**
 * Get the View component from a SpreadsheetTable element.
 */
export function getView(el: SpreadsheetTable): SpreadsheetTableView | null {
    return el.shadowRoot?.querySelector('spreadsheet-table-view') ?? null;
}

/**
 * Get the View component's shadow root from a SpreadsheetTable element.
 * Use this to query DOM elements after the View refactoring.
 * Returns null if View component is not found (container may be empty).
 */
export function getViewShadowRoot(el: SpreadsheetTable): ShadowRoot | null {
    const view = getView(el);
    return view?.shadowRoot ?? null;
}

/**
 * Wait for both Container and View to complete their render cycles.
 * Call this after any action that triggers a UI update.
 */
export async function awaitView(el: SpreadsheetTable): Promise<void> {
    // Request an update to ensure any property changes trigger a render
    if (typeof el.requestUpdate === 'function') {
        el.requestUpdate();
    }

    // Wait for Container's first update cycle
    await el.updateComplete;

    // Allow microtasks to process (Lit may schedule additional work)
    await new Promise((r) => setTimeout(r, 0));

    // Wait for Container again in case it re-rendered after property changes
    await el.updateComplete;

    // Now get the View and wait for its update
    const view = getView(el);
    if (view) {
        if (typeof view.requestUpdate === 'function') {
            view.requestUpdate();
        }
        await view.updateComplete;
    }
}

/**
 * Query a selector in the View component's shadow DOM.
 * Returns null if View component is not present or element not found.
 */
export function queryView<T extends Element>(el: SpreadsheetTable, selector: string): T | null {
    const viewRoot = getViewShadowRoot(el);
    if (!viewRoot) return null;
    return viewRoot.querySelector<T>(selector);
}

/**
 * Query all matching elements in the View component's shadow DOM.
 * Returns empty NodeList if View component is not present.
 */
export function queryAllView<T extends Element>(el: SpreadsheetTable, selector: string): NodeListOf<T> {
    const viewRoot = getViewShadowRoot(el);
    if (!viewRoot) return document.querySelectorAll<T>('.EMPTY_SELECTOR_NEVER_MATCH');
    return viewRoot.querySelectorAll<T>(selector);
}
