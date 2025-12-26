import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../../components/spreadsheet-table';
import { queryView, awaitView } from '../../helpers/test-helpers';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';
import { TableJSON } from '../../../types';

// Mock ResizeObserver for JSDOM
// Note: Handle globally for component initialization
if (typeof window !== 'undefined') {
    window.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as any;
}
global.ResizeObserver = window.ResizeObserver;

describe('Validation Integration', () => {
    const createValidationTable = (): TableJSON => ({
        name: 'Validation Table',
        headers: ['ValCol'],
        rows: [['A']],
        metadata: {
            visual: {
                validation: {
                    '0': { type: 'list', values: ['A', 'B', 'C'] }
                }
            }
        },
        start_line: 0,
        end_line: 1
    });

    it('propagates validation value selection to cell-edit event', async () => {
        const el = await fixture<SpreadsheetTable>(
            html`<spreadsheet-table .table="${createValidationTable()}"></spreadsheet-table>`
        );
        await awaitView(el);

        const editSpy = vi.fn();
        el.addEventListener('cell-edit', editSpy);

        // Find the cell component
        // Note: queryView with just class might return the child div inside ss-data-cell?
        // Let's inspect carefully. ss-data-cell renders a div.cell
        // But the event listener is on ss-data-cell (the web component).
        // Let's find ss-data-cell

        // spreadsheet-table-view renders ss-data-cell
        // queryView helpers traverse shadow roots.

        const cell = queryView(el, 'ss-data-cell[data-row="0"][data-col="0"]');
        expect(cell).to.exist;

        // Dispatch ss-validation-input event manually (simulating dropdown selection)
        cell?.dispatchEvent(
            new CustomEvent('ss-validation-input', {
                detail: { row: 0, col: 0, value: 'B' },
                bubbles: true,
                composed: true
            })
        );

        await awaitView(el);

        expect(editSpy).toHaveBeenCalledOnce();
        const detail = editSpy.mock.calls[0][0].detail;
        expect(detail.rowIndex).to.equal(0);
        expect(detail.colIndex).to.equal(0);
        expect(detail.newValue).to.equal('B');
    });
});
