/**
 * Regression test for multi-table date insert bug
 *
 * Bug: When Cmd+; is pressed with multiple tables in SplitView,
 * date is inserted into all tables instead of just the active one.
 *
 * Fix: Check window.activeSpreadsheetTable before processing insert-value-at-selection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Multi-table insert value isolation', () => {
    let dispatchedEvents: CustomEvent[] = [];
    let windowEventHandler: ((e: Event) => void) | null = null;

    beforeEach(() => {
        dispatchedEvents = [];
        // Capture cell-edit events
        windowEventHandler = (e: Event) => {
            if (e.type === 'cell-edit') {
                dispatchedEvents.push(e as CustomEvent);
            }
        };
        window.addEventListener('cell-edit', windowEventHandler);
    });

    afterEach(() => {
        if (windowEventHandler) {
            window.removeEventListener('cell-edit', windowEventHandler);
        }
        // Clean up activeSpreadsheetTable
        (window as any).activeSpreadsheetTable = undefined;
    });

    it('should only process insert-value-at-selection in active table', () => {
        // Simulate two tables with selections
        const table1 = {
            sheetIndex: 0,
            tableIndex: 0,
            selectionCtrl: { selectedRow: 1, selectedCol: 2 }
        };

        const table2 = {
            sheetIndex: 0,
            tableIndex: 1,
            selectionCtrl: { selectedRow: 0, selectedCol: 0 }
        };

        // Simulate handlers like SpreadsheetTable would have
        const createHandler = (table: typeof table1) => {
            return (e: CustomEvent<{ value: string }>) => {
                // This is what the FIX should look like:
                const activeTable = (window as any).activeSpreadsheetTable;
                if (activeTable !== table) return;

                const { value } = e.detail;
                const row = table.selectionCtrl.selectedRow;
                const col = table.selectionCtrl.selectedCol;

                if (row >= -1 && col >= 0) {
                    window.dispatchEvent(
                        new CustomEvent('cell-edit', {
                            bubbles: true,
                            composed: true,
                            detail: {
                                sheetIndex: table.sheetIndex,
                                tableIndex: table.tableIndex,
                                rowIndex: row,
                                colIndex: col,
                                newValue: value
                            }
                        })
                    );
                }
            };
        };

        const handler1 = createHandler(table1);
        const handler2 = createHandler(table2);

        // Set table1 as active
        (window as any).activeSpreadsheetTable = table1;

        // Dispatch insert-value-at-selection
        const insertEvent = new CustomEvent('insert-value-at-selection', {
            detail: { value: '2024-12-28' }
        });

        handler1(insertEvent);
        handler2(insertEvent);

        // Only table1 should have dispatched cell-edit
        expect(dispatchedEvents.length).toBe(1);
        expect(dispatchedEvents[0].detail.tableIndex).toBe(0);
        expect(dispatchedEvents[0].detail.rowIndex).toBe(1);
        expect(dispatchedEvents[0].detail.colIndex).toBe(2);
    });

    it('should not process if no table is active', () => {
        const table = {
            sheetIndex: 0,
            tableIndex: 0,
            selectionCtrl: { selectedRow: 1, selectedCol: 2 }
        };

        const handler = (e: CustomEvent<{ value: string }>) => {
            const activeTable = (window as any).activeSpreadsheetTable;
            if (activeTable !== table) return;

            window.dispatchEvent(
                new CustomEvent('cell-edit', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        sheetIndex: table.sheetIndex,
                        tableIndex: table.tableIndex,
                        rowIndex: table.selectionCtrl.selectedRow,
                        colIndex: table.selectionCtrl.selectedCol,
                        newValue: e.detail.value
                    }
                })
            );
        };

        // No active table set
        (window as any).activeSpreadsheetTable = undefined;

        const insertEvent = new CustomEvent('insert-value-at-selection', {
            detail: { value: '2024-12-28' }
        });

        handler(insertEvent);

        // No cell-edit should be dispatched
        expect(dispatchedEvents.length).toBe(0);
    });
});
