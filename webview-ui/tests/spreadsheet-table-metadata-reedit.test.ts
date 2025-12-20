import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SpreadsheetTable } from '../components/spreadsheet-table';
import '../components/spreadsheet-table';

/**
 * Helper to get the metadata editor component and its internal elements
 */
function getMetadataEditor(el: SpreadsheetTable) {
    const editorEl = el.shadowRoot!.querySelector('ss-metadata-editor');
    if (!editorEl) return null;
    const descEl = editorEl.shadowRoot!.querySelector('.metadata-desc');
    const textareaEl = editorEl.shadowRoot!.querySelector('.metadata-input-desc');
    return { element: editorEl, description: descEl, textarea: textareaEl };
}

describe('SpreadsheetTable Metadata Re-Edit', () => {
    it('Allows entering edit mode again after a commit', async () => {
        const el = (await fixture(html` <spreadsheet-table></spreadsheet-table> `)) as SpreadsheetTable;

        el.table = {
            name: 'Table A',
            description: 'Desc A',
            headers: ['A'],
            rows: [['1']],
            metadata: {},
            start_line: 0,
            end_line: 5
        } as any;
        await el.updateComplete;

        // 1. Enter Edit Mode
        let editor = getMetadataEditor(el);
        (editor?.description as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await el.updateComplete;
        await new Promise((r) => setTimeout(r, 50));
        await el.updateComplete;
        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeTruthy(); // In edit mode

        // 2. Commit (Blur)
        (editor?.textarea as HTMLTextAreaElement).dispatchEvent(
            new FocusEvent('blur', { bubbles: true, composed: true })
        );
        await el.updateComplete;
        await new Promise((r) => setTimeout(r, 50));
        await el.updateComplete;

        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeNull(); // Exited edit mode

        // 3. Re-Enter Edit Mode
        expect(editor?.description).not.toBeNull();
        (editor?.description as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await el.updateComplete;
        await new Promise((r) => setTimeout(r, 50));
        await el.updateComplete;

        // 4. Expectation: In edit mode again (textarea exists)
        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeTruthy();
    });

    it('Allows entering edit mode again after Enter commit', async () => {
        const el = (await fixture(html` <spreadsheet-table></spreadsheet-table> `)) as SpreadsheetTable;

        el.table = {
            name: 'Table A',
            description: 'Desc A',
            headers: ['A'],
            rows: [['1']],
            metadata: {},
            start_line: 0,
            end_line: 5
        } as any;
        await el.updateComplete;

        // 1. Enter Edit Mode
        let editor = getMetadataEditor(el);
        (editor?.description as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await el.updateComplete;
        await new Promise((r) => setTimeout(r, 50));
        await el.updateComplete;
        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeTruthy();

        // 2. Modify and Commit via Enter
        const input = editor?.textarea as HTMLTextAreaElement;
        input.value = 'Desc B';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await el.updateComplete;
        await new Promise((r) => setTimeout(r, 50));
        await el.updateComplete;

        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeNull(); // Exited edit mode

        // 3. Simulate prop update
        el.table = {
            name: 'Table A',
            description: 'Desc B',
            headers: ['A'],
            rows: [['1']],
            metadata: {},
            start_line: 0,
            end_line: 5
        } as any;
        await el.updateComplete;

        // 4. Re-Enter Edit Mode
        editor = getMetadataEditor(el);
        expect(editor?.description).not.toBeNull();
        expect(editor?.description!.textContent).toContain('Desc B');

        (editor?.description as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await el.updateComplete;
        await new Promise((r) => setTimeout(r, 50));
        await el.updateComplete;

        // 5. Expectation: In edit mode again
        editor = getMetadataEditor(el);
        expect(editor?.textarea).toBeTruthy();
    });
});
