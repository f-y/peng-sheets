import { describe, it, expect } from 'vitest';
import {
    tokenize,
    evaluateExpression,
    evaluateAggregate,
    evaluateLookup,
    evaluateArithmeticFormula,
    buildRowData,
    NA_VALUE,
    type RowData
} from '../../utils/formula-evaluator';
import type { ArithmeticFormula, LookupFormula } from '../../services/types';
import type { WorkbookJSON } from '../../types';

describe('FormulaEvaluator', () => {
    // =========================================================================
    // Tokenizer Tests
    // =========================================================================

    describe('tokenize', () => {
        it('should tokenize numbers', () => {
            expect(tokenize('42')).toEqual([{ type: 'number', value: 42 }]);
            expect(tokenize('3.14')).toEqual([{ type: 'number', value: 3.14 }]);
        });

        it('should tokenize operators', () => {
            expect(tokenize('+ - * /')).toEqual([
                { type: 'operator', value: '+' },
                { type: 'operator', value: '-' },
                { type: 'operator', value: '*' },
                { type: 'operator', value: '/' }
            ]);
        });

        it('should tokenize column references', () => {
            expect(tokenize('[Price]')).toEqual([{ type: 'column', value: 'Price' }]);
            expect(tokenize('[Unit Price]')).toEqual([{ type: 'column', value: 'Unit Price' }]);
        });

        it('should tokenize complex expressions', () => {
            expect(tokenize('[Qty] * [Price]')).toEqual([
                { type: 'column', value: 'Qty' },
                { type: 'operator', value: '*' },
                { type: 'column', value: 'Price' }
            ]);
        });

        it('should tokenize parentheses', () => {
            expect(tokenize('(1 + 2)')).toEqual([
                { type: 'operator', value: '(' },
                { type: 'number', value: 1 },
                { type: 'operator', value: '+' },
                { type: 'number', value: 2 },
                { type: 'operator', value: ')' }
            ]);
        });

        it('should throw on unclosed bracket', () => {
            expect(() => tokenize('[Price')).toThrow('Unclosed bracket');
        });

        it('should throw on unexpected character', () => {
            expect(() => tokenize('1 & 2')).toThrow('Unexpected character');
        });
    });

    // =========================================================================
    // Expression Evaluation Tests
    // =========================================================================

    describe('evaluateExpression', () => {
        const rowData: RowData = {
            Price: '100',
            Quantity: '5',
            'Tax Rate': '0.1'
        };

        it('should evaluate simple multiplication', () => {
            const result = evaluateExpression('[Price] * [Quantity]', rowData);
            expect(result.success).toBe(true);
            expect(result.value).toBe('500');
        });

        it('should evaluate expression with parentheses', () => {
            const result = evaluateExpression('[Price] * (1 + [Tax Rate])', rowData);
            expect(result.success).toBe(true);
            expect(result.value).toBe('110.00');
        });

        it('should evaluate addition and subtraction', () => {
            const result = evaluateExpression('[Price] + [Quantity] - 10', rowData);
            expect(result.success).toBe(true);
            expect(result.value).toBe('95');
        });

        it('should handle division', () => {
            const result = evaluateExpression('[Price] / [Quantity]', rowData);
            expect(result.success).toBe(true);
            expect(result.value).toBe('20');
        });

        it('should return N/A for division by zero', () => {
            const result = evaluateExpression('[Price] / 0', rowData);
            expect(result.success).toBe(false);
            expect(result.value).toBe(NA_VALUE);
            expect(result.error).toBe('Division by zero');
        });

        it('should return N/A for missing column', () => {
            const result = evaluateExpression('[Missing] * [Price]', rowData);
            expect(result.success).toBe(false);
            expect(result.value).toBe(NA_VALUE);
            expect(result.error).toContain('Column not found');
        });

        it('should return N/A for non-numeric value', () => {
            const dataWithText: RowData = { ...rowData, Price: 'abc' };
            const result = evaluateExpression('[Price] * [Quantity]', dataWithText);
            expect(result.success).toBe(false);
            expect(result.value).toBe(NA_VALUE);
            expect(result.error).toContain('Non-numeric');
        });

        it('should handle unary minus', () => {
            const result = evaluateExpression('-[Price]', rowData);
            expect(result.success).toBe(true);
            expect(result.value).toBe('-100');
        });

        it('should format decimal results', () => {
            const result = evaluateExpression('[Price] / 3', rowData);
            expect(result.success).toBe(true);
            expect(result.value).toBe('33.33');
        });
    });

    // =========================================================================
    // Aggregate Function Tests
    // =========================================================================

    describe('evaluateAggregate', () => {
        const rowData: RowData = {
            Col1: '10',
            Col2: '20',
            Col3: '30',
            Empty: '',
            Text: 'abc'
        };

        describe('SUM', () => {
            it('should sum numeric columns', () => {
                const result = evaluateAggregate('sum', ['Col1', 'Col2', 'Col3'], rowData);
                expect(result.success).toBe(true);
                expect(result.value).toBe('60');
            });

            it('should return 0 for empty column list', () => {
                const result = evaluateAggregate('sum', [], rowData);
                expect(result.success).toBe(true);
                expect(result.value).toBe('0');
            });
        });

        describe('AVG', () => {
            it('should average numeric columns', () => {
                const result = evaluateAggregate('avg', ['Col1', 'Col2', 'Col3'], rowData);
                expect(result.success).toBe(true);
                expect(result.value).toBe('20');
            });

            it('should return N/A for empty values', () => {
                const result = evaluateAggregate('avg', [], rowData);
                expect(result.success).toBe(false);
                expect(result.value).toBe(NA_VALUE);
            });
        });

        describe('COUNT', () => {
            it('should count non-empty values', () => {
                const result = evaluateAggregate('count', ['Col1', 'Col2', 'Empty'], rowData);
                expect(result.success).toBe(true);
                expect(result.value).toBe('2');
            });

            it('should count text values', () => {
                const result = evaluateAggregate('count', ['Col1', 'Text'], rowData);
                expect(result.success).toBe(true);
                expect(result.value).toBe('2');
            });
        });

        describe('MIN', () => {
            it('should find minimum value', () => {
                const result = evaluateAggregate('min', ['Col1', 'Col2', 'Col3'], rowData);
                expect(result.success).toBe(true);
                expect(result.value).toBe('10');
            });
        });

        describe('MAX', () => {
            it('should find maximum value', () => {
                const result = evaluateAggregate('max', ['Col1', 'Col2', 'Col3'], rowData);
                expect(result.success).toBe(true);
                expect(result.value).toBe('30');
            });
        });

        it('should return N/A when all columns are invalid', () => {
            const result = evaluateAggregate('sum', ['Missing1', 'Missing2'], rowData);
            expect(result.success).toBe(false);
            expect(result.value).toBe(NA_VALUE);
        });
    });

    // =========================================================================
    // Lookup Tests
    // =========================================================================

    describe('evaluateLookup', () => {
        // Use type assertion for minimal mock data
        const mockWorkbook = {
            sheets: [
                {
                    name: 'Products',
                    tables: [
                        {
                            name: 'ProductList',
                            headers: ['id', 'name', 'price'],
                            rows: [
                                ['P001', 'Widget', '100'],
                                ['P002', 'Gadget', '200'],
                                ['P003', 'Doohickey', '300']
                            ],
                            metadata: { id: 0 }
                        }
                    ]
                }
            ]
        } as unknown as WorkbookJSON;

        it('should find matching row and return target value', () => {
            const formula: LookupFormula = {
                type: 'lookup',
                sourceTableId: 0,
                joinKeyLocal: 'product_id',
                joinKeyRemote: 'id',
                targetField: 'price'
            };
            const result = evaluateLookup(formula, 'P002', mockWorkbook);
            expect(result.success).toBe(true);
            expect(result.value).toBe('200');
        });

        it('should return N/A when key not found', () => {
            const formula: LookupFormula = {
                type: 'lookup',
                sourceTableId: 0,
                joinKeyLocal: 'product_id',
                joinKeyRemote: 'id',
                targetField: 'price'
            };
            const result = evaluateLookup(formula, 'P999', mockWorkbook);
            expect(result.success).toBe(false);
            expect(result.value).toBe(NA_VALUE);
            expect(result.error).toContain('Key not found');
        });

        it('should return N/A when source table not found', () => {
            const formula: LookupFormula = {
                type: 'lookup',
                sourceTableId: 999,
                joinKeyLocal: 'product_id',
                joinKeyRemote: 'id',
                targetField: 'price'
            };
            const result = evaluateLookup(formula, 'P001', mockWorkbook);
            expect(result.success).toBe(false);
            expect(result.value).toBe(NA_VALUE);
            expect(result.error).toContain('Source table not found');
        });

        it('should return N/A when join key column not found', () => {
            const formula: LookupFormula = {
                type: 'lookup',
                sourceTableId: 0,
                joinKeyLocal: 'product_id',
                joinKeyRemote: 'missing_column',
                targetField: 'price'
            };
            const result = evaluateLookup(formula, 'P001', mockWorkbook);
            expect(result.success).toBe(false);
            expect(result.value).toBe(NA_VALUE);
            expect(result.error).toContain('Join key column not found');
        });
    });

    // =========================================================================
    // Helper Function Tests
    // =========================================================================

    describe('buildRowData', () => {
        it('should build row data from headers and values', () => {
            const headers = ['Name', 'Price', 'Quantity'];
            const row = ['Widget', '100', '5'];
            const result = buildRowData(headers, row);
            expect(result).toEqual({
                Name: 'Widget',
                Price: '100',
                Quantity: '5'
            });
        });

        it('should handle missing values', () => {
            const headers = ['A', 'B', 'C'];
            const row = ['1'];
            const result = buildRowData(headers, row);
            expect(result).toEqual({ A: '1', B: '', C: '' });
        });
    });

    describe('evaluateArithmeticFormula', () => {
        const rowData: RowData = { A: '10', B: '20', C: '30' };

        it('should evaluate expression formula', () => {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: 'expression',
                expression: '[A] + [B]'
            };
            const result = evaluateArithmeticFormula(formula, rowData);
            expect(result.success).toBe(true);
            expect(result.value).toBe('30');
        });

        it('should evaluate aggregate formula', () => {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: 'sum',
                columns: ['A', 'B', 'C']
            };
            const result = evaluateArithmeticFormula(formula, rowData);
            expect(result.success).toBe(true);
            expect(result.value).toBe('60');
        });

        it('should return N/A for empty expression', () => {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: 'expression',
                expression: ''
            };
            const result = evaluateArithmeticFormula(formula, rowData);
            expect(result.success).toBe(false);
            expect(result.value).toBe(NA_VALUE);
        });
    });
});
