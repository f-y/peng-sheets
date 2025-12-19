import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../components/spreadsheet-table';
import { SpreadsheetTable } from '../components/spreadsheet-table';

describe('SpreadsheetTable Format Actions', () => {
    let element: SpreadsheetTable;

    beforeEach(async () => {
        element = document.createElement('spreadsheet-table') as SpreadsheetTable;
        element.table = {
            name: 'Test',
            description: '',
            headers: ['A', 'B', 'C'],
            rows: [
                ['100', '200', '300'],
                ['1000', '2000', '3000']
            ],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        element.sheetIndex = 0;
        element.tableIndex = 0;
        document.body.appendChild(element);
        await element.updateComplete;
    });

    afterEach(() => {
        element.remove();
    });

    describe('format-comma action', () => {
        it('dispatches update_column_format with useThousandsSeparator: true when enabling', async () => {
            // Select column 0
            element.selectionCtrl.selectedCol = 0;
            element.selectionCtrl.selectedRow = -1;

            const eventPromise = new Promise<CustomEvent>((resolve) => {
                element.addEventListener('post-message', (e) => resolve(e as CustomEvent), { once: true });
            });

            element.handleToolbarAction('format-comma');

            const event = await eventPromise;
            expect(event.detail.command).toBe('update_column_format');
            expect(event.detail.colIndex).toBe(0);
            expect(event.detail.format.numberFormat.useThousandsSeparator).toBe(true);
        });

        it('dispatches update_column_format with useThousandsSeparator: false when disabling', async () => {
            // Set up existing format with comma enabled
            element.table = {
                ...element.table!,
                metadata: {
                    visual: {
                        columns: {
                            '0': {
                                format: {
                                    numberFormat: { type: 'number', useThousandsSeparator: true }
                                }
                            }
                        }
                    }
                }
            };
            await element.updateComplete;

            element.selectionCtrl.selectedCol = 0;
            element.selectionCtrl.selectedRow = -1;

            const eventPromise = new Promise<CustomEvent>((resolve) => {
                element.addEventListener('post-message', (e) => resolve(e as CustomEvent), { once: true });
            });

            element.handleToolbarAction('format-comma');

            const event = await eventPromise;
            expect(event.detail.command).toBe('update_column_format');
            expect(event.detail.colIndex).toBe(0);
            // Format should be cleared (null) or have useThousandsSeparator: false
            expect(
                event.detail.format === null ||
                event.detail.format?.numberFormat?.useThousandsSeparator === false
            ).toBe(true);
        });
    });

    describe('format-percent action', () => {
        it('dispatches update_column_format with type: percent when enabling', async () => {
            element.selectionCtrl.selectedCol = 1;
            element.selectionCtrl.selectedRow = -1;

            const eventPromise = new Promise<CustomEvent>((resolve) => {
                element.addEventListener('post-message', (e) => resolve(e as CustomEvent), { once: true });
            });

            element.handleToolbarAction('format-percent');

            const event = await eventPromise;
            expect(event.detail.command).toBe('update_column_format');
            expect(event.detail.colIndex).toBe(1);
            expect(event.detail.format.numberFormat.type).toBe('percent');
        });

        it('clears percent format when disabling', async () => {
            // Set up existing percent format
            element.table = {
                ...element.table!,
                metadata: {
                    visual: {
                        columns: {
                            '1': {
                                format: {
                                    numberFormat: { type: 'percent', decimals: 0 }
                                }
                            }
                        }
                    }
                }
            };
            await element.updateComplete;

            element.selectionCtrl.selectedCol = 1;
            element.selectionCtrl.selectedRow = -1;

            const eventPromise = new Promise<CustomEvent>((resolve) => {
                element.addEventListener('post-message', (e) => resolve(e as CustomEvent), { once: true });
            });

            element.handleToolbarAction('format-percent');

            const event = await eventPromise;
            expect(event.detail.command).toBe('update_column_format');
            expect(event.detail.colIndex).toBe(1);
            // Format should be null (cleared)
            expect(event.detail.format).toBe(null);
        });
    });

    describe('format-wordwrap action', () => {
        it('dispatches update_column_format with wordWrap: false when disabling (default is true)', async () => {
            element.selectionCtrl.selectedCol = 0;
            element.selectionCtrl.selectedRow = -1;

            const eventPromise = new Promise<CustomEvent>((resolve) => {
                element.addEventListener('post-message', (e) => resolve(e as CustomEvent), { once: true });
            });

            element.handleToolbarAction('format-wordwrap');

            const event = await eventPromise;
            expect(event.detail.command).toBe('update_column_format');
            expect(event.detail.colIndex).toBe(0);
            expect(event.detail.format.wordWrap).toBe(false);
        });

        it('dispatches update_column_format with wordWrap: true when enabling', async () => {
            // Set up existing format with wordWrap disabled
            element.table = {
                ...element.table!,
                metadata: {
                    visual: {
                        columns: {
                            '0': {
                                format: {
                                    wordWrap: false
                                }
                            }
                        }
                    }
                }
            };
            await element.updateComplete;

            element.selectionCtrl.selectedCol = 0;
            element.selectionCtrl.selectedRow = -1;

            const eventPromise = new Promise<CustomEvent>((resolve) => {
                element.addEventListener('post-message', (e) => resolve(e as CustomEvent), { once: true });
            });

            element.handleToolbarAction('format-wordwrap');

            const event = await eventPromise;
            expect(event.detail.command).toBe('update_column_format');
            expect(event.detail.colIndex).toBe(0);
            expect(event.detail.format.wordWrap).toBe(true);
        });
    });

    describe('format-decimal-increase action', () => {
        it('dispatches update_column_format with decimals: 1 when increasing from 0', async () => {
            element.selectionCtrl.selectedCol = 0;
            element.selectionCtrl.selectedRow = -1;

            const eventPromise = new Promise<CustomEvent>((resolve) => {
                element.addEventListener('post-message', (e) => resolve(e as CustomEvent), { once: true });
            });

            element.handleToolbarAction('format-decimal-increase');

            const event = await eventPromise;
            expect(event.detail.command).toBe('update_column_format');
            expect(event.detail.format.numberFormat.decimals).toBe(1);
        });
    });

    describe('format-decimal-decrease action', () => {
        it('dispatches update_column_format with decimals: 1 when decreasing from 2', async () => {
            element.table = {
                ...element.table!,
                metadata: {
                    visual: {
                        columns: {
                            '0': {
                                format: {
                                    numberFormat: { type: 'number', decimals: 2 }
                                }
                            }
                        }
                    }
                }
            };
            await element.updateComplete;

            element.selectionCtrl.selectedCol = 0;
            element.selectionCtrl.selectedRow = -1;

            const eventPromise = new Promise<CustomEvent>((resolve) => {
                element.addEventListener('post-message', (e) => resolve(e as CustomEvent), { once: true });
            });

            element.handleToolbarAction('format-decimal-decrease');

            const event = await eventPromise;
            expect(event.detail.command).toBe('update_column_format');
            expect(event.detail.format.numberFormat.decimals).toBe(1);
        });

        it('does not dispatch when decimals is already 0', async () => {
            element.selectionCtrl.selectedCol = 0;
            element.selectionCtrl.selectedRow = -1;

            let eventFired = false;
            element.addEventListener('post-message', () => { eventFired = true; }, { once: true });

            element.handleToolbarAction('format-decimal-decrease');

            // Wait a bit to ensure no event is fired
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(eventFired).toBe(false);
        });
    });

    describe('no column selected', () => {
        it('does not dispatch when no column is selected', async () => {
            element.selectionCtrl.selectedCol = -1;
            element.selectionCtrl.selectedRow = -1;

            let eventFired = false;
            element.addEventListener('post-message', () => { eventFired = true; }, { once: true });

            element.handleToolbarAction('format-comma');

            await new Promise(resolve => setTimeout(resolve, 50));
            expect(eventFired).toBe(false);
        });
    });
});
