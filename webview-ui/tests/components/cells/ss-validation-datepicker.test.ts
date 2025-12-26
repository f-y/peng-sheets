/**
 * Tests for ss-validation-datepicker component (Light DOM)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};
import { SSValidationDatepicker } from '../../../../webview-ui/components/cells/ss-validation-datepicker';
import { fixture, html } from '@open-wc/testing-helpers';

describe('SSValidationDatepicker', () => {
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
        it('should render a wrapper with button and hidden input', async () => {
            const el = document.createElement('ss-validation-datepicker') as SSValidationDatepicker;
            el.value = '2025-12-25';
            container.appendChild(el);
            await el.updateComplete;

            const wrapper = el.querySelector('.date-picker-wrapper');
            const button = el.querySelector('.validation-datepicker-trigger');
            const input = el.querySelector('.hidden-native-input');

            expect(wrapper).toBeTruthy();
            expect(button).toBeTruthy();
            expect(button?.textContent?.trim()).toBe('📅');
            expect(input).toBeTruthy();
            expect((input as HTMLInputElement).type).toBe('date');
            expect((input as HTMLInputElement).value).toBe('2025-12-25');
        });
    });

    describe('Selection', () => {
        it('should emit ss-datepicker-select event on input', async () => {
            const el = await fixture<SSValidationDatepicker>(html`
                <ss-validation-datepicker .dateFormat=${'YYYY-MM-DD'}></ss-validation-datepicker>
            `);
            await el.updateComplete;

            const selectHandler = vi.fn();
            el.addEventListener('ss-datepicker-select', selectHandler);

            const input = el.querySelector('input.hidden-native-input') as HTMLInputElement;
            expect(input).to.exist;

            // Simulate input
            input.value = '2023-12-25';
            input.dispatchEvent(new Event('input', { bubbles: true }));

            await el.updateComplete;

            expect(selectHandler).toHaveBeenCalledTimes(1);
            expect(selectHandler.mock.calls[0][0].detail.value).toBe('2023-12-25');
        });
    });
});
