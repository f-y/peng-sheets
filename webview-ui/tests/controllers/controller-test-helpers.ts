/**
 * Test helpers for controller unit tests
 */
import { vi } from 'vitest';
import type { ReactiveControllerHost } from 'lit';

/**
 * Create a minimal mock ReactiveControllerHost for testing controllers
 */
export const createMockHost = (): ReactiveControllerHost => ({
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true)
});
