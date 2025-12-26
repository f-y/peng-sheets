import { describe, it, expect } from 'vitest';
import { SimpleDateFormatter } from '../../utils/date-formatter';

describe('SimpleDateFormatter', () => {
    describe('parseDate', () => {
        it('should parse YYYY-MM-DD', () => {
            const date = SimpleDateFormatter.parseDate('2023-12-25', 'YYYY-MM-DD');
            expect(date).not.toBeNull();
            expect(date?.getFullYear()).toBe(2023);
            expect(date?.getMonth()).toBe(11); // 0-indexed
            expect(date?.getDate()).toBe(25);
        });

        it('should parse DD/MM/YYYY', () => {
            const date = SimpleDateFormatter.parseDate('25/12/2023', 'DD/MM/YYYY');
            expect(date).not.toBeNull();
            expect(date?.getFullYear()).toBe(2023);
            expect(date?.getMonth()).toBe(11);
            expect(date?.getDate()).toBe(25);
        });

        it('should parse MM/DD/YYYY', () => {
            const date = SimpleDateFormatter.parseDate('12/25/2023', 'MM/DD/YYYY');
            expect(date).not.toBeNull();
            expect(date?.getFullYear()).toBe(2023);
            expect(date?.getMonth()).toBe(11);
            expect(date?.getDate()).toBe(25);
        });

        it('should return null for invalid date values', () => {
            const date = SimpleDateFormatter.parseDate('2023-02-30', 'YYYY-MM-DD'); // Feb 30 doesn't exist
            expect(date).toBeNull();
        });

        it('should return null for format mismatch', () => {
            const date = SimpleDateFormatter.parseDate('2023/12/25', 'YYYY-MM-DD'); // Delimiter mismatch
            expect(date).toBeNull();
        });

        it('should return null for empty input', () => {
            expect(SimpleDateFormatter.parseDate('', 'YYYY-MM-DD')).toBeNull();
        });
    });

    describe('formatDate', () => {
        it('should format to YYYY-MM-DD', () => {
            const date = new Date(2023, 11, 25);
            expect(SimpleDateFormatter.formatDate(date, 'YYYY-MM-DD')).toBe('2023-12-25');
        });

        it('should format to DD/MM/YYYY', () => {
            const date = new Date(2023, 11, 25);
            expect(SimpleDateFormatter.formatDate(date, 'DD/MM/YYYY')).toBe('25/12/2023');
        });

        it('should format to MM.DD.YYYY', () => {
            const date = new Date(2023, 11, 25);
            expect(SimpleDateFormatter.formatDate(date, 'MM.DD.YYYY')).toBe('12.25.2023');
        });

        it('should return empty string for null date', () => {
            expect(SimpleDateFormatter.formatDate(null, 'YYYY-MM-DD')).toBe('');
        });

        it('should handle single digit days/months correctly with padding', () => {
            const date = new Date(2023, 0, 5); // Jan 5
            expect(SimpleDateFormatter.formatDate(date, 'YYYY-MM-DD')).toBe('2023-01-05');
        });
    });
});
