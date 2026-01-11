/**
 * Unit tests for FormulaController
 *
 * Tests:
 * - Dependency graph building and querying
 * - Formula recalculation logic
 * - Formula validation
 * - Column reference parsing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormulaController, type FormulaControllerHost, type CellUpdate } from '../../controllers/formula-controller';
import type { FormulaMetadata, ArithmeticFormula, LookupFormula } from '../../services/types';
import type { WorkbookJSON, TableJSON } from '../../types';

// =============================================================================
// Mock Helper
// =============================================================================

/**
 * Create a mock FormulaControllerHost for testing
 */
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

/**
 * Create a mock workbook with tables containing formulas
 */
function createMockWorkbook(
    options: {
        tableId?: number;
        formulas?: FormulaMetadata;
        headers?: string[];
        rows?: string[][];
    } = {}
): WorkbookJSON {
    const { tableId = 0, formulas, headers = ['A', 'B', 'C'], rows = [['1', '2', '3']] } = options;

    return {
        sheets: [
            {
                name: 'Sheet1',
                tables: [
                    {
                        name: 'Table1',
                        headers,
                        rows,
                        metadata: {
                            id: tableId,
                            visual: formulas ? { formulas } : undefined
                        }
                    }
                ]
            }
        ]
    } as unknown as WorkbookJSON;
}

// =============================================================================
// Tests
// =============================================================================

describe('FormulaController', () => {
    let host: FormulaControllerHost;
    let controller: FormulaController;

    beforeEach(() => {
        host = createMockHost();
        controller = new FormulaController(host);
    });

    // =========================================================================
    // Constructor and Lifecycle
    // =========================================================================

    describe('constructor', () => {
        it('should register with host', () => {
            expect(host.addController).toHaveBeenCalledWith(controller);
        });
    });

    describe('hostConnected', () => {
        it('should rebuild dependency graph on connect', () => {
            const formulas: FormulaMetadata = {
                '2': {
                    type: 'arithmetic',
                    functionType: 'expression',
                    expression: '[A] * [B]'
                }
            };
            const workbook = createMockWorkbook({ formulas });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            controller.hostConnected();

            // Check dependencies are registered
            const deps = controller.getDependentColumns(0, 'A');
            expect(deps.length).toBeGreaterThan(0);
        });
    });

    describe('hostDisconnected', () => {
        it('should clear dependency graph on disconnect', () => {
            const formulas: FormulaMetadata = {
                '2': {
                    type: 'arithmetic',
                    functionType: 'expression',
                    expression: '[A] * [B]'
                }
            };
            const workbook = createMockWorkbook({ formulas });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            controller.hostConnected();
            controller.hostDisconnected();

            const deps = controller.getDependentColumns(0, 'A');
            expect(deps).toEqual([]);
        });
    });

    // =========================================================================
    // Dependency Graph
    // =========================================================================

    describe('rebuildDependencyGraph', () => {
        it('should register dependencies for expression formulas', () => {
            const formulas: FormulaMetadata = {
                '2': {
                    type: 'arithmetic',
                    functionType: 'expression',
                    expression: '[A] * [B]'
                }
            };
            const workbook = createMockWorkbook({ formulas });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            controller.rebuildDependencyGraph();

            const depsA = controller.getDependentColumns(0, 'A');
            const depsB = controller.getDependentColumns(0, 'B');
            expect(depsA).toContainEqual({ tableId: 0, colIndex: 2 });
            expect(depsB).toContainEqual({ tableId: 0, colIndex: 2 });
        });

        it('should register dependencies for aggregate formulas', () => {
            const formulas: FormulaMetadata = {
                '3': {
                    type: 'arithmetic',
                    functionType: 'sum',
                    columns: ['A', 'B', 'C']
                }
            };
            const workbook = createMockWorkbook({ formulas, headers: ['A', 'B', 'C', 'Total'] });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            controller.rebuildDependencyGraph();

            expect(controller.getDependentColumns(0, 'A')).toContainEqual({ tableId: 0, colIndex: 3 });
            expect(controller.getDependentColumns(0, 'B')).toContainEqual({ tableId: 0, colIndex: 3 });
            expect(controller.getDependentColumns(0, 'C')).toContainEqual({ tableId: 0, colIndex: 3 });
        });

        it('should register dependencies for lookup formulas', () => {
            const formulas: FormulaMetadata = {
                '2': {
                    type: 'lookup',
                    sourceTableId: 1,
                    joinKeyLocal: 'id',
                    joinKeyRemote: 'product_id',
                    targetField: 'price'
                } as LookupFormula
            };
            const workbook = createMockWorkbook({ formulas, headers: ['id', 'name', 'price'] });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            controller.rebuildDependencyGraph();

            // Local join key dependency
            const localDeps = controller.getDependentColumns(0, 'id');
            expect(localDeps).toContainEqual({ tableId: 0, colIndex: 2 });
        });
    });

    describe('getDependentColumns', () => {
        it('should return empty array for non-dependent column', () => {
            const workbook = createMockWorkbook();
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            controller.rebuildDependencyGraph();

            const deps = controller.getDependentColumns(0, 'NonExistent');
            expect(deps).toEqual([]);
        });
    });

    // =========================================================================
    // Column Reference Parsing
    // =========================================================================

    describe('parseColumnReferences', () => {
        it('should parse single column reference', () => {
            const refs = controller.parseColumnReferences('[Price]');
            expect(refs).toEqual(['Price']);
        });

        it('should parse multiple column references', () => {
            const refs = controller.parseColumnReferences('[A] + [B] * [C]');
            expect(refs).toEqual(['A', 'B', 'C']);
        });

        it('should handle column names with spaces', () => {
            const refs = controller.parseColumnReferences('[Unit Price] * [Qty]');
            expect(refs).toEqual(['Unit Price', 'Qty']);
        });

        it('should return empty array for no references', () => {
            const refs = controller.parseColumnReferences('100 + 50');
            expect(refs).toEqual([]);
        });
    });

    // =========================================================================
    // Formula Checking
    // =========================================================================

    describe('isFormulaColumn', () => {
        it('should return true for formula column', () => {
            const formulas: FormulaMetadata = {
                '2': { type: 'arithmetic', functionType: 'sum', columns: ['A', 'B'] }
            };
            host = createMockHost({
                getFormulaMetadata: () => formulas
            });
            controller = new FormulaController(host);

            expect(controller.isFormulaColumn(2)).toBe(true);
        });

        it('should return false for non-formula column', () => {
            const formulas: FormulaMetadata = {
                '2': { type: 'arithmetic', functionType: 'sum', columns: ['A', 'B'] }
            };
            host = createMockHost({
                getFormulaMetadata: () => formulas
            });
            controller = new FormulaController(host);

            expect(controller.isFormulaColumn(0)).toBe(false);
            expect(controller.isFormulaColumn(1)).toBe(false);
        });

        it('should return false when no formulas exist', () => {
            host = createMockHost({
                getFormulaMetadata: () => null
            });
            controller = new FormulaController(host);

            expect(controller.isFormulaColumn(0)).toBe(false);
        });
    });

    describe('getFormula', () => {
        it('should return formula for column', () => {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: 'sum',
                columns: ['A', 'B']
            };
            const formulas: FormulaMetadata = { '2': formula };
            host = createMockHost({
                getFormulaMetadata: () => formulas
            });
            controller = new FormulaController(host);

            expect(controller.getFormula(2)).toEqual(formula);
        });

        it('should return null for non-formula column', () => {
            host = createMockHost({
                getFormulaMetadata: () => ({})
            });
            controller = new FormulaController(host);

            expect(controller.getFormula(0)).toBeNull();
        });
    });

    // =========================================================================
    // Formula Validation
    // =========================================================================

    describe('validateFormula', () => {
        it('should validate expression formula with valid expression', () => {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: 'expression',
                expression: '[A] * [B]'
            };

            const result = controller.validateFormula(formula);
            expect(result.valid).toBe(true);
        });

        it('should reject empty expression', () => {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: 'expression',
                expression: ''
            };

            const result = controller.validateFormula(formula);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('empty');
        });

        it('should reject expression without column references', () => {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: 'expression',
                expression: '100 + 50'
            };

            const result = controller.validateFormula(formula);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('No column references');
        });

        it('should validate aggregate formula with columns', () => {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: 'sum',
                columns: ['A', 'B']
            };

            const result = controller.validateFormula(formula);
            expect(result.valid).toBe(true);
        });

        it('should reject aggregate formula with no columns', () => {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: 'sum',
                columns: []
            };

            const result = controller.validateFormula(formula);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('No columns');
        });

        it('should validate lookup formula', () => {
            const workbook = createMockWorkbook({ tableId: 0 });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            const formula: LookupFormula = {
                type: 'lookup',
                sourceTableId: 0,
                joinKeyLocal: 'id',
                joinKeyRemote: 'product_id',
                targetField: 'price'
            };

            const result = controller.validateFormula(formula);
            expect(result.valid).toBe(true);
        });

        it('should reject lookup formula with invalid source table', () => {
            const workbook = createMockWorkbook();
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            const formula: LookupFormula = {
                type: 'lookup',
                sourceTableId: -1,
                joinKeyLocal: 'id',
                joinKeyRemote: 'product_id',
                targetField: 'price'
            };

            const result = controller.validateFormula(formula);
            expect(result.valid).toBe(false);
        });
    });

    // =========================================================================
    // Table Lookup
    // =========================================================================

    describe('findTableById', () => {
        it('should find table by ID', () => {
            const workbook = createMockWorkbook({ tableId: 42 });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            const table = controller.findTableById(42);
            expect(table).not.toBeNull();
            expect(table?.name).toBe('Table1');
        });

        it('should return null for non-existent ID', () => {
            const workbook = createMockWorkbook({ tableId: 0 });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            const table = controller.findTableById(999);
            expect(table).toBeNull();
        });

        it('should return null when workbook is null', () => {
            host = createMockHost({ workbook: null });
            controller = new FormulaController(host);

            expect(controller.findTableById(0)).toBeNull();
        });
    });

    describe('findTableLocation', () => {
        it('should return sheet and table indices', () => {
            const workbook = createMockWorkbook({ tableId: 5 });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            const location = controller.findTableLocation(5);
            expect(location).toEqual({ sheetIndex: 0, tableIndex: 0 });
        });

        it('should return null for non-existent table', () => {
            const workbook = createMockWorkbook({ tableId: 0 });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            expect(controller.findTableLocation(999)).toBeNull();
        });
    });

    // =========================================================================
    // Recalculation
    // =========================================================================

    describe('recalculateAffectedColumns', () => {
        it('should return empty array when no dependents exist', () => {
            const workbook = createMockWorkbook();
            host = createMockHost({ workbook });
            controller = new FormulaController(host);
            controller.rebuildDependencyGraph();

            const updates = controller.recalculateAffectedColumns(0, 'A', workbook);
            expect(updates).toEqual([]);
        });

        it('should calculate updates for dependent columns', () => {
            const formulas: FormulaMetadata = {
                '2': {
                    type: 'arithmetic',
                    functionType: 'expression',
                    expression: '[A] * [B]'
                }
            };
            const workbook = createMockWorkbook({
                tableId: 0,
                formulas,
                headers: ['A', 'B', 'Result'],
                rows: [
                    ['10', '2', ''],
                    ['5', '3', '']
                ]
            });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);
            controller.rebuildDependencyGraph();

            const updates = controller.recalculateAffectedColumns(0, 'A', workbook);

            expect(updates.length).toBe(2); // 2 rows to update
            expect(updates[0]).toMatchObject({
                sheetIndex: 0,
                tableIndex: 0,
                rowIndex: 0,
                colIndex: 2
            });
            expect(updates[0].value).toBe('20'); // 10 * 2
            expect(updates[1].value).toBe('15'); // 5 * 3
        });
    });

    describe('recalculateSingleColumn', () => {
        it('should calculate all rows for a formula column', () => {
            const formulas: FormulaMetadata = {
                '2': {
                    type: 'arithmetic',
                    functionType: 'sum',
                    columns: ['A', 'B']
                }
            };
            const workbook = createMockWorkbook({
                tableId: 0,
                formulas,
                headers: ['A', 'B', 'Sum'],
                rows: [
                    ['1', '2', ''],
                    ['3', '4', ''],
                    ['5', '6', '']
                ]
            });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            const updates = controller.recalculateSingleColumn(0, 0, 2, workbook);

            expect(updates.length).toBe(3);
            expect(updates[0].value).toBe('3'); // 1 + 2
            expect(updates[1].value).toBe('7'); // 3 + 4
            expect(updates[2].value).toBe('11'); // 5 + 6
        });

        it('should return empty array for non-formula column', () => {
            const workbook = createMockWorkbook({ headers: ['A', 'B'] });
            host = createMockHost({ workbook });
            controller = new FormulaController(host);

            const updates = controller.recalculateSingleColumn(0, 0, 0, workbook);
            expect(updates).toEqual([]);
        });
    });

    // =========================================================================
    // getFormulaForTable
    // =========================================================================

    describe('getFormulaForTable', () => {
        it('should return formula for column in table', () => {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: 'sum',
                columns: ['A', 'B']
            };
            const formulas: FormulaMetadata = { '2': formula };
            const workbook = createMockWorkbook({ formulas });
            const table = workbook.sheets[0].tables[0];

            controller = new FormulaController(createMockHost({ workbook }));

            expect(controller.getFormulaForTable(table, 2)).toEqual(formula);
        });

        it('should return null for column without formula', () => {
            const workbook = createMockWorkbook();
            const table = workbook.sheets[0].tables[0];

            controller = new FormulaController(createMockHost({ workbook }));

            expect(controller.getFormulaForTable(table, 0)).toBeNull();
        });
    });
});
