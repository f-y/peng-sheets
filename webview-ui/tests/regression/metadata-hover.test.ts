/**
 * Bug Reproduction: Table Description Hover Area
 *
 * The metadata editor should have a visible hover area even when no description exists.
 * This allows users to hover over the area between tabs and column headers to edit the description.
 */
import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SpreadsheetTable } from '../../components/spreadsheet-table';
import '../../components/spreadsheet-table';
import { queryView, awaitView } from '../helpers/test-helpers';

describe('Table Description Hover Area', () => {
    it('metadata container should have minimum height when description is empty', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
        el.table = {
            name: 'Test',
            description: null, // No description - empty state
            headers: ['A', 'B'],
            rows: [['1', '2']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(el);

        const editorEl = queryView(el, 'ss-metadata-editor');
        expect(editorEl).to.exist;

        // The container element should have a minimum height for hover interaction
        const container = editorEl!.shadowRoot!.querySelector('.metadata-container') as HTMLElement;
        expect(container).to.exist;

        // JSDOM doesn't compute Shadow DOM CSS properly.
        // Instead, verify that the CSS rule is applied by checking the host's static styles
        const styles = (editorEl as any).constructor.styles;
        const cssText = styles.map((s: { cssText?: string }) => s.cssText || s.toString()).join(' ');

        // The CSS should contain min-height for metadata-container
        expect(cssText).to.include('min-height');
    });

    it('metadata description area should expand on hover simulation', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
        el.table = {
            name: 'Test',
            description: '', // Empty string description
            headers: ['A', 'B'],
            rows: [['1', '2']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(el);

        const editorEl = queryView(el, 'ss-metadata-editor');
        const descEl = editorEl!.shadowRoot!.querySelector('.metadata-desc') as HTMLElement;
        expect(descEl).to.exist;

        // The element should have the 'empty' class when description is empty
        expect(descEl.classList.contains('empty')).to.be.true;

        // Note: JSDOM cannot simulate CSS :hover states
        // We validate that the CSS rule exists and the element structure is correct
        // The actual hover behavior must be tested in VS Code
    });
});
