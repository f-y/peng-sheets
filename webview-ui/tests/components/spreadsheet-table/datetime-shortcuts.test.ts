/**
 * Tests for date/time shortcut keys (Excel-compatible).
 * - Ctrl + ; inserts current date (YYYY-MM-DD)
 * - Ctrl + Shift + ; inserts current time (HH:MM)
 */
import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../../components/spreadsheet-table';
import { queryView, awaitView } from '../../helpers/test-helpers';
import { SpreadsheetTable, TableJSON } from '../../../components/spreadsheet-table';

describe('Date/Time Shortcut Keys', () => {
    const createMockTable = (): TableJSON => ({
        name: 'Test Table',
        description: '',
        headers: ['A', 'B', 'C'],
        rows: [
            ['', '', ''],
            ['', '', '']
        ],
        metadata: {},
        start_line: 0,
        end_line: 5
    });

    describe('Ctrl + ; (insert current date)', () => {
        it('inserts current date as YYYY-MM-DD when cell is selected', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [0, 0]
            const cell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Listen for cell-change event
            const changeEvents: CustomEvent[] = [];
            el.addEventListener('cell-change', ((e: CustomEvent) => {
                changeEvents.push(e);
            }) as EventListener);

            // Press Ctrl + ;
            cell.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: ';',
                    ctrlKey: true,
                    bubbles: true,
                    composed: true
                })
            );
            await awaitView(el);

            // Should have dispatched cell-change with today's date (YYYY-MM-DD format)
            expect(changeEvents.length).toBe(1);
            expect(changeEvents[0].detail.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(changeEvents[0].detail.row).toBe(0);
            expect(changeEvents[0].detail.col).toBe(0);
        });
    });

    describe('Ctrl + Shift + ; (insert current time)', () => {
        it('inserts current time as HH:MM when cell is selected', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [0, 1]
            const cell = queryView(el, '.cell[data-row="0"][data-col="1"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            const changeEvents: CustomEvent[] = [];
            el.addEventListener('cell-change', ((e: CustomEvent) => {
                changeEvents.push(e);
            }) as EventListener);

            // Press Ctrl + Shift + ;
            cell.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: ';',
                    ctrlKey: true,
                    shiftKey: true,
                    bubbles: true,
                    composed: true
                })
            );
            await awaitView(el);

            // Should have dispatched cell-change with current time (HH:MM format)
            expect(changeEvents.length).toBe(1);
            expect(changeEvents[0].detail.value).toMatch(/^\d{2}:\d{2}$/);
            expect(changeEvents[0].detail.row).toBe(0);
            expect(changeEvents[0].detail.col).toBe(1);
        });
    });
});
