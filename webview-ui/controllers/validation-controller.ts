/**
 * ValidationController - Manages column data validation rules and logic.
 *
 * Supports validation types:
 * - list: Value must be one of predefined values
 * - date: Value must be ISO8601 date format (YYYY-MM-DD)
 * - integer: Value must be an integer, optionally within min/max range
 * - email: Value must be valid email format
 * - url: Value must be valid URL format
 */

import { ReactiveController, ReactiveControllerHost } from 'lit';
import type {
    ListValidationRule,
    DateValidationRule,
    IntegerValidationRule,
    EmailValidationRule,
    UrlValidationRule
} from '../types/metadata';

/**
 * Union type for all validation rules (re-constructed from generated interfaces)
 */
export type ValidationRule =
    | ListValidationRule
    | DateValidationRule
    | IntegerValidationRule
    | EmailValidationRule
    | UrlValidationRule;

// Export these for consumers
export type { ListValidationRule, DateValidationRule, IntegerValidationRule, EmailValidationRule, UrlValidationRule };

/**
 * Validation rule types
 */
export type ValidationRuleType = ValidationRule['type'];

/**
 * Map of column index to validation rule
 */
export type ValidationRules = Record<string, ValidationRule>;

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    message?: string;
}

/**
 * Host interface for ValidationController
 */
export interface ValidationControllerHost extends ReactiveControllerHost {
    getValidationRules(): ValidationRules | null;
}

/**
 * ValidationController - Manages data validation for spreadsheet columns
 */
export class ValidationController implements ReactiveController {
    private host: ValidationControllerHost;

    constructor(host: ValidationControllerHost) {
        this.host = host;
        host.addController(this);
    }

    hostConnected(): void {}
    hostDisconnected(): void {}

    /**
     * Get the validation rule for a specific column
     */
    getRule(colIndex: number): ValidationRule | null {
        const rules = this.host.getValidationRules();
        if (!rules) return null;
        return rules[colIndex.toString()] || null;
    }

    /**
     * Check if a column has a validation rule
     */
    hasRule(colIndex: number): boolean {
        return this.getRule(colIndex) !== null;
    }

    /**
     * Validate a cell value against the column's validation rule
     */
    validate(value: string, colIndex: number): ValidationResult {
        const rule = this.getRule(colIndex);
        if (!rule) {
            return { valid: true };
        }

        // Empty values are always valid (unless required is implemented)
        if (value.trim() === '') {
            return { valid: true };
        }

        switch (rule.type) {
            case 'list':
                return this.validateList(value, rule);
            case 'date':
                return this.validateDate(value);
            case 'integer':
                return this.validateInteger(value, rule);
            case 'email':
                return this.validateEmail(value);
            case 'url':
                return this.validateUrl(value);
            default:
                return { valid: true };
        }
    }

    /**
     * Validate value against list rule
     */
    private validateList(value: string, rule: ListValidationRule): ValidationResult {
        if (rule.values.includes(value)) {
            return { valid: true };
        }
        return {
            valid: false,
            message: `Value must be one of: ${rule.values.join(', ')}`
        };
    }

    /**
     * Validate ISO8601 date format (YYYY-MM-DD)
     */
    private validateDate(value: string): ValidationResult {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
            return {
                valid: false,
                message: 'Date must be in YYYY-MM-DD format'
            };
        }

        // Also validate it's a real date
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return {
                valid: false,
                message: 'Invalid date'
            };
        }

        return { valid: true };
    }

    /**
     * Validate integer with optional min/max range
     */
    private validateInteger(value: string, rule: IntegerValidationRule): ValidationResult {
        const num = Number(value);

        if (!Number.isInteger(num)) {
            return {
                valid: false,
                message: 'Value must be an integer'
            };
        }

        if (rule.min !== undefined && num < rule.min) {
            return {
                valid: false,
                message: `Value must be at least ${rule.min}`
            };
        }

        if (rule.max !== undefined && num > rule.max) {
            return {
                valid: false,
                message: `Value must be at most ${rule.max}`
            };
        }

        return { valid: true };
    }

    /**
     * Validate email format
     */
    private validateEmail(value: string): ValidationResult {
        // Simple email regex - covers most common cases
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return {
                valid: false,
                message: 'Invalid email address'
            };
        }
        return { valid: true };
    }

    /**
     * Validate URL format
     */
    private validateUrl(value: string): ValidationResult {
        try {
            new URL(value);
            return { valid: true };
        } catch {
            return {
                valid: false,
                message: 'Invalid URL'
            };
        }
    }

    /**
     * Get dropdown values for a list validation rule
     */
    getListValues(colIndex: number): string[] | null {
        const rule = this.getRule(colIndex);
        if (rule && rule.type === 'list') {
            return rule.values;
        }
        return null;
    }

    /**
     * Check if a column should show a date picker
     */
    shouldShowDatePicker(colIndex: number): boolean {
        const rule = this.getRule(colIndex);
        return rule !== null && rule.type === 'date';
    }

    /**
     * Check if a column should show a dropdown
     */
    shouldShowDropdown(colIndex: number): boolean {
        const rule = this.getRule(colIndex);
        return rule !== null && rule.type === 'list';
    }
}
