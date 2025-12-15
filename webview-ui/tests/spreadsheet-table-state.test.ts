import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SpreadsheetTable } from '../components/spreadsheet-table';
import '../components/spreadsheet-table';

describe('SpreadsheetTable State Persistence', () => {
    it('Resets editing state when switching sheets (component reuse)', async () => {
        const el = (await fixture(html` <spreadsheet-table></spreadsheet-table> `)) as SpreadsheetTable;

        const tableA = { name: 'Table A', description: 'Desc A', rows: [] };
        const tableB = { name: 'Table B', description: 'Desc B', rows: [] };

        // 1. Initial State
        el.sheetIndex = 0;
        el.table = tableA as any;
        await el.updateComplete;

        // 2. Start Editing Metadata
        const descEl = el.shadowRoot!.querySelector('.metadata-desc');
        descEl!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await el.updateComplete;

        expect(el.editCtrl.editingMetadata).toBe(true);
        expect((el.shadowRoot!.querySelector('.metadata-input-desc') as HTMLTextAreaElement).value).toBe('Desc A');

        // 3. Switch Sheet
        el.sheetIndex = 2;
        el.table = tableB as any;
        await el.updateComplete;

        // 4. Expectation: Editing reset, display updated
        expect(el.editCtrl.editingMetadata).toBe(false);
        expect(el.shadowRoot!.querySelector('.metadata-input-desc')).toBeNull();
        expect(el.shadowRoot!.querySelector('.metadata-desc')!.textContent).toContain('Desc B');
    });

    it('Commits metadata edit on blur to external element', async () => {
        const el = (await fixture(html` <spreadsheet-table></spreadsheet-table> `)) as SpreadsheetTable;
        el.table = { name: 'Table A', description: 'Desc A', rows: [] } as any;
        await el.updateComplete;

        // Start edit
        const descEl = el.shadowRoot!.querySelector('.metadata-desc');
        descEl!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await el.updateComplete;
        expect(el.editCtrl.editingMetadata).toBe(true);

        const input = el.shadowRoot!.querySelector('.metadata-input-desc') as HTMLTextAreaElement;

        input.dispatchEvent(
            new FocusEvent('blur', {
                bubbles: true,
                composed: true,
                relatedTarget: null
            })
        );
        await el.updateComplete;

        // Expect: Edit Mode Closed
        expect(el.editCtrl.editingMetadata).toBe(false);
    });
});
