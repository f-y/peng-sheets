/**
 * Regression test for trailing newline bug when deleting content with newlines.
 *
 * Bug scenario:
 * 1. Cell contains "a\na" (displayed as two lines, saved as "a<br>a")
 * 2. User enters edit mode and presses Delete twice to get "a"
 * 3. After commit, content becomes "a\n" instead of "a"
 */
import { describe, it, expect, beforeEach, vi, beforeAll, afterEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import type { SpreadsheetTable } from '../../components/spreadsheet-table';
import '../../components/spreadsheet-table';
import { getDOMText } from '../../utils/spreadsheet-helpers';

describe('Trailing Newline Bug - Deletion Regression', () => {
    let table: SpreadsheetTable;

    beforeAll(() => {
        // Stub VS Code API
        (window as unknown as Record<string, unknown>).acquireVsCodeApi = () => ({
            postMessage: vi.fn(),
            getState: vi.fn(),
            setState: vi.fn()
        });
    });

    beforeEach(async () => {
        table = await fixture<SpreadsheetTable>(html`
            <spreadsheet-table
                .sheetIndex=${0}
                .tableIndex=${0}
                .table=${{
                    name: 'Test',
                    description: null,
                    headers: ['A'],
                    rows: [['a\na']],
                    metadata: {},
                    start_line: null,
                    end_line: null,
                    alignments: null
                }}
            ></spreadsheet-table>
        `);
        await table.updateComplete;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should reproduce the getDOMText behavior with BR and text', async () => {
        // Simulate DOM structure: "a" + <br> (before deletion)
        const div = document.createElement('div');
        div.innerHTML = 'a<br>';

        const extracted = getDOMText(div);

        // getDOMText extracts text from DOM - may include trailing \n for <br>
        // The exact number may vary due to contenteditable behavior
        expect(extracted.startsWith('a')).toBe(true);
        expect(extracted.includes('\n')).toBe(true);

        // After normalizeEditContent, ALL trailing newlines should be stripped
        const { normalizeEditContent } = await import('../../utils/edit-mode-helpers');
        const normalized = normalizeEditContent(extracted, false);
        expect(normalized).toBe('a');
    });

    it('should NOT have trailing newline after deleting second character with Delete key', async () => {
        // This simulates the user scenario:
        // Original: "a\na" (with <br> between)
        // After 2x Delete from position after first "a": should be "a"

        // Create DOM structure that represents "a<br>a" after user deletes "a" via Delete key
        // After deleting second "a", the <br> may still remain: "a<br>"
        const div = document.createElement('div');
        div.innerHTML = 'a<br>';

        const extracted = getDOMText(div);

        // This is the bug: getDOMText returns "a\n" but we expect "a"
        // Actually, this is correct behavior for getDOMText - it just extracts text
        // The problem is that the DOM still has <br> after deletion

        // The test documents current behavior
        expect(extracted).toBe('a\n');

        // After normalizeEditContent with hasUserInsertedNewline=false:
        const { normalizeEditContent } = await import('../../utils/edit-mode-helpers');
        const normalized = normalizeEditContent(extracted, false);

        // This is the expected behavior - trailing \n should be stripped
        expect(normalized).toBe('a');
    });

    it('should correctly extract text after user deletes content following BR', async () => {
        // This test simulates the actual edit scenario more closely
        // 1. Cell starts with "a\na"
        // 2. User enters edit mode (cell becomes contenteditable with innerHTML "a<br>a")
        // 3. User positions cursor after first "a" and presses Delete twice
        // 4. DOM should now be "a" (both <br> and second "a" deleted)
        // 5. On commit, we should get "a"

        // The bug might be that pressing Delete removes the "a" but not the <br>
        // Let's verify what the DOM looks like in different scenarios

        // Scenario A: Delete removes both <br> and "a" → DOM is "a"
        const divA = document.createElement('div');
        divA.innerHTML = 'a';
        expect(getDOMText(divA)).toBe('a');

        // Scenario B: Delete removes only "a", <br> remains → DOM is "a<br>"
        const divB = document.createElement('div');
        divB.innerHTML = 'a<br>';
        expect(getDOMText(divB)).toBe('a\n');

        // Scenario C: What if there's a zero-width space after <br>?
        const divC = document.createElement('div');
        divC.innerHTML = 'a<br>\u200B';
        expect(getDOMText(divC)).toBe('a\n'); // Zero-width space is stripped
    });
});
