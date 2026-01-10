
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
