/**
 * Workbook Service Tests - Additional edge case tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeWorkbook,
    getState,
    resetContext,
    addSheet,
    moveSheet,
    updateWorkbookTabOrder
} from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2
});

describe('Workbook Service Edge Cases', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('Tab Order Management', () => {
        it('should update tab order correctly', () => {
            const md = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

| X | Y |
|---|---|
| 3 | 4 |
`;
            initializeWorkbook(md, SAMPLE_CONFIG);

            const newTabOrder = [
                { type: 'sheet' as const, index: 1 },
                { type: 'sheet' as const, index: 0 }
            ];

            const result = updateWorkbookTabOrder(newTabOrder);
            expect(result.error).toBeUndefined();
            // Verify the operation succeeded by checking content is generated
            expect(result.content).toBeDefined();
        });
    });

    describe('Sheet Position Operations', () => {
        it('should add sheet at specific position', () => {
            const md = `# Tables

## Sheet 1

| A |
|---|
| 1 |
`;
            initializeWorkbook(md, SAMPLE_CONFIG);

            // Add at position 0 (before Sheet 1)
            const result = addSheet('New First', null, 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].name).toBe('New First');
            expect(state.workbook.sheets[1].name).toBe('Sheet 1');
        });

        it('should move sheet to beginning', () => {
            const md = `# Tables

## Sheet 1

| A |
|---|
| 1 |

## Sheet 2

| B |
|---|
| 2 |
`;
            initializeWorkbook(md, SAMPLE_CONFIG);

            const result = moveSheet(1, 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].name).toBe('Sheet 2');
            expect(state.workbook.sheets[1].name).toBe('Sheet 1');
        });
    });
});

describe('Hybrid Document Tests', () => {
    const HYBRID_MD = `# Introduction

This is a document section.

# Tables

## Data Sheet

| Name | Value |
|------|-------|
| A    | 1     |

# Appendix

Additional information here.
`;

    beforeEach(() => {
        resetContext();
        initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);
    });

    it('should parse hybrid notebook with documents and sheets', () => {
        const state = JSON.parse(getState());

        expect(state.workbook.sheets).toHaveLength(1);
        expect(state.workbook.sheets[0].name).toBe('Data Sheet');
        expect(state.structure).toBeDefined();
    });

    it('should maintain document structure after sheet operations', () => {
        addSheet('New Sheet');

        const state = JSON.parse(getState());
        expect(state.workbook.sheets).toHaveLength(2);
    });
});

describe('Empty Workbook Operations', () => {
    beforeEach(() => {
        resetContext();
        initializeWorkbook('', SAMPLE_CONFIG);
    });

    it('should add sheet to empty workbook', () => {
        const result = addSheet('First Sheet', ['Col1', 'Col2']);
        expect(result.error).toBeUndefined();

        const state = JSON.parse(getState());
        expect(state.workbook.sheets).toHaveLength(1);
        expect(state.workbook.sheets[0].tables[0].headers).toEqual(['Col1', 'Col2']);
    });
});
