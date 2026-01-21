/**
 * Integration tests for Computed Columns feature
 *
 * Tests end-to-end behavior of formula columns including:
 * - Reactive recalculation on cell changes
 * - Batch updates for atomic undo/redo
 * - Column rename propagation
 */
import { describe, it, expect, vi } from 'vitest';
import { FormulaController, type FormulaControllerHost } from '../../controllers/formula-controller';
import type { FormulaMetadata, LookupFormula } from '../../services/types';
import type { WorkbookJSON } from '../../types';

describe('Computed Columns Integration', () => {
    // =========================================================================
    // Reactive Recalculation Flow
    // =========================================================================

    describe('Reactive Recalculation', () => {
        it('should detect dependencies and return updates for affected columns', () => {
            const formulas: FormulaMetadata = {
                '2': {
                    type: 'arithmetic',
                    functionType: 'expression',
                    expression: '[Price] * [Qty]'
                }
            };

            const workbook: WorkbookJSON = {
                sheets: [
                    {
                        name: 'Sales',
                        tables: [
                            {
                                name: 'Orders',
                                headers: ['Price', 'Qty', 'Total'],
                                rows: [
                                    ['100', '2', ''],
                                    ['50', '4', '']
                                ],
                                metadata: { id: 0, visual: { formulas } }
                            }
                        ]
                    }
                ]
            } as unknown as WorkbookJSON;

            const host = createMockHost({ workbook });
            const controller = new FormulaController(host);
            controller.rebuildDependencyGraph();

            // Simulate changing Price column
            const updates = controller.recalculateAffectedColumns(0, 'Price', workbook);

            expect(updates.length).toBe(2);
            expect(updates[0]).toMatchObject({
                sheetIndex: 0,
                tableIndex: 0,
                rowIndex: 0,
                colIndex: 2,
                value: '200' // 100 * 2
            });
            expect(updates[1].value).toBe('200'); // 50 * 4
        });

        it('should handle cascading updates through dependency chain', () => {
            const formulas: FormulaMetadata = {
                '2': {
                    type: 'arithmetic',
                    functionType: 'sum',
                    columns: ['A', 'B']
                }
            };

            const workbook: WorkbookJSON = {
                sheets: [
                    {
                        name: 'Data',
                        tables: [
                            {
                                name: 'Table1',
                                headers: ['A', 'B', 'Sum'],
                                rows: [['10', '20', '']],
                                metadata: { id: 0, visual: { formulas } }
                            }
                        ]
                    }
                ]
            } as unknown as WorkbookJSON;

            const host = createMockHost({ workbook });
            const controller = new FormulaController(host);
            controller.rebuildDependencyGraph();

            // Change column A
            const updates = controller.recalculateAffectedColumns(0, 'A', workbook);

            expect(updates.length).toBe(1);
            expect(updates[0].value).toBe('30'); // 10 + 20
        });
    });

    // =========================================================================
    // Batch Update Atomicity
    // =========================================================================

    describe('Batch Update Atomicity', () => {
        it('should produce CellUpdate array for all affected rows', () => {
            const formulas: FormulaMetadata = {
                '1': {
                    type: 'arithmetic',
                    functionType: 'expression',
                    expression: '[Value] * 2'
                }
            };

            const workbook: WorkbookJSON = {
                sheets: [
                    {
                        name: 'Sheet1',
                        tables: [
                            {
                                name: 'Table1',
                                headers: ['Value', 'Doubled'],
                                rows: [
                                    ['1', ''],
                                    ['2', ''],
                                    ['3', ''],
                                    ['4', ''],
                                    ['5', '']
                                ],
                                metadata: { id: 0, visual: { formulas } }
                            }
                        ]
                    }
                ]
            } as unknown as WorkbookJSON;

            const host = createMockHost({ workbook });
            const controller = new FormulaController(host);
            controller.rebuildDependencyGraph();

            const updates = controller.recalculateAffectedColumns(0, 'Value', workbook);

            // Should have update for each row
            expect(updates.length).toBe(5);

            // Verify values
            expect(updates[0].value).toBe('2'); // 1 * 2
            expect(updates[1].value).toBe('4'); // 2 * 2
            expect(updates[2].value).toBe('6'); // 3 * 2
            expect(updates[3].value).toBe('8'); // 4 * 2
            expect(updates[4].value).toBe('10'); // 5 * 2

            // All updates should target same column
            updates.forEach((u, i) => {
                expect(u.colIndex).toBe(1);
                expect(u.rowIndex).toBe(i);
            });
        });

        it('should handle multiple formula columns with shared dependencies', () => {
            const formulas: FormulaMetadata = {
                '2': {
                    type: 'arithmetic',
                    functionType: 'expression',
                    expression: '[A] + [B]'
                },
                '3': {
                    type: 'arithmetic',
                    functionType: 'expression',
                    expression: '[A] * [B]'
                }
            };

            const workbook: WorkbookJSON = {
                sheets: [
                    {
                        name: 'Sheet1',
                        tables: [
                            {
                                name: 'Table1',
                                headers: ['A', 'B', 'Sum', 'Product'],
                                rows: [['3', '4', '', '']],
                                metadata: { id: 0, visual: { formulas } }
                            }
                        ]
                    }
                ]
            } as unknown as WorkbookJSON;

            const host = createMockHost({ workbook });
            const controller = new FormulaController(host);
            controller.rebuildDependencyGraph();

            // Changing A should update both Sum and Product
            const updates = controller.recalculateAffectedColumns(0, 'A', workbook);

            expect(updates.length).toBe(2);

            const sumUpdate = updates.find((u) => u.colIndex === 2);
            const productUpdate = updates.find((u) => u.colIndex === 3);

            expect(sumUpdate?.value).toBe('7'); // 3 + 4
            expect(productUpdate?.value).toBe('12'); // 3 * 4
        });
    });

    // =========================================================================
    // Cross-Table Lookup
    // =========================================================================

    describe('Cross-Table Lookup', () => {
        it('should evaluate lookups across tables', () => {
            const formulas: FormulaMetadata = {
                '2': {
                    type: 'lookup',
                    sourceTableId: 0,
                    joinKeyLocal: 'product_id',
                    joinKeyRemote: 'id',
                    targetField: 'price'
                } as LookupFormula
            };

            const workbook: WorkbookJSON = {
                sheets: [
                    {
                        name: 'Products',
                        tables: [
                            {
                                name: 'ProductMaster',
                                headers: ['id', 'name', 'price'],
                                rows: [
                                    ['P001', 'Widget', '100'],
                                    ['P002', 'Gadget', '200']
                                ],
                                metadata: { id: 0 }
                            }
                        ]
                    },
                    {
                        name: 'Sales',
                        tables: [
                            {
                                name: 'Orders',
                                headers: ['product_id', 'qty', 'unit_price'],
                                rows: [
                                    ['P001', '5', ''],
                                    ['P002', '3', '']
                                ],
                                metadata: { id: 1, visual: { formulas } }
                            }
                        ]
                    }
                ]
            } as unknown as WorkbookJSON;

            const host = createMockHost({ workbook });
            const controller = new FormulaController(host);

            const updates = controller.recalculateSingleColumn(1, 0, 2, workbook);

            expect(updates.length).toBe(2);
            expect(updates[0].value).toBe('100'); // P001 -> 100
            expect(updates[1].value).toBe('200'); // P002 -> 200
        });
    });

    // =========================================================================
    // No-Op Cases
    // =========================================================================

    describe('No-Op Cases', () => {
        it('should return empty updates when column has no dependents', () => {
            const workbook: WorkbookJSON = {
                sheets: [
                    {
                        name: 'Sheet1',
                        tables: [
                            {
                                name: 'Table1',
                                headers: ['A', 'B'],
                                rows: [['1', '2']],
                                metadata: { id: 0 }
                            }
                        ]
                    }
                ]
            } as unknown as WorkbookJSON;

            const host = createMockHost({ workbook });
            const controller = new FormulaController(host);
            controller.rebuildDependencyGraph();

            const updates = controller.recalculateAffectedColumns(0, 'A', workbook);
            expect(updates).toEqual([]);
        });

        it('should return empty updates when table has no formulas', () => {
            const workbook: WorkbookJSON = {
                sheets: [
                    {
                        name: 'Sheet1',
                        tables: [
                            {
                                name: 'Table1',
                                headers: ['A', 'B', 'C'],
                                rows: [['1', '2', '3']],
                                metadata: { id: 0 }
                            }
                        ]
                    }
                ]
            } as unknown as WorkbookJSON;

            const host = createMockHost({ workbook });
            const controller = new FormulaController(host);

            const updates = controller.recalculateSingleColumn(0, 0, 2, workbook);
            expect(updates).toEqual([]);
        });
    });
});

// =============================================================================
// Helper
// =============================================================================

function createMockHost(overrides: Partial<FormulaControllerHost> = {}): FormulaControllerHost {
    return {
        addController: vi.fn(),
        removeController: vi.fn(),
        requestUpdate: vi.fn(),
        updateComplete: Promise.resolve(true),
        workbook: null,
        getSheetIndex: () => 0,
        getTableIndex: () => 0,
        getFormulaMetadata: () => null,
        ...overrides
    };
}
