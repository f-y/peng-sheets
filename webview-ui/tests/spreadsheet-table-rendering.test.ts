
import { describe, it, expect, beforeEach } from 'vitest';
import { SpreadsheetTable } from '../components/spreadsheet-table';
import '../components/spreadsheet-table';
import { html, fixture } from '@open-wc/testing';

describe('SpreadsheetTable Rendering', () => {
    let el: SpreadsheetTable;

    beforeEach(async () => {
        el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
    });

    it('renders trailing newlines correctly in read mode', () => {
        // Access private method
        const renderMarkdown = (el as any)._renderMarkdown.bind(el);

        // Case 1: "Alice\n\n" -> Should result in visible line breaks.
        // If marked produces "Alice<br><br>", the last BR is often ignored by browser layout unless followed by something.
        const input = "Alice\n\n";
        const output = renderMarkdown(input);

        console.log('Markdown Output for "Alice\\n\\n":', output);

        // We expect "Alice<br><br><br>" effectively. 
        // 1. "Alice\n\n" -> (parseInline) "Alice\n\n"
        // 2. (replace \n) -> "Alice<br><br>"
        // 3. (endsWith <br>) -> "Alice<br><br><br>"
        expect(output).toContain('<br>');
        expect(output).toContain('Alice<br><br><br>');
    });

    it('visually interprets trailing double newline', async () => {
        el.table = {
            name: 'Test',
            headers: ['A'],
            rows: [['Alice\n\n']], // Double newline
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await el.updateComplete;

        const cell = el.shadowRoot!.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
        const innerHTML = cell.innerHTML;

        console.log('Cell InnerHTML:', innerHTML);

        // The user says "Alice<br><br>" shows as "Alice".
        // This is a CSS/Browser layout issue mostly. 
        // If we want it to show as 3 lines, we might need a distinct style or a trailing phantom break in READ mode too?
        // Or marked should output <p> tags but we use parseInline.

        // If innerHTML is "Alice<br><br>", browsers collapse the last <br>.
        // We might need to ensure it renders as "Alice<br><br><br>" or "Alice<br><br>&nbsp;" 
        // or ensure white-space: pre-wrap is used?

        // Let's assert what we have first.
        expect(innerHTML).toContain('Alice');
    });
});
