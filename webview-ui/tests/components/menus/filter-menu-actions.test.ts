/**
 * Filter Menu Actions Integration Test
 *
 * Tests the event chain from FilterMenu action buttons to Container handlers.
 * Test-First: These tests should FAIL until the fix is applied.
 */
import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../../components/spreadsheet-table';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';
import { awaitView } from '../../helpers/test-helpers';

describe('Filter Menu Actions', () => {
    const createMockTable = () => ({
        name: 'Test',
        description: '',
        headers: ['Name', 'Role'],
        rows: [
            ['Alice', 'Admin'],
            ['Bob', 'User'],
            ['Charlie', 'Admin']
        ],
        metadata: {},
        start_line: 0,
        end_line: 4
    });

    it('should bubble sort event when Sort A-Z is clicked', async () => {
        const el = await fixture<SpreadsheetTable>(html`
            <spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>
        `);
        await awaitView(el);

        // Spy on FilterController.handleSort
        const handleSortSpy = vi.spyOn(el.filterCtrl, 'handleSort');

        // Open filter menu
        const view = el.shadowRoot!.querySelector('spreadsheet-table-view')!;
        const header = view.shadowRoot!.querySelector('ss-column-header[data-col="0"]')!;
        const filterIcon = header.querySelector('.filter-icon') as HTMLElement;
        filterIcon.click();
        await awaitView(el);

        // Find and click Sort A-Z button
        const filterMenu = view.shadowRoot!.querySelector('filter-menu')!;
        const sortAscBtn = filterMenu.shadowRoot!.querySelector('.action-btn') as HTMLElement;
        expect(sortAscBtn.textContent).to.include('Sort A to Z');

        sortAscBtn.click();
        await awaitView(el);

        // Verify handleSort was called
        expect(handleSortSpy).toHaveBeenCalled();
    });

    it('should bubble filter-change event when checkbox is toggled', async () => {
        const el = await fixture<SpreadsheetTable>(html`
            <spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>
        `);
        await awaitView(el);

        // Spy on FilterController.handleFilterChange
        const handleFilterChangeSpy = vi.spyOn(el.filterCtrl, 'handleFilterChange');

        // Open filter menu
        const view = el.shadowRoot!.querySelector('spreadsheet-table-view')!;
        const header = view.shadowRoot!.querySelector('ss-column-header[data-col="0"]')!;
        const filterIcon = header.querySelector('.filter-icon') as HTMLElement;
        filterIcon.click();
        await awaitView(el);

        // Find a value checkbox (not Select All)
        const filterMenu = view.shadowRoot!.querySelector('filter-menu')!;
        const checkboxes = filterMenu.shadowRoot!.querySelectorAll('.value-item input[type="checkbox"]');
        // Skip first checkbox (Select All)
        const valueCheckbox = checkboxes[1] as HTMLInputElement;
        expect(valueCheckbox).to.exist;

        // Uncheck the value
        valueCheckbox.click();
        await awaitView(el);

        // Verify handleFilterChange was called
        expect(handleFilterChangeSpy).toHaveBeenCalled();
    });
});
