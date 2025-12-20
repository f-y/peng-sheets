import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';
import '../../../components/spreadsheet-table';
import { queryView, awaitView } from '../../helpers/test-helpers';

/**
 * Helper to get the metadata editor component and its internal elements
 */
function getMetadataEditor(el: SpreadsheetTable) {
    const editorEl = queryView(el, 'ss-metadata-editor');
    if (!editorEl) return null;
    const descEl = editorEl.shadowRoot!.querySelector('.metadata-desc');
    const textareaEl = editorEl.shadowRoot!.querySelector('.metadata-input-desc');
    return { element: editorEl, description: descEl, textarea: textareaEl };
}

describe('SpreadsheetTable Metadata Edit', () => {
    it('Enters metadata edit mode on description click', async () => {
        const el = (await fixture(html` <spreadsheet-table></spreadsheet-table> `)) as SpreadsheetTable;

        const tableData = {
            name: 'Test Table',
            description: 'Desc',
            headers: ['A'],
            rows: [['1']],
            metadata: {},
            start_line: 0,
            end_line: 5
        };

        el.table = tableData;
        await awaitView(el);

        // Verify initial state: Check for description element
        let editor = getMetadataEditor(el);
        expect(editor?.description).toBeTruthy();
        expect(editor?.description?.textContent).toContain('Desc');

        // Click to edit
        (editor?.description as HTMLElement)!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await awaitView(el);

        // Check UI (input should be visible)
        await new Promise((r) => setTimeout(r, 50));
        await awaitView(el);

        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeTruthy();
        expect((editor?.textarea as HTMLTextAreaElement)?.value).toBe('Desc');
    });
});
