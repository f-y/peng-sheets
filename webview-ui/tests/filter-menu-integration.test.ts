/**
 * Filter Menu Integration Test
 * 
 * Tests the ENTIRE chain from filter icon click to menu rendering.
 * This is a true integration test that does NOT mock intermediate components.
 */
import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/spreadsheet-table';
import { SpreadsheetTable } from '../components/spreadsheet-table';
import { awaitView } from './test-helpers';

describe('Filter Menu Integration', () => {
    const createMockTable = () => ({
        name: 'Test',
        description: '',
        headers: ['Name', 'Role'],
        rows: [
            ['Alice', 'Admin'],
            ['Bob', 'User']
        ],
        metadata: {},
        start_line: 0,
        end_line: 3
    });

    it('should render filter-menu at correct position when filter icon is clicked', async () => {
        const el = await fixture<SpreadsheetTable>(html`
            <spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>
        `);
        await awaitView(el);

        // Get the View
        const view = el.shadowRoot!.querySelector('spreadsheet-table-view')!;

        // Find the filter icon in column 0
        const header = view.shadowRoot!.querySelector('ss-column-header[data-col="0"]')!;
        const filterIcon = header.querySelector('.filter-icon') as HTMLElement;
        expect(filterIcon).toBeTruthy();

        // Get the header's bounding rect BEFORE clicking
        // This is what the menu position SHOULD be based on
        const headerRect = header.getBoundingClientRect();
        console.log('Header rect:', headerRect);

        // Click the filter icon
        filterIcon.click();
        await awaitView(el);

        // Verify FilterController state was updated
        expect(el.filterCtrl.activeFilterMenu).to.not.be.null;
        console.log('FilterController activeFilterMenu:', el.filterCtrl.activeFilterMenu);

        // Verify the filter-menu element exists in View
        const filterMenu = view.shadowRoot!.querySelector('filter-menu') as HTMLElement;
        expect(filterMenu).to.exist;

        // Check the actual CSS position applied to the menu
        const menuStyle = filterMenu.style;
        console.log('Menu style.left:', menuStyle.left);
        console.log('Menu style.top:', menuStyle.top);

        // Get the menu's computed position
        const menuRect = filterMenu.getBoundingClientRect();
        console.log('Menu rect:', menuRect);

        // The menu's top should be near the header's bottom
        // Allow some tolerance for scrolling/viewport offset
        const tolerance = 50; // pixels
        expect(menuRect.top).to.be.lessThan(headerRect.bottom + tolerance);
        expect(menuRect.top).to.be.greaterThan(headerRect.bottom - tolerance);
    });

    it('should log the full coordinate chain for debugging', async () => {
        const el = await fixture<SpreadsheetTable>(html`
            <spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>
        `);
        await awaitView(el);

        const view = el.shadowRoot!.querySelector('spreadsheet-table-view')!;
        const header = view.shadowRoot!.querySelector('ss-column-header[data-col="0"]')!;
        const filterIcon = header.querySelector('.filter-icon') as HTMLElement;

        // Log the filter icon's bounding rect
        const iconRect = filterIcon.getBoundingClientRect();
        console.log('[DEBUG] Filter Icon rect:', iconRect);

        // Listen to the ss-filter-click event to see what coordinates are being passed
        let capturedDetail: unknown = null;
        view.addEventListener('view-filter-click', (e: Event) => {
            capturedDetail = (e as CustomEvent).detail;
            console.log('[DEBUG] view-filter-click detail:', capturedDetail);
        });

        filterIcon.click();
        await awaitView(el);

        // Log what FilterController received
        console.log('[DEBUG] activeFilterMenu:', el.filterCtrl.activeFilterMenu);

        // Log what View is rendering
        const filterMenu = view.shadowRoot!.querySelector('filter-menu') as HTMLElement;
        if (filterMenu) {
            console.log('[DEBUG] filter-menu x prop:', (filterMenu as any).x);
            console.log('[DEBUG] filter-menu y prop:', (filterMenu as any).y);
            console.log('[DEBUG] filter-menu style:', filterMenu.style.cssText);
        }

        // This test is primarily for logging - pass if menu exists
        expect(filterMenu).to.exist;
    });
});
