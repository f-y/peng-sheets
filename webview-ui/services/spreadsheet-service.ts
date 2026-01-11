/**
 * Spreadsheet Service - Pure TypeScript Implementation
 *
 * This version replaces Pyodide with the native TypeScript editor module.
 * Architecture:
 * - **Synchronous Operations**: No longer need request queue since operations are synchronous
 * - **State Management**: EditorContext holds the source of truth
 * - **Updates**: Posts changes back to VS Code extension for file updates
 */

import { IVSCodeApi, IUpdateSpec, IVisualMetadata } from './types';
import { t } from '../utils/i18n';
import * as editor from '../../src/editor';

export class SpreadsheetService {
    private _initialized: boolean = false;
    private _isBatching: boolean = false;
    private _batchFirstUpdate: boolean = true;
    private _batchUpdates: IUpdateSpec[] = [];
    private _pendingUpdateSpec: IUpdateSpec | null = null;
    private vscode: IVSCodeApi;
    private _isSyncing: boolean = false;
    private _skipNextParse: boolean = false;
    private _requestQueue: Array<() => Promise<void>> = [];
    private _onDataChanged?: () => void;

    constructor(vscode: IVSCodeApi) {
        this.vscode = vscode;
    }

    /**
     * Initialize the service - no longer requires async Pyodide loading
     */
    public async initialize() {
        this._initialized = true;
        return this;
    }

    /**
     * Returns true if the service has been initialized.
     */
    public get isInitialized(): boolean {
        return this._initialized;
    }

    /**
     * Returns true if waiting for a response from VS Code extension.
     * When true, incoming 'update' messages are responses to our own changes.
     */
    public get isSyncing(): boolean {
        return this._isSyncing;
    }

    /**
     * Returns true if the next parse should be skipped (for flicker prevention).
     * This is used for specific operations like Delete key in selection mode.
     */
    public get skipNextParse(): boolean {
        return this._skipNextParse;
    }

    /**
     * Set whether to skip the next parse operation.
     * Call this before operations that benefit from optimistic UI (e.g., Delete key).
     */
    public setSkipNextParse(value: boolean) {
        this._skipNextParse = value;
    }

    // Queue management for compatibility with existing async patterns
    private _enqueueRequest(task: () => Promise<void>) {
        this._requestQueue.push(task);
        if (!this._isSyncing) {
            this._scheduleProcessQueue();
        }
    }

    private _scheduleProcessQueue() {
        setTimeout(() => this._processQueue(), 0);
    }

    private async _processQueue() {
        if (this._isSyncing || this._requestQueue.length === 0) return;

        // Only set isSyncing if skipNextParse is requested (for Delete key flicker prevention)
        this._isSyncing = this._skipNextParse;
        this._skipNextParse = false; // Reset for next operation

        const task = this._requestQueue.shift();

        if (task) {
            try {
                await task();
            } catch (err) {
                console.error('Task failed:', err);
                this._isSyncing = false;
                this._scheduleProcessQueue();
            }
        }
    }

    /**
     * Sends the result of an operation back to the VS Code extension.
     * When batching, accumulates updates to send together at endBatch.
     */
    private _postUpdateMessage(
        updateSpec: IUpdateSpec,
        options: { undoStopBefore?: boolean; undoStopAfter?: boolean } = {}
    ) {
        if (updateSpec && !updateSpec.error && updateSpec.startLine !== undefined) {
            if (this._isBatching) {
                // During batch: accumulate updates to send together at endBatch
                this._batchUpdates.push({
                    ...updateSpec,
                    type: 'updateRange'
                });
                return;
            }

            this.vscode.postMessage({
                type: 'updateRange',
                startLine: updateSpec.startLine,
                endLine: updateSpec.endLine,
                endCol: updateSpec.endCol,
                content: updateSpec.content,
                undoStopBefore: options.undoStopBefore,
                undoStopAfter: options.undoStopAfter
            });
        } else {
            console.error('Operation failed: ', updateSpec?.error);
            this._isSyncing = false;
            this._scheduleProcessQueue();
        }
    }

    public notifyUpdateReceived() {
        this._isSyncing = false;
        this._scheduleProcessQueue();
    }

    public startBatch() {
        this._isBatching = true;
        this._batchFirstUpdate = true;
        this._batchUpdates = [];
        this._pendingUpdateSpec = null;
    }

    public endBatch() {
        this._isBatching = false;
        const updates = this._batchUpdates;
        this._batchUpdates = [];
        this._batchFirstUpdate = true;
        this._pendingUpdateSpec = null;

        if (updates.length === 0) return;

        // Since each update contains the complete updated table content (cumulative),
        // we only need to send the final update - it contains all changes
        const lastUpdate = updates[updates.length - 1];
        this.vscode.postMessage({
            type: 'updateRange',
            startLine: lastUpdate.startLine,
            endLine: lastUpdate.endLine,
            endCol: lastUpdate.endCol,
            content: lastUpdate.content,
            // Single update = true for both undo stops
            undoStopBefore: true,
            undoStopAfter: true
        });
    }

    /**
     * Execute a TypeScript editor function and post the result.
     * Operations are synchronous since we use the pure TypeScript editor.
     */
    private _performAction<T extends IUpdateSpec>(fn: () => T) {
        try {
            const result = fn();
            if (result) this._postUpdateMessage(result);
            // Trigger data change callback for formula recalculation synchronously
            this._onDataChanged?.();
        } catch (err) {
            console.error('Operation failed:', err);
        }
    }

    /**
     * Register a callback to be called after any data-modifying operation.
     * Used by main.ts to trigger formula recalculation.
     */
    public setOnDataChangedCallback(callback: () => void) {
        this._onDataChanged = callback;
    }

    private _getDefaultColumnHeaders(): string[] {
        const lang = (window as unknown as { vscodeLanguage?: string }).vscodeLanguage || 'en';
        if (lang.startsWith('ja')) {
            return ['列名1', '列名2', '列名3'];
        }
        return ['Column 1', 'Column 2', 'Column 3'];
    }

    // --- Table Operations ---

    public updateTableMetadata(sheetIdx: number, tableIdx: number, name: string, description: string) {
        this._performAction(() => editor.updateTableMetadata(sheetIdx, tableIdx, name, description));
    }

    public updateVisualMetadata(sheetIdx: number, tableIdx: number, metadata: IVisualMetadata) {
        this._performAction(() => editor.updateVisualMetadata(sheetIdx, tableIdx, metadata));
    }

    public updateSheetMetadata(sheetIdx: number, metadata: Record<string, unknown>) {
        this._performAction(() => editor.updateSheetMetadata(sheetIdx, metadata));
    }

    public addTable(sheetIdx: number, tableName: string) {
        const headers = this._getDefaultColumnHeaders();
        this._performAction(() => editor.addTable(sheetIdx, headers, tableName));
    }

    public renameTable(sheetIdx: number, tableIdx: number, newName: string) {
        this._performAction(() => editor.renameTable(sheetIdx, tableIdx, newName));
    }

    public deleteTable(sheetIdx: number, tableIdx: number) {
        this._performAction(() => editor.deleteTable(sheetIdx, tableIdx));
    }

    // --- Cell Operations ---

    public updateRange(
        sheetIdx: number,
        tableIdx: number,
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number,
        newValue: string
    ) {
        // Start batch to group cell update + formula recalculations into single undo
        this.startBatch();
        try {
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const result = editor.updateCell(sheetIdx, tableIdx, r, c, newValue);
                    if (result) {
                        this._postUpdateMessage(result);
                    }
                }
            }
            // Trigger data change callback for formula recalculation (within same batch)
            this._onDataChanged?.();
        } catch (err) {
            console.error('updateRange failed:', err);
        } finally {
            this.endBatch();
        }
    }

    /**
     * Synchronous version of updateRange for use within batches.
     * This bypasses the async queue and directly accumulates in the batch.
     * Must be called between startBatch() and endBatch().
     */
    public updateRangeBatch(sheetIdx: number, tableIdx: number, rowIndex: number, colIndex: number, newValue: string) {
        const result = editor.updateCell(sheetIdx, tableIdx, rowIndex, colIndex, newValue);
        if (result) {
            this._postUpdateMessage(result);
        }
    }

    public deleteRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this._performAction(() => editor.deleteRow(sheetIdx, tableIdx, rowIndex));
    }

    public deleteRows(sheetIdx: number, tableIdx: number, rowIndices: number[]) {
        this._performAction(() => editor.deleteRows(sheetIdx, tableIdx, rowIndices));
    }

    public deleteColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this._performAction(() => editor.deleteColumn(sheetIdx, tableIdx, colIndex));
    }

    public deleteColumns(sheetIdx: number, tableIdx: number, colIndices: number[]) {
        this._performAction(() => editor.deleteColumns(sheetIdx, tableIdx, colIndices));
    }

    public insertRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this._performAction(() => editor.insertRow(sheetIdx, tableIdx, rowIndex));
    }

    public insertColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        const header = t('newColumn');
        this._performAction(() => editor.insertColumn(sheetIdx, tableIdx, colIndex, header));
    }

    public clearColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this._performAction(() => editor.clearColumn(sheetIdx, tableIdx, colIndex));
    }

    public clearColumns(sheetIdx: number, tableIdx: number, colIndices: number[]) {
        this._performAction(() => editor.clearColumns(sheetIdx, tableIdx, colIndices));
    }

    public pasteCells(
        sheetIdx: number,
        tableIdx: number,
        startRow: number,
        startCol: number,
        rows: string[][],
        includeHeaders: boolean = false
    ) {
        this._performAction(() => editor.pasteCells(sheetIdx, tableIdx, startRow, startCol, rows, includeHeaders));
    }

    public insertRowsWithData(sheetIdx: number, tableIdx: number, targetRow: number, rowsData: string[][]) {
        this._enqueueRequest(async () => {
            // Insert empty rows first
            for (let i = 0; i < rowsData.length; i++) {
                editor.insertRow(sheetIdx, tableIdx, targetRow);
            }
            // Paste the data
            const result = editor.pasteCells(sheetIdx, tableIdx, targetRow, 0, rowsData, false);
            if (result) this._postUpdateMessage(result);
        });
    }

    public insertColumnsWithData(sheetIdx: number, tableIdx: number, targetCol: number, columnsData: string[][]) {
        this._enqueueRequest(async () => {
            // Insert empty columns first
            for (let i = 0; i < columnsData.length; i++) {
                editor.insertColumn(sheetIdx, tableIdx, targetCol);
            }
            // Transpose and paste
            const numRows = columnsData.length > 0 ? columnsData[0].length : 0;
            const rowsData: string[][] = [];
            for (let r = 0; r < numRows; r++) {
                const rowData: string[] = [];
                for (let c = 0; c < columnsData.length; c++) {
                    rowData.push(columnsData[c][r] || '');
                }
                rowsData.push(rowData);
            }
            const result = editor.pasteCells(sheetIdx, tableIdx, 0, targetCol, rowsData, true);
            if (result) this._postUpdateMessage(result);
        });
    }

    public moveRows(sheetIdx: number, tableIdx: number, rowIndices: number[], targetRowIndex: number) {
        this._performAction(() => editor.moveRows(sheetIdx, tableIdx, rowIndices, targetRowIndex));
    }

    public moveColumns(sheetIdx: number, tableIdx: number, colIndices: number[], targetColIndex: number) {
        this._performAction(() => editor.moveColumns(sheetIdx, tableIdx, colIndices, targetColIndex));
    }

    public moveCells(
        sheetIdx: number,
        tableIdx: number,
        sourceRange: { minR: number; maxR: number; minC: number; maxC: number },
        destRow: number,
        destCol: number
    ) {
        this._performAction(() => editor.moveCells(sheetIdx, tableIdx, sourceRange, destRow, destCol));
    }

    public updateColumnFilter(sheetIdx: number, tableIdx: number, colIndex: number, filter: string[] | null) {
        this._performAction(() => editor.updateColumnFilter(sheetIdx, tableIdx, colIndex, filter ?? []));
    }

    public sortRows(sheetIdx: number, tableIdx: number, colIndex: number, direction: 'asc' | 'desc') {
        const ascending = direction === 'asc';
        this._performAction(() => editor.sortRows(sheetIdx, tableIdx, colIndex, ascending));
    }

    public updateColumnAlign(
        sheetIdx: number,
        tableIdx: number,
        colIndex: number,
        align: 'left' | 'center' | 'right' | null
    ) {
        this._performAction(() => editor.updateColumnAlign(sheetIdx, tableIdx, colIndex, align ?? 'left'));
    }

    public updateColumnFormat(
        sheetIdx: number,
        tableIdx: number,
        colIndex: number,
        format: Record<string, unknown> | null
    ) {
        this._performAction(() => editor.updateColumnFormat(sheetIdx, tableIdx, colIndex, format));
    }

    public updateColumnWidth(sheetIdx: number, tableIdx: number, colIndex: number, width: number) {
        this._performAction(() => editor.updateColumnWidth(sheetIdx, tableIdx, colIndex, width));
    }

    // --- Sheet Operations ---

    public addSheet(newSheetName: string, afterSheetIndex?: number, targetTabOrderIndex?: number) {
        const headers = this._getDefaultColumnHeaders();
        const afterIdx = afterSheetIndex !== undefined ? afterSheetIndex : null;
        const targetIdx = targetTabOrderIndex !== undefined ? targetTabOrderIndex : null;
        this._performAction(() => editor.addSheet(newSheetName, headers, afterIdx, targetIdx));
    }

    public createSpreadsheet() {
        const headers = this._getDefaultColumnHeaders();
        this._performAction(() => editor.createNewSpreadsheet(headers));
    }

    public renameSheet(sheetIdx: number, newName: string) {
        this._performAction(() => editor.renameSheet(sheetIdx, newName));
    }

    public deleteSheet(sheetIdx: number) {
        this._performAction(() => editor.deleteSheet(sheetIdx));
    }

    public moveSheet(fromIdx: number, toIdx: number, targetTabOrderIndex: number = -1) {
        const targetIdx = targetTabOrderIndex === -1 ? null : targetTabOrderIndex;
        this._performAction(() => editor.moveSheet(fromIdx, toIdx, targetIdx));
    }

    public updateWorkbookTabOrder(tabOrder: Array<{ type: string; index: number }>) {
        this._performAction(() => editor.updateWorkbookTabOrder(tabOrder as editor.TabOrderItem[]));
    }

    // --- Document Operations ---

    public addDocument(
        title: string,
        afterDocIndex: number = -1,
        afterWorkbook: boolean = false,
        insertAfterTabOrderIndex: number = -1
    ) {
        this._performAction(() =>
            editor.addDocumentAndGetFullUpdate(title, afterDocIndex, afterWorkbook, insertAfterTabOrderIndex)
        );
    }

    public renameDocument(docIdx: number, newTitle: string) {
        this._performAction(() => editor.renameDocument(docIdx, newTitle));
    }

    public deleteDocument(docIdx: number) {
        this._performAction(() => editor.deleteDocumentAndGetFullUpdate(docIdx));
    }

    public moveDocumentSection(
        fromDocIndex: number,
        toDocIndex: number | null = null,
        toAfterWorkbook: boolean = false,
        toBeforeWorkbook: boolean = false,
        targetTabOrderIndex: number = -1
    ) {
        const targetIdx = targetTabOrderIndex === -1 ? null : targetTabOrderIndex;
        this._performAction(() =>
            editor.moveDocumentSection(fromDocIndex, toDocIndex, toAfterWorkbook, toBeforeWorkbook, targetIdx)
        );
    }

    public moveWorkbookSection(toDocIndex: number, toAfterDoc: boolean = false, targetTabOrderIndex: number = -1) {
        const targetIdx = targetTabOrderIndex === -1 ? null : targetTabOrderIndex;
        this._performAction(() => editor.moveWorkbookSection(toDocIndex, toAfterDoc, false, targetIdx));
    }

    public async getDocumentSectionRange(docIndex: number) {
        return editor.getDocumentSectionRange(docIndex);
    }

    // --- Workbook Initialization ---

    public async initializeWorkbook(mdText: string, config: unknown) {
        const configJson = typeof config === 'string' ? config : JSON.stringify(config);
        editor.initializeWorkbook(mdText, configJson);
        const stateJson = editor.getState();
        return JSON.parse(stateJson);
    }

    // --- Deprecated methods for backward compatibility ---

    /**
     * @deprecated Use isInitialized property instead
     */
    public getPyodide() {
        return this._initialized ? {} : null;
    }
}
