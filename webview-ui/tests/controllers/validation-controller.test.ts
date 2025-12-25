/**
 * Tests for ValidationController
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    ValidationController,
    ValidationControllerHost,
    ValidationRules
} from '../../controllers/validation-controller';

// Mock host for testing
class MockValidationHost implements ValidationControllerHost {
    private rules: ValidationRules | null = null;
    private controllers: Set<unknown> = new Set();

    setRules(rules: ValidationRules | null): void {
        this.rules = rules;
    }

    getValidationRules(): ValidationRules | null {
        return this.rules;
    }

    addController(controller: unknown): void {
        this.controllers.add(controller);
    }

    removeController(controller: unknown): void {
        this.controllers.delete(controller);
    }

    requestUpdate(): void {}

    get updateComplete(): Promise<boolean> {
        return Promise.resolve(true);
    }
}

describe('ValidationController', () => {
    let host: MockValidationHost;
    let controller: ValidationController;

    beforeEach(() => {
        host = new MockValidationHost();
        controller = new ValidationController(host);
    });

    describe('getRule', () => {
        it('returns null when no rules are set', () => {
            expect(controller.getRule(0)).toBeNull();
        });

        it('returns the rule for a column', () => {
            host.setRules({
                '0': { type: 'list', values: ['A', 'B'] }
            });
            expect(controller.getRule(0)).toEqual({ type: 'list', values: ['A', 'B'] });
        });

        it('returns null for columns without rules', () => {
            host.setRules({
                '0': { type: 'date' }
            });
            expect(controller.getRule(1)).toBeNull();
        });
    });

    describe('hasRule', () => {
        it('returns true when column has a rule', () => {
            host.setRules({
                '0': { type: 'email' }
            });
            expect(controller.hasRule(0)).toBe(true);
        });

        it('returns false when column has no rule', () => {
            host.setRules({
                '0': { type: 'email' }
            });
            expect(controller.hasRule(1)).toBe(false);
        });
    });

    describe('validate - list', () => {
        beforeEach(() => {
            host.setRules({
                '0': { type: 'list', values: ['Open', 'Closed', 'Pending'] }
            });
        });

        it('returns valid for matching value', () => {
            expect(controller.validate('Open', 0)).toEqual({ valid: true });
        });

        it('returns invalid for non-matching value', () => {
            const result = controller.validate('Invalid', 0);
            expect(result.valid).toBe(false);
            expect(result.message).toContain('Open');
        });

        it('returns valid for empty value', () => {
            expect(controller.validate('', 0)).toEqual({ valid: true });
        });
    });

    describe('validate - date', () => {
        beforeEach(() => {
            host.setRules({
                '0': { type: 'date' }
            });
        });

        it('returns valid for ISO8601 date', () => {
            expect(controller.validate('2025-12-25', 0)).toEqual({ valid: true });
        });

        it('returns invalid for non-date format', () => {
            const result = controller.validate('12/25/2025', 0);
            expect(result.valid).toBe(false);
        });

        it('returns invalid for invalid date', () => {
            const result = controller.validate('2025-13-45', 0);
            expect(result.valid).toBe(false);
        });
    });

    describe('validate - integer', () => {
        it('returns valid for integer', () => {
            host.setRules({
                '0': { type: 'integer' }
            });
            expect(controller.validate('42', 0)).toEqual({ valid: true });
        });

        it('returns invalid for non-integer', () => {
            host.setRules({
                '0': { type: 'integer' }
            });
            const result = controller.validate('3.14', 0);
            expect(result.valid).toBe(false);
        });

        it('validates min range', () => {
            host.setRules({
                '0': { type: 'integer', min: 0 }
            });
            expect(controller.validate('-1', 0).valid).toBe(false);
            expect(controller.validate('0', 0).valid).toBe(true);
        });

        it('validates max range', () => {
            host.setRules({
                '0': { type: 'integer', max: 100 }
            });
            expect(controller.validate('101', 0).valid).toBe(false);
            expect(controller.validate('100', 0).valid).toBe(true);
        });
    });

    describe('validate - email', () => {
        beforeEach(() => {
            host.setRules({
                '0': { type: 'email' }
            });
        });

        it('returns valid for valid email', () => {
            expect(controller.validate('test@example.com', 0)).toEqual({ valid: true });
        });

        it('returns invalid for invalid email', () => {
            expect(controller.validate('not-an-email', 0).valid).toBe(false);
        });
    });

    describe('validate - url', () => {
        beforeEach(() => {
            host.setRules({
                '0': { type: 'url' }
            });
        });

        it('returns valid for valid URL', () => {
            expect(controller.validate('https://example.com', 0)).toEqual({ valid: true });
        });

        it('returns invalid for invalid URL', () => {
            expect(controller.validate('not-a-url', 0).valid).toBe(false);
        });
    });

    describe('helper methods', () => {
        it('getListValues returns values for list rule', () => {
            host.setRules({
                '0': { type: 'list', values: ['A', 'B'] }
            });
            expect(controller.getListValues(0)).toEqual(['A', 'B']);
        });

        it('getListValues returns null for non-list rule', () => {
            host.setRules({
                '0': { type: 'date' }
            });
            expect(controller.getListValues(0)).toBeNull();
        });

        it('shouldShowDatePicker returns true for date rule', () => {
            host.setRules({
                '0': { type: 'date' }
            });
            expect(controller.shouldShowDatePicker(0)).toBe(true);
        });

        it('shouldShowDropdown returns true for list rule', () => {
            host.setRules({
                '0': { type: 'list', values: ['A'] }
            });
            expect(controller.shouldShowDropdown(0)).toBe(true);
        });
    });
});
