/**
 * Phase 0: Metadata Editor Verification Tests
 *
 * These tests verify the metadata (description) editing behavior in SpreadsheetTable.
 * They must pass BEFORE refactoring begins and serve as regression tests.
 *
 * Note: With component-based architecture, the metadata editor is now an
 * ss-metadata-editor element with its own ShadowRoot.
 */
import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../components/spreadsheet-table';
import { SpreadsheetTable, TableJSON } from '../../components/spreadsheet-table';

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

describe('Metadata Editor Verification', () => {
    const createMockTable = (description: string = 'Test Description'): TableJSON => ({
        name: 'Test Table',
        description,
        headers: ['A', 'B', 'C'],
        rows: [
            ['1', '2', '3'],
            ['4', '5', '6']
        ],
        metadata: {},
        start_line: 0,
        end_line: 5
    });

    describe('Description Display', () => {
        it('shows description when present', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('My Description')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const editor = getMetadataEditor(el);
            expect(editor).to.exist;
            expect(editor?.description?.textContent).to.include('My Description');
        });

        it('shows empty container when no description', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            // The metadata editor element should still exist
            const editor = getMetadataEditor(el);
            expect(editor?.element).to.exist;
            // The metadata-desc element should exist even when empty
            expect(editor?.description).to.exist;
        });
    });

    describe('Description Edit', () => {
        it('enters edit mode on click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('Existing')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            let editor = getMetadataEditor(el);
            const descriptionEl = editor?.description as HTMLElement;
            descriptionEl.click();
            await el.updateComplete;
            // Allow requestAnimationFrame in the handler
            await new Promise((r) => setTimeout(r, 50));
            await el.updateComplete;

            // Refresh editor reference and check for textarea
            editor = getMetadataEditor(el);
            expect(editor?.textarea).to.exist;
        });

        it('commits on Enter', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('Old')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const metadataSpy = vi.fn();
            el.addEventListener('metadata-update', metadataSpy);

            // Enter edit mode
            let editor = getMetadataEditor(el);
            const descriptionEl = editor?.description as HTMLElement;
            descriptionEl.click();
            await el.updateComplete;
            await new Promise((r) => setTimeout(r, 50));
            await el.updateComplete;

            // Refresh editor reference
            editor = getMetadataEditor(el);
            const textarea = editor?.textarea as HTMLTextAreaElement;
            textarea.value = 'New Description';
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));

            // Press Enter (non-shift)
            textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
            await el.updateComplete;

            expect(metadataSpy).toHaveBeenCalled();
            const detail = metadataSpy.mock.calls[0][0].detail;
            expect(detail.description).to.equal('New Description');
        });

        it('commits on blur', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('Initial')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const metadataSpy = vi.fn();
            el.addEventListener('metadata-update', metadataSpy);

            // Enter edit mode
            let editor = getMetadataEditor(el);
            const descriptionEl = editor?.description as HTMLElement;
            descriptionEl.click();
            await el.updateComplete;
            await new Promise((r) => setTimeout(r, 50));
            await el.updateComplete;

            // Modify the textarea
            editor = getMetadataEditor(el);
            const textarea = editor?.textarea as HTMLTextAreaElement;
            textarea.value = 'Blurred Description';
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));

            // Blur the textarea
            textarea.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
            await el.updateComplete;

            expect(metadataSpy).toHaveBeenCalled();
            const detail = metadataSpy.mock.calls[0][0].detail;
            expect(detail.description).to.equal('Blurred Description');
        });

        it('cancels on Escape', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('Original')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const metadataSpy = vi.fn();
            el.addEventListener('metadata-update', metadataSpy);

            // Enter edit mode
            let editor = getMetadataEditor(el);
            const descriptionEl = editor?.description as HTMLElement;
            descriptionEl.click();
            await el.updateComplete;
            await new Promise((r) => setTimeout(r, 50));
            await el.updateComplete;

            // Modify the textarea
            editor = getMetadataEditor(el);
            const textarea = editor?.textarea as HTMLTextAreaElement;
            textarea.value = 'Should Not Save';
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));

            // Press Escape
            textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
            await el.updateComplete;

            // Should NOT dispatch event (edit was cancelled)
            expect(metadataSpy).not.toHaveBeenCalled();

            // Textarea should disappear (returned to display mode)
            editor = getMetadataEditor(el);
            expect(editor?.textarea).to.be.null;
        });

        it('preserves original value on cancel', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('Keep This')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            // Enter edit mode
            let editor = getMetadataEditor(el);
            const descriptionEl = editor?.description as HTMLElement;
            descriptionEl.click();
            await el.updateComplete;
            await new Promise((r) => setTimeout(r, 50));
            await el.updateComplete;

            // Modify the textarea
            editor = getMetadataEditor(el);
            const textarea = editor?.textarea as HTMLTextAreaElement;
            textarea.value = 'Changed';

            // Press Escape
            textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
            await el.updateComplete;

            // Verify original value is shown after exiting edit mode
            editor = getMetadataEditor(el);
            expect(editor?.description?.textContent).to.include('Keep This');
        });
    });
});
