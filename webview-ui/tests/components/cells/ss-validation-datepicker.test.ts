/**
 * Tests for ss-validation-datepicker component
 *
 * Focuses on the date formatting logic used by the datepicker.
 * The actual rendering and event handling are tested via integration
 * tests in the browser environment.
 *
 * This file tests the SimpleDateFormatter utility which powers
 * the datepicker's date conversion.
 */
import { describe, it, expect } from 'vitest';
import { SimpleDateFormatter } from '../../../utils/date-formatter';

// Mock ResizeObserver for component import side effects
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe('SSValidationDatepicker - Date Formatting Logic', () => {
    describe('Input Date Conversion (formatDate → YYYY-MM-DD)', () => {
        it('should convert from YYYY-MM-DD format', () => {
            const date = SimpleDateFormatter.parseDate('2023-12-25', 'YYYY-MM-DD');
            expect(date).not.toBeNull();
            const result = SimpleDateFormatter.formatDate(date, 'YYYY-MM-DD');
            expect(result).toBe('2023-12-25');
        });

        it('should convert from DD/MM/YYYY format', () => {
            const date = SimpleDateFormatter.parseDate('25/12/2023', 'DD/MM/YYYY');
            expect(date).not.toBeNull();
            const result = SimpleDateFormatter.formatDate(date, 'YYYY-MM-DD');
            expect(result).toBe('2023-12-25');
        });

        it('should convert from MM-DD-YYYY format', () => {
            const date = SimpleDateFormatter.parseDate('12-25-2023', 'MM-DD-YYYY');
            expect(date).not.toBeNull();
            const result = SimpleDateFormatter.formatDate(date, 'YYYY-MM-DD');
            expect(result).toBe('2023-12-25');
        });

        it('should return null for invalid date', () => {
            const date = SimpleDateFormatter.parseDate('invalid-date', 'YYYY-MM-DD');
            expect(date).toBeNull();
        });

        it('should return null for empty value', () => {
            const date = SimpleDateFormatter.parseDate('', 'YYYY-MM-DD');
            expect(date).toBeNull();
        });
    });

    describe('Output Date Formatting (YYYY-MM-DD → custom format)', () => {
        it('should format to DD/MM/YYYY', () => {
            const date = SimpleDateFormatter.parseDate('2023-12-25', 'YYYY-MM-DD');
            expect(date).not.toBeNull();
            const result = SimpleDateFormatter.formatDate(date, 'DD/MM/YYYY');
            expect(result).toBe('25/12/2023');
        });

        it('should format to MM-DD-YYYY', () => {
            const date = SimpleDateFormatter.parseDate('2023-12-25', 'YYYY-MM-DD');
            expect(date).not.toBeNull();
            const result = SimpleDateFormatter.formatDate(date, 'MM-DD-YYYY');
            expect(result).toBe('12-25-2023');
        });

        it('should format to YYYY/MM/DD', () => {
            const date = SimpleDateFormatter.parseDate('2023-12-25', 'YYYY-MM-DD');
            expect(date).not.toBeNull();
            const result = SimpleDateFormatter.formatDate(date, 'YYYY/MM/DD');
            expect(result).toBe('2023/12/25');
        });
    });
});
