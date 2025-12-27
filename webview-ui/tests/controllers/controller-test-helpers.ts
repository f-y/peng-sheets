/**
 * Test helpers for controller unit tests
 */
import { vi } from 'vitest';
import type { ReactiveControllerHost } from 'lit';

/**
 * Create a minimal mock ReactiveControllerHost for testing controllers
 */
export const createMockHost = (): ReactiveControllerHost & {
    clipboardCtrl: { clearCopiedRange: ReturnType<typeof vi.fn> };
} => ({
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
    clipboardCtrl: {
        clearCopiedRange: vi.fn()
    }
});
