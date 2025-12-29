import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';

// Mocks
const postMessage = vi.fn();
vi.stubGlobal('acquireVsCodeApi', () => ({
    postMessage: postMessage,
    getState: () => ({}),
    setState: () => {}
}));

const runPythonAsync = vi.fn().mockImplementation(async (code: string) => {
    if (code.includes('get_workbook_json')) {
        return JSON.stringify({
            sheets: [
                {
                    name: 'Sheet1',
                    tables: [
                        {
                            name: 'Table1',
                            rows: [
                                ['A', 'B'],
                                ['1', '2'],
                                ['3', '4'],
                                ['5', '6']
                            ],
                            metadata: {}
                        }
                    ]
                }
            ]
        });
    }
    return 'null';
});

vi.stubGlobal('loadPyodide', async () => ({
    loadPackage: async () => {},
    pyimport: () => ({ install: async () => {} }),
    runPythonAsync: runPythonAsync
}));

describe('Rows Delete Event Integration', () => {
    beforeAll(async () => {
        // Dynamically import main.ts
        await import('../../main');
    });

    beforeEach(async () => {
        postMessage.mockClear();
        runPythonAsync.mockClear();
        document.body.innerHTML = '';
        await fixture(html`<md-spreadsheet-editor></md-spreadsheet-editor>`);
        // Wait for initialization
        await new Promise((r) => setTimeout(r, 200));
    });

    it('should call delete_rows when rows-delete event is dispatched', async () => {
        const rowsToDelete = [1, 2, 3];
        const event = new CustomEvent('rows-delete', {
            detail: {
                sheetIndex: 0,
                tableIndex: 0,
                rowIndices: rowsToDelete
            },
            bubbles: true,
            composed: true
        });

        window.dispatchEvent(event);

        // Wait for async processing in main.ts and spreadsheet-service.ts
        await new Promise((r) => setTimeout(r, 100));

        // Verify python call
        expect(runPythonAsync).toHaveBeenCalled();

        // Find the call that contains delete_rows
        // Find the call that contains the function invocation, not the definition
        const calls = runPythonAsync.mock.calls.map((c) => c[0]);
        // Look for the specific invocation pattern
        const deleteCall = calls.find(
            (c) => c.includes('res = delete_rows') || (c.includes('delete_rows(') && !c.includes('def delete_rows'))
        );

        expect(deleteCall).toBeDefined();
        if (deleteCall) {
            // Check arguments: (0, 0, [1,2,3])
            // Remove spaces and newlines for robust comparison
            const normalized = deleteCall.replace(/\s/g, '');
            expect(normalized).toContain('delete_rows(json.loads("0"),json.loads("0"),json.loads("[1,2,3]"))');
        }
    });
});
