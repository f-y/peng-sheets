import { ReactiveController, ReactiveControllerHost } from 'lit';

interface MenuPosition {
    colIndex: number;
    x: number;
    y: number;
}

interface TableData {
    rows: string[][];
    headers: string[] | null;
}

interface FilterHost extends ReactiveControllerHost {
    table: TableData | null;
    sheetIndex: number;
    tableIndex: number;
    dispatchEvent(event: Event): boolean;
    requestUpdate(): void;
}

/**
 * FilterController - Manages filter and format menu state and operations.
 *
 * Handles:
 * - Filter menu toggle, positioning, and outside click detection
 * - Format menu toggle, positioning, and outside click detection
 * - Sort, filter change, and clear filter dispatching
 * - Getting unique values for filter options
 */
export class FilterController implements ReactiveController {
    host: FilterHost;

    // Menu state
    activeFilterMenu: MenuPosition | null = null;
    activeFormatMenu: MenuPosition | null = null;

    // Filter state per column (colIndex -> hiddenValues)
    columnFilters: Map<number, string[]> = new Map();

    constructor(host: FilterHost) {
        this.host = host;
        host.addController(this);
    }

    hostConnected() {}

    hostDisconnected() {
        // Clean up any listeners
        window.removeEventListener('click', this._handleFilterOutsideClick, true);
        window.removeEventListener('click', this._handleFormatOutsideClick, true);
    }

    /**
     * Get unique values for a column (for filter menu options)
     */
    getUniqueValues(colIndex: number): string[] {
        const { table } = this.host;
        if (!table) return [];
        const values = new Set<string>();
        // Get ALL values, not just visible ones, for the filter menu
        for (const row of table.rows) {
            if (colIndex < row.length) {
                values.add(row[colIndex]);
            }
        }
        return Array.from(values).sort();
    }

    /**
     * Get hidden values for a column
     */
    getHiddenValues(colIndex: number): string[] {
        return this.columnFilters.get(colIndex) || [];
    }

    /**
     * Toggle filter menu visibility
     */
    toggleFilterMenu(e: MouseEvent, colIndex: number): void {
        e.stopPropagation();
        if (this.activeFilterMenu && this.activeFilterMenu.colIndex === colIndex) {
            this.closeFilterMenu();
        } else {
            const button = e.target as HTMLElement;
            const rect = button.getBoundingClientRect();

            const MENU_WIDTH = 200;
            let x = rect.left;

            // Adjust if menu would overflow the right edge of the viewport
            if (rect.left + MENU_WIDTH > window.innerWidth) {
                x = rect.right - MENU_WIDTH;
            }

            this.activeFilterMenu = {
                colIndex,
                x: x,
                y: rect.bottom
            };
            // Register outside click handler on next frame to avoid catching the opening click
            requestAnimationFrame(() => {
                window.addEventListener('click', this._handleFilterOutsideClick, true);
            });
            this.host.requestUpdate();
        }
    }

    /**
     * Handle sort request from filter menu
     */
    handleSort = (e: CustomEvent): void => {
        if (!this.activeFilterMenu) return;
        const { direction } = e.detail;
        const colIdx = this.activeFilterMenu.colIndex;

        this.host.dispatchEvent(
            new CustomEvent('post-message', {
                detail: {
                    command: 'sort_rows',
                    sheetIndex: this.host.sheetIndex,
                    tableIndex: this.host.tableIndex,
                    colIndex: colIdx,
                    ascending: direction === 'asc'
                },
                bubbles: true,
                composed: true
            })
        );
        this.activeFilterMenu = null;
        this.host.requestUpdate();
    };

    /**
     * Handle filter value change from filter menu
     */
    handleFilterChange = (e: CustomEvent): void => {
        if (!this.activeFilterMenu) return;
        const { hiddenValues } = e.detail;
        const colIdx = this.activeFilterMenu.colIndex;

        // Store filter state locally
        if (hiddenValues.length > 0) {
            this.columnFilters.set(colIdx, hiddenValues);
        } else {
            this.columnFilters.delete(colIdx);
        }

        this.host.dispatchEvent(
            new CustomEvent('post-message', {
                detail: {
                    command: 'update_column_filter',
                    sheetIndex: this.host.sheetIndex,
                    tableIndex: this.host.tableIndex,
                    colIndex: colIdx,
                    hiddenValues: hiddenValues
                },
                bubbles: true,
                composed: true
            })
        );
        // Trigger re-render to update FilterMenu with new hiddenValues
        this.host.requestUpdate();
    };

    /**
     * Clear filter for current column
     */
    handleClearFilter = (_e: CustomEvent): void => {
        if (!this.activeFilterMenu) return;
        const colIdx = this.activeFilterMenu.colIndex;

        // Clear filter state locally
        this.columnFilters.delete(colIdx);

        this.host.dispatchEvent(
            new CustomEvent('post-message', {
                detail: {
                    command: 'update_column_filter',
                    sheetIndex: this.host.sheetIndex,
                    tableIndex: this.host.tableIndex,
                    colIndex: colIdx,
                    hiddenValues: []
                },
                bubbles: true,
                composed: true
            })
        );
        this.activeFilterMenu = null;
        this.host.requestUpdate();
    };

    /**
     * Close filter menu
     */
    closeFilterMenu(): void {
        if (this.activeFilterMenu) {
            window.removeEventListener('click', this._handleFilterOutsideClick, true);
            this.activeFilterMenu = null;
            this.host.requestUpdate();
        }
    }

    /**
     * Handle clicks outside filter menu
     */
    private _handleFilterOutsideClick = (e: MouseEvent): void => {
        const path = e.composedPath();
        const isInside = path.some(
            (el) =>
                (el as HTMLElement).tagName?.toLowerCase() === 'filter-menu' ||
                (el as HTMLElement).classList?.contains('filter-icon')
        );
        if (!isInside) {
            this.closeFilterMenu();
        }
    };

    // ---- Format Menu Methods ----

    /**
     * Toggle format menu visibility
     */
    toggleFormatMenu(e: MouseEvent, colIndex: number): void {
        e.stopPropagation();
        if (this.activeFormatMenu && this.activeFormatMenu.colIndex === colIndex) {
            this.closeFormatMenu();
        } else {
            const button = e.target as HTMLElement;
            const rect = button.getBoundingClientRect();

            const MENU_WIDTH = 240;
            let x = rect.left;

            // Adjust if menu would overflow the right edge of the viewport
            if (rect.left + MENU_WIDTH > window.innerWidth) {
                x = rect.right - MENU_WIDTH;
            }

            this.activeFormatMenu = {
                colIndex,
                x: x,
                y: rect.bottom
            };
            // Register outside click handler on next frame to avoid catching the opening click
            requestAnimationFrame(() => {
                window.addEventListener('click', this._handleFormatOutsideClick, true);
            });
            this.host.requestUpdate();
        }
    }

    /**
     * Close format menu
     */
    closeFormatMenu(): void {
        if (this.activeFormatMenu) {
            window.removeEventListener('click', this._handleFormatOutsideClick, true);
            this.activeFormatMenu = null;
            this.host.requestUpdate();
        }
    }

    /**
     * Handle clicks outside format menu
     */
    private _handleFormatOutsideClick = (e: MouseEvent): void => {
        const path = e.composedPath();
        const isInside = path.some(
            (el) =>
                (el as HTMLElement).tagName?.toLowerCase() === 'column-format-menu' ||
                (el as HTMLElement).classList?.contains('format-icon')
        );
        if (!isInside) {
            this.closeFormatMenu();
        }
    };

    /**
     * Handle format change from format menu
     */
    handleFormatChange = (e: CustomEvent): void => {
        const { colIndex, format } = e.detail;

        this.host.dispatchEvent(
            new CustomEvent('post-message', {
                detail: {
                    command: 'update_column_format',
                    sheetIndex: this.host.sheetIndex,
                    tableIndex: this.host.tableIndex,
                    colIndex: colIndex,
                    format: format
                },
                bubbles: true,
                composed: true
            })
        );
        this.closeFormatMenu();
    };

    /**
     * Cancel format menu
     */
    handleFormatCancel = (): void => {
        this.closeFormatMenu();
    };
}
