
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock VS Code API
const vscode = {
    postMessage: vi.fn(),
    getState: vi.fn(),
    setState: vi.fn(),
};
(global as any).acquireVsCodeApi = () => vscode;
(global as any).vscode = vscode; // Expose for assertions

// Mock Pyodide
(global as any).loadPyodide = vi.fn().mockResolvedValue({
    loadPackage: vi.fn(),
    pyimport: vi.fn().mockReturnValue({ install: vi.fn() }),
    runPythonAsync: vi.fn().mockResolvedValue('{}'),
    globals: new Map()
});
