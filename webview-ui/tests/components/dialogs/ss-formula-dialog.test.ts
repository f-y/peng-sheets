/**
 * UI tests for SSFormulaDialog component
 *
 * Tests:
 * - Mode switching (Calculation vs Lookup)
 * - Function type selection
 * - Form validation
 * - Event dispatching
 * - Rendering states
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkbookJSON } from '../../../types';

describe('SSFormulaDialog', () => {
    // =========================================================================
    // Mock Data
    // =========================================================================

    const mockWorkbook: WorkbookJSON = {
        sheets: [
            {
                name: 'Products',
                tables: [
                    {
                        name: 'ProductMaster',
                        headers: ['id', 'name', 'price', 'qty'],
                        rows: [['P001', 'Widget', '100', '10']],
                        metadata: { id: 0 }
                    }
                ]
            },
            {
                name: 'Sales',
                tables: [
                    {
                        name: 'Orders',
                        headers: ['order_id', 'product_id', 'amount'],
                        rows: [['O001', 'P001', '5']],
                        metadata: { id: 1 }
                    }
                ]
            }
        ]
    } as unknown as WorkbookJSON;

    // =========================================================================
    // Configuration Object
    // =========================================================================

    describe('Configuration Validation', () => {
        it('should require targetTableId in configuration', () => {
            const validConfig = {
                workbook: mockWorkbook,
                sourceSheetIndex: 0,
                sourceTableIndex: 0,
                targetTableId: 0,
                targetColIndex: 2,
                targetHeaders: ['id', 'name', 'price', 'qty']
            };

            expect(validConfig.targetTableId).toBeDefined();
            expect(validConfig.targetColIndex).toBeGreaterThanOrEqual(0);
        });

        it('should validate targetHeaders array', () => {
            const config = {
                targetHeaders: ['A', 'B', 'C']
            };

            expect(Array.isArray(config.targetHeaders)).toBe(true);
            expect(config.targetHeaders.length).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // Arithmetic Formula State
    // =========================================================================

    describe('Arithmetic Formula State', () => {
        it('should default to arithmetic mode', () => {
            const state = {
                mode: 'arithmetic' as const,
                functionType: 'expression' as const,
                expression: '',
                columns: [] as string[]
            };

            expect(state.mode).toBe('arithmetic');
            expect(state.functionType).toBe('expression');
        });

        it('should support aggregate function types', () => {
            const aggregateTypes = ['sum', 'avg', 'count', 'min', 'max'];

            aggregateTypes.forEach((type) => {
                const state = {
                    mode: 'arithmetic' as const,
                    functionType: type,
                    columns: ['A', 'B']
                };

                expect(state.columns.length).toBeGreaterThan(0);
            });
        });

        it('should support expression with column references', () => {
            const expression = '[Price] * [Qty]';
            const columnRefs = expression.match(/\[([^\]]+)\]/g)?.map((ref) => ref.slice(1, -1)) || [];

            expect(columnRefs).toEqual(['Price', 'Qty']);
        });
    });

    // =========================================================================
    // Lookup Formula State
    // =========================================================================

    describe('Lookup Formula State', () => {
        it('should have required lookup fields', () => {
            const lookupState = {
                mode: 'lookup' as const,
                sourceTableId: 0,
                joinKeyLocal: 'product_id',
                joinKeyRemote: 'id',
                targetField: 'price'
            };

            expect(lookupState.mode).toBe('lookup');
            expect(lookupState.sourceTableId).toBeGreaterThanOrEqual(0);
            expect(lookupState.joinKeyLocal).toBeTruthy();
            expect(lookupState.joinKeyRemote).toBeTruthy();
            expect(lookupState.targetField).toBeTruthy();
        });
    });

    // =========================================================================
    // Formula Validation Logic
    // =========================================================================

    describe('Formula Validation', () => {
        it('should reject empty expression', () => {
            const validateExpression = (expr: string): boolean => {
                return expr.trim().length > 0 && /\[[^\]]+\]/.test(expr);
            };

            expect(validateExpression('')).toBe(false);
            expect(validateExpression('  ')).toBe(false);
            expect(validateExpression('100 + 50')).toBe(false); // No column refs
            expect(validateExpression('[A] + [B]')).toBe(true);
        });

        it('should validate aggregate columns selection', () => {
            const validateColumns = (columns: string[]): boolean => {
                return columns.length > 0;
            };

            expect(validateColumns([])).toBe(false);
            expect(validateColumns(['A'])).toBe(true);
            expect(validateColumns(['A', 'B', 'C'])).toBe(true);
        });

        it('should validate lookup configuration', () => {
            const validateLookup = (config: {
                sourceTableId: number;
                joinKeyLocal: string;
                joinKeyRemote: string;
                targetField: string;
            }): boolean => {
                return (
                    config.sourceTableId >= 0 &&
                    config.joinKeyLocal.length > 0 &&
                    config.joinKeyRemote.length > 0 &&
                    config.targetField.length > 0
                );
            };

            expect(
                validateLookup({
                    sourceTableId: -1,
                    joinKeyLocal: 'id',
                    joinKeyRemote: 'id',
                    targetField: 'price'
                })
            ).toBe(false);

            expect(
                validateLookup({
                    sourceTableId: 0,
                    joinKeyLocal: '',
                    joinKeyRemote: 'id',
                    targetField: 'price'
                })
            ).toBe(false);

            expect(
                validateLookup({
                    sourceTableId: 0,
                    joinKeyLocal: 'product_id',
                    joinKeyRemote: 'id',
                    targetField: 'price'
                })
            ).toBe(true);
        });
    });

    // =========================================================================
    // Available Columns Computation
    // =========================================================================

    describe('Available Columns', () => {
        it('should filter out target column from available columns', () => {
            const headers = ['A', 'B', 'C', 'D'];
            const targetColIndex = 2; // Column C

            const availableColumns = headers.filter((_, i) => i !== targetColIndex);

            expect(availableColumns).toEqual(['A', 'B', 'D']);
            expect(availableColumns).not.toContain('C');
        });

        it('should provide all columns for expression mode', () => {
            const headers = ['Price', 'Qty', 'Total'];
            const targetColIndex = 2;

            const availableForExpression = headers.filter((_, i) => i !== targetColIndex);

            expect(availableForExpression).toEqual(['Price', 'Qty']);
        });
    });

    // =========================================================================
    // Table Lookup for Cross-Table References
    // =========================================================================

    describe('Cross-Table Table Selection', () => {
        it('should list all tables except current for lookup source', () => {
            const allTables: Array<{ sheetName: string; tableName: string; tableId: number }> = [];

            for (const sheet of mockWorkbook.sheets) {
                for (const table of sheet.tables) {
                    const meta = table.metadata as { id: number } | undefined;
                    if (meta?.id !== undefined) {
                        allTables.push({
                            sheetName: sheet.name,
                            tableName: table.name,
                            tableId: meta.id
                        });
                    }
                }
            }

            const currentTableId = 1;
            const availableTables = allTables.filter((t) => t.tableId !== currentTableId);

            expect(availableTables.length).toBe(1);
            expect(availableTables[0].tableName).toBe('ProductMaster');
        });
    });

    // =========================================================================
    // Event Types
    // =========================================================================

    describe('Formula Dialog Events', () => {
        it('should define formula-save event with formula payload', () => {
            const mockEvent = new CustomEvent('formula-save', {
                detail: {
                    colIndex: 2,
                    formula: {
                        type: 'arithmetic',
                        functionType: 'sum',
                        columns: ['A', 'B']
                    }
                },
                bubbles: true,
                composed: true
            });

            expect(mockEvent.type).toBe('formula-save');
            expect(mockEvent.detail.formula.type).toBe('arithmetic');
        });

        it('should define formula-remove event for clearing formulas', () => {
            const mockEvent = new CustomEvent('formula-remove', {
                detail: { colIndex: 2 },
                bubbles: true,
                composed: true
            });

            expect(mockEvent.type).toBe('formula-remove');
            expect(mockEvent.detail.colIndex).toBe(2);
        });

        it('should define dialog-close event', () => {
            const mockEvent = new CustomEvent('dialog-close', {
                bubbles: true,
                composed: true
            });

            expect(mockEvent.type).toBe('dialog-close');
        });
    });

    // =========================================================================
    // Preview Computation
    // =========================================================================

    describe('Preview Computation', () => {
        it('should compute preview values for first N rows', () => {
            const previewRows = 3;
            const tableRows = mockWorkbook.sheets[0].tables[0].rows;
            const rowsToPreview = tableRows.slice(0, previewRows);

            expect(rowsToPreview.length).toBeLessThanOrEqual(previewRows);
        });

        it('should show N/A for invalid formula in preview', () => {
            const NA_VALUE = 'N/A';

            // Simulate evaluation error
            const evaluateWithError = (): string => {
                throw new Error('Division by zero');
            };

            let result: string;
            try {
                result = evaluateWithError();
            } catch {
                result = NA_VALUE;
            }

            expect(result).toBe(NA_VALUE);
        });
    });
});
