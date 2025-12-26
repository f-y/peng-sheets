/**
 * Tests for ss-validation-dropdown component (Light DOM)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../../components/cells/ss-validation-dropdown';
import { SSValidationDropdown } from '../../../components/cells/ss-validation-dropdown';

// Mock ResizeObserver for JSDOM
if (typeof window !== 'undefined') {
    window.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as any;
}
global.ResizeObserver = window.ResizeObserver;

describe('SSValidationDropdown', () => {
    let container: HTMLElement;

    beforeEach(async () => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render a dropdown button', async () => {
            const el = document.createElement('ss-validation-dropdown') as SSValidationDropdown;
            el.values = ['Open', 'Closed', 'Pending'];
            el.currentValue = 'Open';
            container.appendChild(el);
            await el.updateComplete;

            // Light DOM: query directly on element
            const button = el.querySelector('.validation-dropdown-trigger');
            expect(button).toBeTruthy();
        });

        it('should show chevron icon in button', async () => {
            const el = document.createElement('ss-validation-dropdown') as SSValidationDropdown;
            el.values = ['A', 'B'];
            container.appendChild(el);
            await el.updateComplete;

            const button = el.querySelector('.validation-dropdown-trigger');
            expect(button?.textContent?.trim()).toBe('▼');
        });
    });

    describe('Dropdown Menu', () => {
        it('should open dropdown on button click', async () => {
            const el = document.createElement('ss-validation-dropdown') as SSValidationDropdown;
            el.values = ['Open', 'Closed'];
            container.appendChild(el);
            await el.updateComplete;

            expect(el.querySelector('.validation-dropdown-menu')).toBeFalsy();

            const button = el.querySelector('.validation-dropdown-trigger') as HTMLElement;
            button.click();
            await el.updateComplete;

            const menu = el.querySelector('.validation-dropdown-menu');
            expect(menu).toBeTruthy();
        });

        it('should display all values as options', async () => {
            const el = document.createElement('ss-validation-dropdown') as SSValidationDropdown;
            el.values = ['Open', 'Closed', 'Pending'];
            container.appendChild(el);
            await el.updateComplete;

            const button = el.querySelector('.validation-dropdown-trigger') as HTMLElement;
            button.click();
            await el.updateComplete;

            const options = el.querySelectorAll('.validation-dropdown-option');
            expect(options?.length).toBe(3);
            expect(options?.[0].textContent?.trim()).toBe('Open');
            expect(options?.[1].textContent?.trim()).toBe('Closed');
            expect(options?.[2].textContent?.trim()).toBe('Pending');
        });

        it('should highlight current value in dropdown', async () => {
            const el = document.createElement('ss-validation-dropdown') as SSValidationDropdown;
            el.values = ['Open', 'Closed', 'Pending'];
            el.currentValue = 'Closed';
            container.appendChild(el);
            await el.updateComplete;

            const button = el.querySelector('.validation-dropdown-trigger') as HTMLElement;
            button.click();
            await el.updateComplete;

            const options = el.querySelectorAll('.validation-dropdown-option');
            expect(options?.[1].classList.contains('selected')).toBe(true);
        });
    });

    describe('Selection', () => {
        it('should emit ss-dropdown-select event on option click', async () => {
            const el = document.createElement('ss-validation-dropdown') as SSValidationDropdown;
            el.values = ['Open', 'Closed'];
            container.appendChild(el);
            await el.updateComplete;

            const selectHandler = vi.fn();
            el.addEventListener('ss-dropdown-select', selectHandler);

            const button = el.querySelector('.validation-dropdown-trigger') as HTMLElement;
            button.click();
            await el.updateComplete;

            const options = el.querySelectorAll('.validation-dropdown-option');
            (options?.[1] as HTMLElement).click();
            await el.updateComplete;

            expect(selectHandler).toHaveBeenCalledTimes(1);
            expect(selectHandler.mock.calls[0][0].detail.value).toBe('Closed');
        });

        it('should close dropdown after selection', async () => {
            const el = document.createElement('ss-validation-dropdown') as SSValidationDropdown;
            el.values = ['Open', 'Closed'];
            container.appendChild(el);
            await el.updateComplete;

            const button = el.querySelector('.validation-dropdown-trigger') as HTMLElement;
            button.click();
            await el.updateComplete;

            const options = el.querySelectorAll('.validation-dropdown-option');
            (options?.[0] as HTMLElement).click();
            await el.updateComplete;

            expect(el.querySelector('.validation-dropdown-menu')).toBeFalsy();
        });
    });

    describe('Keyboard Navigation', () => {
        it('should open dropdown on Enter key', async () => {
            const el = document.createElement('ss-validation-dropdown') as SSValidationDropdown;
            el.values = ['A', 'B'];
            container.appendChild(el);
            await el.updateComplete;

            const button = el.querySelector('.validation-dropdown-trigger') as HTMLElement;
            button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await el.updateComplete;

            expect(el.querySelector('.validation-dropdown-menu')).toBeTruthy();
        });

        it('should close dropdown on Escape key', async () => {
            const el = document.createElement('ss-validation-dropdown') as SSValidationDropdown;
            el.values = ['A', 'B'];
            container.appendChild(el);
            await el.updateComplete;

            const button = el.querySelector('.validation-dropdown-trigger') as HTMLElement;
            button.click();
            await el.updateComplete;

            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await el.updateComplete;

            expect(el.querySelector('.validation-dropdown-menu')).toBeFalsy();
        });
    });
});
