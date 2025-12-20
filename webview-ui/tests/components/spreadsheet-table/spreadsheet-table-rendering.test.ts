import { describe, it, expect, beforeEach } from 'vitest';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';
import '../../../components/spreadsheet-table';
import { queryView, awaitView } from '../../helpers/test-helpers';
import { html, fixture } from '@open-wc/testing';
import { renderMarkdown } from '../../../utils/spreadsheet-helpers';

describe('SpreadsheetTable Rendering', () => {
    let el: SpreadsheetTable;

    beforeEach(async () => {
        el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
    });

    it('renders trailing newlines correctly in read mode', () => {
        // Access private method - removed, us unit util

        // Case 1: "Alice\n\n" -> Should result in visible line breaks.
        const input = 'Alice\n\n';
        const output = renderMarkdown(input);

        console.log('Markdown Output for "Alice\\n\\n":', output);

        // We expect "Alice<br><br>" followed by zero-width space for visibility
        // 1. "Alice\n\n" -> (parseInline) "Alice\n\n"
        // 2. (replace \n) -> "Alice<br><br>"
        // 3. (trailing <br>) -> append zero-width space
        expect(output).toContain('<br>');
        expect(output).toContain('Alice<br><br>');
    });

    it('visually interprets trailing double newline', async () => {
        el.table = {
            name: 'Test',
            description: '',
            headers: ['A'],
            rows: [['Alice\n\n']], // Double newline
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(el);

        const cell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        const innerHTML = cell.innerHTML;

        console.log('Cell InnerHTML:', innerHTML);

        // We expect "Alice<br><br>" followed by zero-width space for visibility
        expect(innerHTML).toContain('Alice');
        expect(innerHTML).toContain('<br><br>');
    });
});
