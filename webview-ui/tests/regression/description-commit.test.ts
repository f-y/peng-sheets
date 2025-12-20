/**
 * Bug Reproduction: Description Edit Commit via Enter
 *
 * Verifies that editing a table description and pressing Enter
 * triggers the metadata-update event with the new description.
 */
import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SpreadsheetTable, TableJSON } from '../../components/spreadsheet-table';
import '../../components/spreadsheet-table';
import { queryView, awaitView } from '../helpers/test-helpers';

function getMetadataEditor(el: SpreadsheetTable) {
    const editorEl = queryView(el, 'ss-metadata-editor');
    if (!editorEl) return null;
    const descEl = editorEl.shadowRoot!.querySelector('.metadata-desc');
    const textareaEl = editorEl.shadowRoot!.querySelector('.metadata-input-desc');
    return { element: editorEl, description: descEl, textarea: textareaEl };
}

describe('Description Edit Commit', () => {
    it('dispatches metadata-update event on Enter with new description', async () => {
        const table: TableJSON = {
            name: 'Test Table',
            description: 'Original Description',
            headers: ['A', 'B'],
            rows: [['1', '2']],
            metadata: {},
            start_line: 0,
            end_line: 5
        };

        const el = await fixture<SpreadsheetTable>(
            html`<spreadsheet-table .table="${table}" .sheetIndex="${0}" .tableIndex="${0}"></spreadsheet-table>`
        );
        await awaitView(el);

        const metadataUpdateSpy = vi.fn();
        el.addEventListener('metadata-update', metadataUpdateSpy);

        // Enter edit mode
        let editor = getMetadataEditor(el);
        const descriptionEl = editor?.description as HTMLElement;
        descriptionEl.click();
        await awaitView(el);
        await new Promise((r) => setTimeout(r, 50));
        await awaitView(el);

        // Modify the textarea
        editor = getMetadataEditor(el);
        const textarea = editor?.textarea as HTMLTextAreaElement;
        textarea.value = 'Updated Description';
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));

        // Press Enter
        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
        await awaitView(el);

        // Verify event
        expect(metadataUpdateSpy).toHaveBeenCalled();
        const eventDetail = metadataUpdateSpy.mock.calls[0][0].detail;
        expect(eventDetail.description).toBe('Updated Description');
        expect(eventDetail.sheetIndex).toBe(0);
        expect(eventDetail.tableIndex).toBe(0);
    });
});
