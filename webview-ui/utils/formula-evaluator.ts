/**
 * FormulaEvaluator - Evaluates formula expressions and aggregate functions.
 *
 * Supports:
 * - Arithmetic expressions with [ColumnName] references
 * - Aggregate functions: SUM, AVG, COUNT, MIN, MAX
 * - VLOOKUP-style cross-table lookups
 * - Error handling with 'N/A' for invalid calculations
 */

import type { ArithmeticFormula, LookupFormula, FormulaFunctionType, TableMetadata } from '../services/types';
import type { WorkbookJSON, TableJSON } from '../types';

// =============================================================================
// Constants
// =============================================================================

/** Value displayed for calculation errors */
export const NA_VALUE = 'N/A';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed token from an expression.
 */
export type ExpressionToken =
    | { type: 'number'; value: number }
    | { type: 'operator'; value: '+' | '-' | '*' | '/' | '(' | ')' }
    | { type: 'column'; value: string };

/**
 * Row data for evaluation: header names mapped to cell values.
 */
export type RowData = Record<string, string>;

/**
 * Result of formula evaluation.
 */
export interface EvaluationResult {
    success: boolean;
    value: string;
    error?: string;
}

// =============================================================================
// Expression Tokenizer
// =============================================================================

/**
 * Tokenize an expression string into tokens.
 * Supports: numbers, operators (+, -, *, /, (, )), and [ColumnName] references.
 */
export function tokenize(expression: string): ExpressionToken[] {
    const tokens: ExpressionToken[] = [];
    let i = 0;

    while (i < expression.length) {
        const char = expression[i];

        // Skip whitespace
        if (/\s/.test(char)) {
            i++;
            continue;
        }

        // Column reference: [ColumnName]
        if (char === '[') {
            const endBracket = expression.indexOf(']', i);
            if (endBracket === -1) {
                throw new Error(`Unclosed bracket at position ${i}`);
            }
            const columnName = expression.slice(i + 1, endBracket);
            tokens.push({ type: 'column', value: columnName });
            i = endBracket + 1;
            continue;
        }

        // Operators
        if ('+-*/()'.includes(char)) {
            tokens.push({ type: 'operator', value: char as '+' | '-' | '*' | '/' | '(' | ')' });
            i++;
            continue;
        }

        // Numbers (including decimals)
        if (/[0-9.]/.test(char)) {
            let numStr = '';
            while (i < expression.length && /[0-9.]/.test(expression[i])) {
                numStr += expression[i];
                i++;
            }
            const num = parseFloat(numStr);
            if (isNaN(num)) {
                throw new Error(`Invalid number: ${numStr}`);
            }
            tokens.push({ type: 'number', value: num });
            continue;
        }

        throw new Error(`Unexpected character: ${char} at position ${i}`);
    }

    return tokens;
}

// =============================================================================
// Expression Parser & Evaluator (Recursive Descent)
// =============================================================================

/**
 * Parse and evaluate an expression with given row data.
 * Grammar:
 *   expr   -> term (('+' | '-') term)*
 *   term   -> factor (('*' | '/') factor)*
 *   factor -> NUMBER | COLUMN | '(' expr ')'
 */
export function evaluateExpression(expression: string, rowData: RowData): EvaluationResult {
    try {
        const tokens = tokenize(expression);
        const parser = new ExpressionParser(tokens, rowData);
        const result = parser.parseExpression();

        if (parser.hasMoreTokens()) {
            return { success: false, value: NA_VALUE, error: 'Unexpected tokens after expression' };
        }

        // Format result (remove unnecessary decimals)
        const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(2);
        return { success: true, value: formatted };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, value: NA_VALUE, error: message };
    }
}

class ExpressionParser {
    private tokens: ExpressionToken[];
    private position: number = 0;
    private rowData: RowData;

    constructor(tokens: ExpressionToken[], rowData: RowData) {
        this.tokens = tokens;
        this.rowData = rowData;
    }

    hasMoreTokens(): boolean {
        return this.position < this.tokens.length;
    }

    private peek(): ExpressionToken | undefined {
        return this.tokens[this.position];
    }

    private consume(): ExpressionToken {
        return this.tokens[this.position++];
    }

    parseExpression(): number {
        let result = this.parseTerm();

        while (this.peek()?.type === 'operator' && (this.peek()?.value === '+' || this.peek()?.value === '-')) {
            const op = this.consume().value as '+' | '-';
            const right = this.parseTerm();
            result = op === '+' ? result + right : result - right;
        }

        return result;
    }

    private parseTerm(): number {
        let result = this.parseFactor();

        while (this.peek()?.type === 'operator' && (this.peek()?.value === '*' || this.peek()?.value === '/')) {
            const op = this.consume().value as '*' | '/';
            const right = this.parseFactor();
            if (op === '/') {
                if (right === 0) {
                    throw new Error('Division by zero');
                }
                result = result / right;
            } else {
                result = result * right;
            }
        }

        return result;
    }

    private parseFactor(): number {
        const token = this.peek();

        if (!token) {
            throw new Error('Unexpected end of expression');
        }

        if (token.type === 'number') {
            this.consume();
            return token.value;
        }

        if (token.type === 'column') {
            this.consume();
            const columnName = token.value;
            const cellValue = this.rowData[columnName];

            if (cellValue === undefined) {
                throw new Error(`Column not found: ${columnName}`);
            }

            const num = parseFloat(cellValue);
            if (isNaN(num)) {
                throw new Error(`Non-numeric value in column [${columnName}]: "${cellValue}"`);
            }

            return num;
        }

        if (token.type === 'operator' && token.value === '(') {
            this.consume(); // consume '('
            const result = this.parseExpression();

            const closeParen = this.peek();
            if (closeParen?.type !== 'operator' || closeParen.value !== ')') {
                throw new Error('Missing closing parenthesis');
            }
            this.consume(); // consume ')'

            return result;
        }

        // Handle unary minus
        if (token.type === 'operator' && token.value === '-') {
            this.consume();
            return -this.parseFactor();
        }

        throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
    }
}

// =============================================================================
// Aggregate Functions
// =============================================================================

/**
 * Evaluate an aggregate function (SUM, AVG, COUNT, MIN, MAX) on selected columns.
 */
export function evaluateAggregate(
    functionType: FormulaFunctionType,
    columns: string[],
    rowData: RowData
): EvaluationResult {
    if (functionType === 'expression') {
        return { success: false, value: NA_VALUE, error: 'Use evaluateExpression for expression type' };
    }

    const values: number[] = [];

    for (const colName of columns) {
        const cellValue = rowData[colName];
        if (cellValue === undefined) {
            return { success: false, value: NA_VALUE, error: `Column not found: ${colName}` };
        }

        if (functionType === 'count') {
            // COUNT includes non-empty values
            if (cellValue.trim() !== '') {
                values.push(1);
            }
        } else {
            // SUM, AVG, MIN, MAX require numeric values
            // Return N/A immediately if any non-numeric value is found (for detecting broken references)
            const num = parseFloat(cellValue);
            if (isNaN(num)) {
                return {
                    success: false,
                    value: NA_VALUE,
                    error: `Non-numeric value in [${colName}]: "${cellValue}"`
                };
            }
            values.push(num);
        }
    }

    // Calculate aggregate
    let result: number;
    switch (functionType) {
        case 'sum':
            result = values.reduce((a, b) => a + b, 0);
            break;
        case 'avg':
            if (values.length === 0) {
                return { success: false, value: NA_VALUE, error: 'No numeric values for AVG' };
            }
            result = values.reduce((a, b) => a + b, 0) / values.length;
            break;
        case 'count':
            result = values.length;
            break;
        case 'min':
            if (values.length === 0) {
                return { success: false, value: NA_VALUE, error: 'No numeric values for MIN' };
            }
            result = Math.min(...values);
            break;
        case 'max':
            if (values.length === 0) {
                return { success: false, value: NA_VALUE, error: 'No numeric values for MAX' };
            }
            result = Math.max(...values);
            break;
        default:
            return { success: false, value: NA_VALUE, error: `Unknown function type: ${functionType}` };
    }

    const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(2);
    return { success: true, value: formatted };
}

// =============================================================================
// Lookup Function
// =============================================================================

/**
 * Find a table by its ID in the workbook.
 * Note: Parser stores custom metadata inside metadata.visual, so we check both locations.
 */
function findTableById(workbook: WorkbookJSON, tableId: number): TableJSON | null {
    for (const sheet of workbook.sheets) {
        for (const table of sheet.tables) {
            const metadata = table.metadata as TableMetadata | undefined;
            // Check metadata.visual.id (where parser puts custom metadata from markdown)
            const visual = metadata?.visual;
            if (visual?.id === tableId) {
                return table;
            }
            // Also check metadata.id as fallback
            if (metadata?.id === tableId) {
                return table;
            }
        }
    }
    return null;
}

/**
 * Evaluate a VLOOKUP-style lookup formula.
 */
export function evaluateLookup(
    formula: LookupFormula,
    localKeyValue: string,
    workbook: WorkbookJSON
): EvaluationResult {
    // Find source table
    const sourceTable = findTableById(workbook, formula.sourceTableId);
    if (!sourceTable) {
        return {
            success: false,
            value: NA_VALUE,
            error: `Source table not found: ID ${formula.sourceTableId}`
        };
    }

    // Find column indices in source table
    const headers = sourceTable.headers;
    const joinKeyIndex = headers.indexOf(formula.joinKeyRemote);
    const targetIndex = headers.indexOf(formula.targetField);

    if (joinKeyIndex === -1) {
        return {
            success: false,
            value: NA_VALUE,
            error: `Join key column not found: ${formula.joinKeyRemote}`
        };
    }

    if (targetIndex === -1) {
        return {
            success: false,
            value: NA_VALUE,
            error: `Target column not found: ${formula.targetField}`
        };
    }

    // Search for matching row
    for (const row of sourceTable.rows) {
        if (row[joinKeyIndex] === localKeyValue) {
            return { success: true, value: row[targetIndex] ?? '' };
        }
    }

    // Key not found
    return {
        success: false,
        value: NA_VALUE,
        error: `Key not found: "${localKeyValue}"`
    };
}

// =============================================================================
// High-Level Formula Evaluation
// =============================================================================

/**
 * Build row data from table headers and row values.
 */
export function buildRowData(headers: string[], row: string[]): RowData {
    const rowData: RowData = {};
    for (let i = 0; i < headers.length; i++) {
        rowData[headers[i]] = row[i] ?? '';
    }
    return rowData;
}

/**
 * Evaluate an arithmetic formula for a row.
 */
export function evaluateArithmeticFormula(formula: ArithmeticFormula, rowData: RowData): EvaluationResult {
    if (formula.functionType === 'expression') {
        if (!formula.expression) {
            return { success: false, value: NA_VALUE, error: 'Expression is empty' };
        }
        return evaluateExpression(formula.expression, rowData);
    } else {
        if (!formula.columns || formula.columns.length === 0) {
            return { success: false, value: NA_VALUE, error: 'No columns specified' };
        }
        return evaluateAggregate(formula.functionType, formula.columns, rowData);
    }
}
