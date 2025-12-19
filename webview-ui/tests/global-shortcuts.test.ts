import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock acquireVsCodeApi global
const postMessageMock = vi.fn();
(global as any).acquireVsCodeApi = () => ({
    postMessage: postMessageMock,
    getState: () => ({}),
    setState: () => { }
});

// Mock i18n
vi.mock('../utils/i18n', () => ({
    t: (key: string) => key
}));

// Mock Pyodide loading to avoid errors
vi.mock('../python-modules/headless_editor.py?raw', () => ({ default: '' }));
(global as any).loadPyodide = async () => ({
    loadPackage: async () => { },
    pyimport: () => ({ install: async () => { } }),
    runPythonAsync: async () => JSON.stringify({ workbook: {}, structure: [] }),
    globals: { set: vi.fn() }
});

describe('MyEditor Ctrl+S Bug', () => {
    let element: HTMLElement;
    let container: HTMLElement;

    beforeEach(async () => {
        // Import main.ts to register the element
        await import('../main');
        container = document.createElement('div');
        document.body.appendChild(container);

        element = document.createElement('md-spreadsheet-editor');
        container.appendChild(element);
        await (element as any).updateComplete;
    });

    afterEach(() => {
        container.remove();
        vi.clearAllMocks();
    });

    it('should send "save" message when Ctrl+S is pressed', async () => {
        // Simulate Ctrl+S on window
        const event = new KeyboardEvent('keydown', {
            key: 's',
            ctrlKey: true,
            bubbles: true,
            composed: true
        });

        window.dispatchEvent(event);

        // Check if message was sent
        expect(postMessageMock).toHaveBeenCalledWith({ type: 'save' });
    });

    it('should send "save" message when Cmd+S (Meta+S) is pressed', async () => {
        const event = new KeyboardEvent('keydown', {
            key: 's',
            metaKey: true,
            bubbles: true,
            composed: true
        });

        window.dispatchEvent(event);

        expect(postMessageMock).toHaveBeenCalledWith({ type: 'save' });
    });
});
