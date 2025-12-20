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

describe('SpreadsheetTable State Persistence', () => {
    it('Resets editing state when switching sheets (component reuse)', async () => {
        const el = (await fixture(html` <spreadsheet-table></spreadsheet-table> `)) as SpreadsheetTable;

        const tableA = { name: 'Table A', description: 'Desc A', rows: [] };
        const tableB = { name: 'Table B', description: 'Desc B', rows: [] };

        // 1. Initial State
        el.sheetIndex = 0;
        el.table = tableA as any;
        await awaitView(el);

        // 2. Start Editing Metadata
        let editor = getMetadataEditor(el);
        (editor?.description as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await awaitView(el);
        await new Promise((r) => setTimeout(r, 50));
        await awaitView(el);

        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeTruthy();
        expect((editor?.textarea as HTMLTextAreaElement).value).toBe('Desc A');

        // 3. Switch Sheet
        el.sheetIndex = 2;
        el.table = tableB as any;
        await awaitView(el);

        // 4. Expectation: Editing reset, display updated
        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeNull();
        expect(editor?.description?.textContent).toContain('Desc B');
    });

    it('Commits metadata edit on blur to external element', async () => {
        const el = (await fixture(html` <spreadsheet-table></spreadsheet-table> `)) as SpreadsheetTable;
        el.table = { name: 'Table A', description: 'Desc A', rows: [] } as any;
        await awaitView(el);

        // Start edit
        let editor = getMetadataEditor(el);
        (editor?.description as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await awaitView(el);
        await new Promise((r) => setTimeout(r, 50));
        await awaitView(el);

        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeTruthy();

        (editor?.textarea as HTMLTextAreaElement).dispatchEvent(
            new FocusEvent('blur', {
                bubbles: true,
                composed: true,
                relatedTarget: null
            })
        );
        await awaitView(el);

        // Expect: Edit Mode Closed
        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeNull();
    });
});
