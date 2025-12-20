/**
 * RowVisibilityController - Manages row visibility based on filters
 *
 * Computes visible row indices and provides navigation helpers
 * for moving between visible rows (respecting filters).
 */

import { NumberFormat } from '../utils/spreadsheet-helpers';

export interface ColumnDisplayFormat {
    wordWrap?: boolean;
    numberFormat?: NumberFormat;
}

export interface VisualMetadata {
    filters?: Record<string, string[]>;
    column_widths?: number[] | Record<number, number>;
    columns?: Record<string, { align?: string; format?: ColumnDisplayFormat }>;
    align?: string;
    format?: unknown;
}

export interface RowVisibilityDependencies {
    /** Get the current table rows (2D array of cell values) */
    getRows: () => string[][] | null;
    /** Get the visual metadata containing filter configuration */
    getVisualMetadata: () => VisualMetadata | null;
}

export class RowVisibilityController {
    private deps: RowVisibilityDependencies;

    constructor(deps: RowVisibilityDependencies) {
        this.deps = deps;
    }

    /**
     * Returns indices of rows that are currently visible (pass all filters).
     */
    get visibleRowIndices(): number[] {
        const rows = this.deps.getRows();
        if (!rows) return [];

        const visual = this.deps.getVisualMetadata();
        const filters = visual?.filters || {};

        const indices: number[] = [];
        for (let i = 0; i < rows.length; i++) {
            let visible = true;
            const row = rows[i];

            // Check all filters
            for (const [colStr, hiddenValues] of Object.entries(filters)) {
                if (!hiddenValues || hiddenValues.length === 0) continue;

                const colIdx = parseInt(colStr, 10);
                if (colIdx >= 0 && colIdx < row.length) {
                    const cellValue = row[colIdx];
                    if (hiddenValues.includes(cellValue)) {
                        visible = false;
                        break;
                    }
                }
            }

            if (visible) {
                indices.push(i);
            }
        }
        return indices;
    }

    /**
     * Gets the next visible row index when navigating by delta.
     * Handles ghost row (new row) at the end of the table.
     *
     * @param currentDataRowIndex - Current row index in data array
     * @param delta - Direction to move (+1 down, -1 up)
     * @param ghostRowIndex - Index of the ghost row (table.rows.length), or -1 if none
     */
    getNextVisibleRowIndex(currentDataRowIndex: number, delta: number, ghostRowIndex: number): number {
        const indices = this.visibleRowIndices;

        // Handle Ghost Row source
        if (ghostRowIndex !== -1 && currentDataRowIndex === ghostRowIndex) {
            if (delta < 0 && indices.length > 0) {
                return indices[indices.length - 1];
            }
            return ghostRowIndex;
        }

        const visualIdx = indices.indexOf(currentDataRowIndex);

        if (visualIdx === -1) {
            return currentDataRowIndex + delta;
        }

        const nextVisualIdx = visualIdx + delta;

        if (nextVisualIdx >= indices.length) {
            if (delta > 0 && ghostRowIndex !== -1) {
                return ghostRowIndex;
            }
            return indices[indices.length - 1];
        }

        if (nextVisualIdx < 0) {
            return indices[0];
        }

        return indices[nextVisualIdx];
    }
}
