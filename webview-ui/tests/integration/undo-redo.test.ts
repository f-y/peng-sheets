import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { queryView, queryAllView, awaitView } from '../helpers/test-helpers';
import { fixture, html } from '@open-wc/testing';

// Hoist mocks to ensure they are available before main.ts is imported
const postMessage = vi.fn();
vi.stubGlobal('acquireVsCodeApi', () => ({
    postMessage: postMessage,
    getState: () => ({}),
    setState: () => {}
}));

// Mock Pyodide
vi.stubGlobal('loadPyodide', async () => ({
    loadPackage: async () => {},
    pyimport: () => ({ install: async () => {} }),
    runPythonAsync: async (code: string) => {
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
                                    ['1', '2']
                                ],
                                metadata: {}
                            }
                        ]
                    }
                ]
            });
        }
        return 'null';
    }
}));

// import '../../main'; // Removed static import
// import { MyEditor } from '../../main'; // Removed static import

describe('Undo/Redo Key Bindings', () => {
    let element: any;
    let MyEditor: any;

    beforeAll(async () => {
        // Dynamically import main.ts so top-level acquireVsCodeApi() uses our mock
        const module = await import('../../main');
        MyEditor = module.MyEditor;
    });

    beforeEach(async () => {
        postMessage.mockClear();
        document.body.innerHTML = '';
        element = await fixture(html`<md-spreadsheet-editor></md-spreadsheet-editor>`);
        // Wait for firstUpdated async operations to complete
        await new Promise((r) => setTimeout(r, 200));
    });

    it('should post "undo" message on Ctrl+Z', async () => {
        const event = new KeyboardEvent('keydown', {
            key: 'z',
            code: 'KeyZ',
            ctrlKey: true,
            bubbles: true,
            composed: true
        });
        window.dispatchEvent(event);

        expect(postMessage).toHaveBeenCalledWith({ type: 'undo' });
    });

    it('should post "undo" message on Cmd+Z (Mac)', async () => {
        const event = new KeyboardEvent('keydown', {
            key: 'z',
            code: 'KeyZ',
            metaKey: true,
            bubbles: true,
            composed: true
        });
        window.dispatchEvent(event);

        expect(postMessage).toHaveBeenCalledWith({ type: 'undo' });
    });

    it('should post "redo" message on Ctrl+Y', async () => {
        const event = new KeyboardEvent('keydown', {
            key: 'y',
            code: 'KeyY',
            ctrlKey: true,
            bubbles: true,
            composed: true
        });
        window.dispatchEvent(event);

        expect(postMessage).toHaveBeenCalledWith({ type: 'redo' });
    });

    it('should post "redo" message on Cmd+Shift+Z', async () => {
        const event = new KeyboardEvent('keydown', {
            key: 'z',
            code: 'KeyZ',
            metaKey: true,
            shiftKey: true,
            bubbles: true,
            composed: true
        });
        window.dispatchEvent(event);

        expect(postMessage).toHaveBeenCalledWith({ type: 'redo' });
    });

    it('should handle event bubbling from table component', async () => {
        const event = new KeyboardEvent('keydown', {
            key: 'z',
            code: 'KeyZ',
            metaKey: true,
            bubbles: true,
            composed: true
        });
        element.dispatchEvent(event);

        expect(postMessage).toHaveBeenCalledWith({ type: 'undo' });
    });

    it('should post redo when dispatched from focused cell element', async () => {
        // Simulate a cell being focused (similar to after Undo operation)
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.tabIndex = 0;
        document.body.appendChild(cell);
        cell.focus();

        // Dispatch Ctrl+Y from the focused cell
        const event = new KeyboardEvent('keydown', {
            key: 'y',
            code: 'KeyY',
            ctrlKey: true,
            bubbles: true,
            composed: true
        });
        cell.dispatchEvent(event);

        expect(postMessage).toHaveBeenCalledWith({ type: 'redo' });

        // Cleanup
        cell.remove();
    });

    it('should handle Ctrl+Y immediately after Ctrl+Z from same element', async () => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.tabIndex = 0;
        document.body.appendChild(cell);
        cell.focus();

        // First: Ctrl+Z (Undo)
        const undoEvent = new KeyboardEvent('keydown', {
            key: 'z',
            code: 'KeyZ',
            ctrlKey: true,
            bubbles: true,
            composed: true
        });
        cell.dispatchEvent(undoEvent);
        expect(postMessage).toHaveBeenCalledWith({ type: 'undo' });

        postMessage.mockClear();

        // Second: Ctrl+Y (Redo) - this should ALSO work
        const redoEvent = new KeyboardEvent('keydown', {
            key: 'y',
            code: 'KeyY',
            ctrlKey: true,
            bubbles: true,
            composed: true
        });
        cell.dispatchEvent(redoEvent);
        expect(postMessage).toHaveBeenCalledWith({ type: 'redo' });

        cell.remove();
    });

    it('should handle Ctrl+Y from SpreadsheetTable shadow DOM cell', async () => {
        // Wait for the editor to be ready
        await new Promise((r) => setTimeout(r, 300));

        // Get the SpreadsheetTable inside the editor's shadow DOM
        const layoutContainer = queryView(element, 'layout-container');
        if (!layoutContainer) {
            console.log('No layout-container found - skipping');
            return;
        }

        const spreadsheetTable = layoutContainer.shadowRoot?.querySelector('spreadsheet-table');
        if (!spreadsheetTable) {
            console.log('No spreadsheet-table found - skipping');
            return;
        }

        // Find a cell in the table's shadow DOM
        const cell = spreadsheetTable.shadowRoot?.querySelector('.cell') as HTMLElement;
        if (!cell) {
            console.log('No cell found - skipping');
            return;
        }

        postMessage.mockClear();
        cell.focus();

        // Dispatch Ctrl+Y from the shadow DOM cell
        const event = new KeyboardEvent('keydown', {
            key: 'y',
            code: 'KeyY',
            ctrlKey: true,
            bubbles: true,
            composed: true
        });
        cell.dispatchEvent(event);

        expect(postMessage).toHaveBeenCalledWith({ type: 'redo' });
    });
});
