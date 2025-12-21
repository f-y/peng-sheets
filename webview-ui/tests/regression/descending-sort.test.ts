/**
 * Regression Test: Descending Sort Bug
 *
 * Issue: Descending sort (Sort Z to A) does not work correctly.
 * The Python `sort_rows` function expects a boolean `ascending` parameter,
 * but `SpreadsheetService` was passing a string 'asc' or 'desc'.
 * In Python, both non-empty strings are truthy, so descending sort behaves like ascending.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../components/spreadsheet-table';
import { SpreadsheetTable, TableJSON } from '../../components/spreadsheet-table';
import { awaitView } from '../helpers/test-helpers';

describe('Descending Sort Regression', () => {
    let element: SpreadsheetTable;

    const createTable = (): TableJSON => ({
        name: 'Test Table',
        description: '',
        headers: ['Name', 'Value'],
        rows: [
            ['Apple', '10'],
            ['Cherry', '30'],
            ['Banana', '20']
        ],
        metadata: {},
        start_line: 0,
        end_line: 0
    });

    beforeEach(async () => {
        element = await fixture<SpreadsheetTable>(
            html`<spreadsheet-table .table="${createTable()}"></spreadsheet-table>`
        );
        await awaitView(element);
    });

    it('should sort descending (Z to A) correctly', async () => {
        // Manually trigger sort through the filterCtrl event handler
        const sortEvent = new CustomEvent('sort', {
            detail: { direction: 'desc', column: 'Name' },
            bubbles: true,
            composed: true
        });

        // Mock the post-message dispatch to capture the sent data
        let capturedDetail: any = null;
        element.addEventListener('post-message', ((e: CustomEvent) => {
            capturedDetail = e.detail;
        }) as EventListener);

        // Simulate opening filter menu for column 0
        element.filterCtrl.activeFilterMenu = { colIndex: 0, x: 100, y: 100 };

        // Trigger sort
        element.filterCtrl.handleSort(sortEvent);

        await awaitView(element);

        // Verify the dispatch contains the correct ascending flag
        expect(capturedDetail).toBeTruthy();
        expect(capturedDetail.command).toBe('sort_rows');
        expect(capturedDetail.ascending).toBe(false); // desc should be ascending: false
    });

    it('should sort ascending (A to Z) correctly', async () => {
        const sortEvent = new CustomEvent('sort', {
            detail: { direction: 'asc', column: 'Name' },
            bubbles: true,
            composed: true
        });

        let capturedDetail: any = null;
        element.addEventListener('post-message', ((e: CustomEvent) => {
            capturedDetail = e.detail;
        }) as EventListener);

        element.filterCtrl.activeFilterMenu = { colIndex: 0, x: 100, y: 100 };
        element.filterCtrl.handleSort(sortEvent);

        await awaitView(element);

        expect(capturedDetail).toBeTruthy();
        expect(capturedDetail.command).toBe('sort_rows');
        expect(capturedDetail.ascending).toBe(true);
    });
});
