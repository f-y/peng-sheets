import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};
import { fixture, html } from '@open-wc/testing-helpers';
import '../../../../webview-ui/components/cells/ss-data-cell';
import { SSDataCell } from '../../../../webview-ui/components/cells/ss-data-cell';

describe('SSDataCell Date Format', () => {
    let element: SSDataCell;

    beforeEach(async () => {
        element = await fixture<SSDataCell>(html` <ss-data-cell .row=${0} .col=${0}></ss-data-cell> `);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('displays date in configured format (YYYY-MM-DD)', async () => {
        element.dateFormat = 'YYYY-MM-DD';
        element.value = '2023-12-25';
        element.validationRule = { type: 'date' };
        await element.updateComplete;

        const content = element.renderRoot.querySelector('.cell');
        expect(content?.textContent?.trim()).toBe('2023-12-25');
    });

    it('displays date in configured format (DD/MM/YYYY)', async () => {
        element.dateFormat = 'DD/MM/YYYY';
        element.value = '2023-12-25';
        element.validationRule = { type: 'date' };
        await element.updateComplete;

        const content = element.renderRoot.querySelector('.cell');
        expect(content?.textContent?.trim()).toBe('25/12/2023');
    });

    it('displays date as-is if parsing fails', async () => {
        element.dateFormat = 'YYYY-MM-DD';
        element.value = 'invalid-date';
        element.validationRule = { type: 'date' };
        await element.updateComplete;

        const content = element.renderRoot.querySelector('.cell');
        expect(content?.textContent?.trim()).toBe('invalid-date');
    });

    it('treats value matching dateFormat as valid', async () => {
        // Set properties via template to ensure they are initialized correctly
        const el = await fixture<SSDataCell>(html`
            <ss-data-cell
                .row=${0}
                .col=${0}
                .dateFormat=${'DD/MM/YYYY'}
                .value=${'25/12/2023'}
                .validationRule=${{ type: 'date' }}
            ></ss-data-cell>
        `);
        // Note: use 'el' instead of shared 'element'

        await el.updateComplete;

        const content = el.renderRoot.querySelector('.cell');
        // Because ss-data-cell processes value:
        expect(content?.classList.contains('validation-error')).toBe(false);
        expect(content?.textContent?.trim()).toBe('25/12/2023');
    });

    it('treats valid YYYY-MM-DD value as valid even if dateFormat is different', async () => {
        element.dateFormat = 'DD/MM/YYYY';
        element.value = '2023-12-25'; // Standard format
        element.validationRule = { type: 'date' };
        await element.updateComplete;

        const content = element.renderRoot.querySelector('.cell');
        expect(content?.classList.contains('validation-error')).toBe(false);
        expect(content?.textContent?.trim()).toBe('25/12/2023');
    });

    it('marks invalid date as invalid', async () => {
        element.dateFormat = 'YYYY-MM-DD';
        element.value = 'not-a-date';
        element.validationRule = { type: 'date' };
        await element.updateComplete;

        const content = element.renderRoot.querySelector('.cell');
        expect(content?.classList.contains('validation-error')).toBe(true);
    });

    it('passes dateFormat to ss-validation-datepicker', async () => {
        element.dateFormat = 'MM/DD/YYYY';
        element.value = '2023-12-25';
        element.isSelected = true;
        element.validationRule = { type: 'date' };
        await element.updateComplete;

        const datepicker = element.renderRoot.querySelector('ss-validation-datepicker');
        expect(datepicker).toBeTruthy();
        expect(datepicker?.getAttribute('dateFormat')).toBe(null); // Property, not attribute
        expect((datepicker as any).dateFormat).toBe('MM/DD/YYYY');
    });

    it('handles ss-datepicker-select event and emits ss-validation-input with formatted value', async () => {
        element.dateFormat = 'DD/MM/YYYY';
        element.value = '2023-12-25';
        element.isSelected = true;
        element.validationRule = { type: 'date' };
        await element.updateComplete;

        const datepicker = element.renderRoot.querySelector('ss-validation-datepicker');
        expect(datepicker).toBeTruthy();

        const listener = vi.fn();
        element.addEventListener('ss-validation-input', listener);

        // Datepicker emits ss-datepicker-select with ALREADY FORMATTED value
        datepicker?.dispatchEvent(
            new CustomEvent('ss-datepicker-select', {
                detail: { value: '25/12/2023' },
                bubbles: true,
                composed: true
            })
        );

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].detail.value).toBe('25/12/2023');
    });
});
