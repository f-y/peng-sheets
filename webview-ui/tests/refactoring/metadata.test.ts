/**
 * Phase 0: Metadata Editor Verification Tests
 *
 * These tests verify the metadata (description) editing behavior in SpreadsheetTable.
 * They must pass BEFORE refactoring begins and serve as regression tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../components/spreadsheet-table';
import { SpreadsheetTable, TableJSON } from '../../components/spreadsheet-table';

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

            const descriptionEl = el.shadowRoot!.querySelector('.metadata-desc');
            expect(descriptionEl).to.exist;
            expect(descriptionEl?.textContent).to.include('My Description');
        });

        it('shows empty container when no description', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            // The metadata-desc element should still exist (for clicking to add)
            const descriptionEl = el.shadowRoot!.querySelector('.metadata-desc');
            expect(descriptionEl).to.exist;
        });
    });

    describe('Description Edit', () => {
        it('enters edit mode on click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('Existing')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const descriptionEl = el.shadowRoot!.querySelector('.metadata-desc') as HTMLElement;
            descriptionEl.click();
            await el.updateComplete;
            // Allow requestAnimationFrame in the handler
            await new Promise((r) => setTimeout(r, 20));
            await el.updateComplete;

            // Should be in metadata editing mode
            expect(el.editCtrl.editingMetadata).to.be.true;

            // Textarea should appear
            const textarea = el.shadowRoot!.querySelector('.metadata-input-desc');
            expect(textarea).to.exist;
        });

        it('commits on Enter', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('Old')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const metadataSpy = vi.fn();
            el.addEventListener('metadata-edit', metadataSpy);

            // Enter edit mode
            const descriptionEl = el.shadowRoot!.querySelector('.metadata-desc') as HTMLElement;
            descriptionEl.click();
            await el.updateComplete;
            await new Promise((r) => setTimeout(r, 20));
            await el.updateComplete;

            // Modify the textarea
            const textarea = el.shadowRoot!.querySelector(
                '.metadata-input-desc'
            ) as HTMLTextAreaElement;
            textarea.value = 'New Description';
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));

            // Press Enter (non-shift)
            textarea.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })
            );
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
            el.addEventListener('metadata-edit', metadataSpy);

            // Enter edit mode
            const descriptionEl = el.shadowRoot!.querySelector('.metadata-desc') as HTMLElement;
            descriptionEl.click();
            await el.updateComplete;
            await new Promise((r) => setTimeout(r, 20));
            await el.updateComplete;

            // Modify the textarea
            const textarea = el.shadowRoot!.querySelector(
                '.metadata-input-desc'
            ) as HTMLTextAreaElement;
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
            el.addEventListener('metadata-edit', metadataSpy);

            // Enter edit mode
            const descriptionEl = el.shadowRoot!.querySelector('.metadata-desc') as HTMLElement;
            descriptionEl.click();
            await el.updateComplete;
            await new Promise((r) => setTimeout(r, 20));
            await el.updateComplete;

            // Modify the textarea
            const textarea = el.shadowRoot!.querySelector(
                '.metadata-input-desc'
            ) as HTMLTextAreaElement;
            textarea.value = 'Should Not Save';
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));

            // Press Escape
            textarea.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })
            );
            await el.updateComplete;

            // Should NOT dispatch event (edit was cancelled)
            expect(metadataSpy).not.toHaveBeenCalled();

            // Should exit edit mode
            expect(el.editCtrl.editingMetadata).to.be.false;
        });

        it('preserves original value on cancel', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable('Keep This')}"></spreadsheet-table>`
            );
            await el.updateComplete;

            // Enter edit mode
            const descriptionEl = el.shadowRoot!.querySelector('.metadata-desc') as HTMLElement;
            descriptionEl.click();
            await el.updateComplete;
            await new Promise((r) => setTimeout(r, 20));
            await el.updateComplete;

            // Modify the textarea
            const textarea = el.shadowRoot!.querySelector(
                '.metadata-input-desc'
            ) as HTMLTextAreaElement;
            textarea.value = 'Changed';

            // Press Escape
            textarea.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })
            );
            await el.updateComplete;

            // Verify original value is shown after exiting edit mode
            const descriptionAfter = el.shadowRoot!.querySelector('.metadata-desc');
            expect(descriptionAfter?.textContent).to.include('Keep This');
        });
    });
});
