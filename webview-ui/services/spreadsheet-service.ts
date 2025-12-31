import { IPyodide, IVSCodeApi, IUpdateSpec, IVisualMetadata } from './types';
import { t } from '../utils/i18n';

// @ts-expect-error Vite raw import for Python module
import pyodideCacheModule from '../../python-modules/pyodide_cache.py?raw';

/**
 * Service responsible for bridging VS Code Extension (TypeScript) and Pyodide (Python).
 *
 * Architecture:
 * - **Single-threaded Queue**: Pyodide runs in the main thread (in Webview). To prevent race conditions
 *   and ensure consistent state updates, all Python operations are queued via `_enqueueRequest`.
 * - **State Management**: The Python backend (`md_spreadsheet_parser`) holds the source of truth for the
 *   workbook state. This service pushes mutations to Python and broadcasts the resulting state updates
 *   back to the VS Code extension via `_postUpdateMessage`.
 */
export class SpreadsheetService {
    private pyodide: IPyodide | null = null;
    private _requestQueue: Array<() => Promise<void>> = [];
    private _isSyncing: boolean = false;
    private _isBatching: boolean = false;
    private _pendingUpdateSpec: IUpdateSpec | null = null;
    private vscode: IVSCodeApi;

    private pyodideCache: string = pyodideCacheModule;

    constructor(vscode: IVSCodeApi) {
        this.vscode = vscode;
    }

    public async initialize() {
        if (typeof (globalThis as unknown as { loadPyodide: unknown }).loadPyodide === 'function') {
            const indexURL =
                (window as unknown as { pyodideIndexUrl?: string }).pyodideIndexUrl ||
                'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';

            this.pyodide = await (
                globalThis as unknown as {
                    loadPyodide: (config: {
                        indexURL: string;
                        stdout?: (text: string) => void;
                        stderr?: (text: string) => void;
                    }) => Promise<IPyodide>;
                }
            ).loadPyodide({
                indexURL: indexURL,
                stdout: (text: string) => console.log('Pyodide stdout:', text),
                stderr: (text: string) => console.error('Pyodide stderr:', text)
            });

            if (this.pyodide) {
                const wheelUri = (window as unknown as { wheelUri?: string }).wheelUri;
                const editorWheelUri = (window as unknown as { editorWheelUri?: string }).editorWheelUri;
                const mountDir = '/local_cache';
                let isCached = false;
                // Composite version key to ensure both parser and editor updates invalidate cache
                const expectedVersion = JSON.stringify({ parser: wheelUri, editor: editorWheelUri });

                if (wheelUri && this.pyodide.FS) {
                    try {
                        this.pyodide.FS.mkdir(mountDir);
                    } catch (e) {
                        // Directory might already exist
                    }
                    this.pyodide.FS.mount(this.pyodide.FS.filesystems.IDBFS, {}, mountDir);

                    // Sync from IndexedDB
                    await new Promise<void>((resolve) => this.pyodide!.FS!.syncfs(true, () => resolve()));

                    // Check cached version
                    let cachedVersion = '';
                    try {
                        cachedVersion = this.pyodide.FS.readFile(`${mountDir}/version.txt`, { encoding: 'utf8' });
                    } catch (e) {
                        // File might not exist
                    }

                    if (
                        cachedVersion === expectedVersion &&
                        this.pyodide.FS.analyzePath(`${mountDir}/site-packages`).exists
                    ) {
                        isCached = true;
                    }
                }

                if (isCached) {
                    console.log('Pyodide: Restoring packages from cache...', expectedVersion);
                    try {
                        // Load the pyodide_cache functions into global namespace and call setup
                        await this.runPythonAsync(this.pyodideCache);
                        await this.runPythonAsync(`setup_cached_path("${mountDir}/site-packages")`);
                        // Test import to detect bytecode version mismatch or corrupted cache
                        await this.runPythonAsync('import md_spreadsheet_parser');
                        await this.runPythonAsync('import md_spreadsheet_editor');
                    } catch (cacheError) {
                        // Cache is corrupted or bytecode version mismatch
                        console.warn('Pyodide: Cache invalid, clearing and reinstalling...', cacheError);
                        isCached = false;

                        // Clear cache using Emscripten FS API directly (not Python, since imports are broken)
                        if (this.pyodide.FS) {
                            const fs = this.pyodide.FS;

                            // Helper to recursively delete directory
                            const rmRecursive = (path: string) => {
                                try {
                                    const stat = fs.stat(path);
                                    if (fs.isDir(stat.mode)) {
                                        const entries = fs.readdir(path).filter((e: string) => e !== '.' && e !== '..');
                                        for (const entry of entries) {
                                            rmRecursive(`${path}/${entry}`);
                                        }
                                        fs.rmdir(path);
                                    } else {
                                        fs.unlink(path);
                                    }
                                } catch (e) {
                                    // Path doesn't exist or other error, ignore
                                }
                            };

                            // Delete cached site-packages
                            // Note: We manually clean the Emscripten filesystem because the Python environment
                            // might be in a broken state where `shutil` or other standard libs aren't importable.
                            rmRecursive(`${mountDir}/site-packages`);

                            // Delete version file
                            try {
                                fs.unlink(`${mountDir}/version.txt`);
                            } catch (e) {
                                // Ignore if doesn't exist
                            }

                            // Sync deletion to IndexedDB
                            await new Promise<void>((resolve) => fs.syncfs(false, () => resolve()));
                            console.log('Pyodide: Cache cleared successfully');
                        }

                        // Remove corrupted path from sys.path AND clear sys.modules
                        // Note: pyodide_cache functions should already be in global namespace from earlier exec
                        try {
                            await this.runPythonAsync(`cleanup_corrupted_cache("${mountDir}/site-packages")`);
                        } catch (e) {
                            console.warn('Pyodide: Could not clean sys.path/modules:', e);
                        }
                    }
                }

                if (!isCached) {
                    console.log('Pyodide: Installing packages...');
                    await this.pyodide.loadPackage('micropip');
                    const micropip = this.pyodide.pyimport('micropip') as { install: (uri: string) => Promise<void> };

                    if (wheelUri) {
                        await micropip.install(wheelUri);
                    }
                    if (editorWheelUri) {
                        try {
                            await micropip.install(editorWheelUri);
                            console.log(`Pyodide: Loaded editor wheel from ${editorWheelUri}`);
                        } catch (e) {
                            console.error(`Pyodide: Failed to load editor wheel ${editorWheelUri}`, e);
                        }
                    }

                    if (this.pyodide.FS) {
                        console.log('Pyodide: Caching packages...', expectedVersion);
                        // Load pyodide_cache functions and call cache function
                        await this.runPythonAsync(this.pyodideCache);
                        // Use single quotes for python argument to avoid JSON quote conflict, or leverage _toPythonArg helper if available,
                        // but here we are composing string manually. escaping quotes in expectedVersion JSON.
                        // Actually expectedVersion is JSON string, e.g. {"parser":...}. It contains double quotes.
                        // So wrapping in single quotes works unless it contains single quotes (unlikely for JSON).
                        // Safer: Use _toPythonArg concept or raw string with triple quotes.
                        // Let's use triple quotes.
                        await this.runPythonAsync(`cache_installed_packages("${mountDir}", '''${expectedVersion}''')`);

                        await new Promise<void>((resolve) => this.pyodide!.FS!.syncfs(false, () => resolve()));
                    }

                }

                await this.runPythonAsync('import md_spreadsheet_editor.api as api');
                await this.runPythonAsync('import json');
            }
        }
        return this.pyodide;
    }

    public getPyodide() {
        return this.pyodide;
    }

    /**
     * Returns true if Pyodide has been initialized.
     * Use this to check before calling methods that require Pyodide.
     */
    public get isInitialized(): boolean {
        return this.pyodide !== null;
    }

    /**
     * Enqueues a task ensuring sequential execution of Python operations.
     * This is critical because Pyodide/WASM is single-threaded and non-reentrant for many operations.
     * A new task is only started after the previous one completes (or fails).
     */

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

        this._isSyncing = true;
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
     * Sends the result of a Python operation back to the VS Code extension.
     * This triggers the extension to update the text document (editor) and eventually
     * the webview will receive a `update` message with the new state.
     *
     * @param updateSpec The change specification returned by the Python backend.
     * @param options Undo/Redo control flags.
     */
    private _postUpdateMessage(
        updateSpec: IUpdateSpec,
        options: { undoStopBefore?: boolean; undoStopAfter?: boolean } = {}
    ) {
        if (this._isBatching) {
            if (updateSpec && !updateSpec.error && updateSpec.startLine !== undefined) {
                this._pendingUpdateSpec = {
                    type: 'updateRange',
                    startLine: updateSpec.startLine,
                    endLine: updateSpec.endLine,
                    content: updateSpec.content,
                    endCol: updateSpec.endCol
                };
            }
            return;
        }

        if (updateSpec && !updateSpec.error && updateSpec.startLine !== undefined) {
            this.vscode.postMessage({
                type: 'updateRange',
                startLine: updateSpec.startLine,
                endLine: updateSpec.endLine,
                endCol: updateSpec.endCol, // Forward endCol if present
                content: updateSpec.content,
                undoStopBefore: options.undoStopBefore,
                undoStopAfter: options.undoStopAfter
            });

            // _isSyncing remains true until Extension sends 'update'
        } else {
            console.error('Operation failed: ', updateSpec?.error);
            this._isSyncing = false;
            this._scheduleProcessQueue();
        }
    }

    private _postBatchUpdateMessage(updates: ({ undoStopBefore?: boolean; undoStopAfter?: boolean } & IUpdateSpec)[]) {
        if (this._isBatching) {
            console.warn('Batching not supported for batch updates yet');
            return;
        }

        const validUpdates = updates.filter((u) => u && !u.error && u.startLine !== undefined);

        if (validUpdates.length > 0) {
            this.vscode.postMessage({
                type: 'batchUpdate',
                updates: validUpdates.map((u) => ({
                    startLine: u.startLine!,
                    endLine: u.endLine!,
                    endCol: u.endCol,
                    content: u.content!,
                    undoStopBefore: u.undoStopBefore,
                    undoStopAfter: u.undoStopAfter
                }))
            });
        }
    }

    public notifyUpdateReceived() {
        this._isSyncing = false;
        this._scheduleProcessQueue();
    }

    public startBatch() {
        this._isBatching = true;
        this._pendingUpdateSpec = null;
    }

    public endBatch() {
        this._isBatching = false;
        if (this._pendingUpdateSpec) {
            this._postUpdateMessage(this._pendingUpdateSpec);
            this._pendingUpdateSpec = null;
        }
    }

    /**
     * Helper to run Python code and parse JSON result.
     * @param code Python code to run
     * @returns Parsed JSON result or null if explicitly null
     */
    private async runPython<T>(code: string): Promise<T | null> {
        if (!this.pyodide) throw new Error('Pyodide not initialized');
        const jsonStr = await this.pyodide.runPythonAsync(code);
        return JSON.parse(jsonStr);
    }

    // Kept for backward compatibility if needed, but runPython is preferred
    private async runPythonAsync(code: string): Promise<string> {
        if (!this.pyodide) throw new Error('Pyodide not initialized');
        return await this.pyodide.runPythonAsync(code);
    }

    /**
     * Serializes a JavaScript value into a safe Python argument string.
     *
     * Strategy: `json.loads(<JSON string>)`
     * We double-serialize (JSON.stringify inside JSON.stringify) to safely pass the value
     * as a string literal to Python's `json.loads`.
     *
     * Why?
     * - Handles `null` -> `None` conversion correctly.
     * - Handles complex objects (arrays, dicts) automatically.
     * - Prevents syntax errors from unescaped quotes in string arguments.
     * - More robust than manual string interpolation.
     */
    private _toPythonArg(v: any): string {
        return `json.loads(${JSON.stringify(JSON.stringify(v === undefined ? null : v))})`;
    }

    private async _runPythonFunction<T>(funcName: string, ...args: any[]): Promise<T | null> {
        const argsStr = args.map((a) => this._toPythonArg(a)).join(', ');
        const code = `
            res = api.${funcName}(${argsStr})
            json.dumps(res) if res else "null"
        `;
        return this.runPython<T>(code);
    }

    /**
     * Orchestrates the standard action flow:
     * 1. Enqueues the request (serialization).
     * 2. Executes the Python function.
     * 3. Posts the result back to VS Code (communication).
     */
    private _performAction(funcName: string, ...args: any[]) {
        this._enqueueRequest(async () => {
            const result = await this._runPythonFunction<IUpdateSpec>(funcName, ...args);
            if (result) this._postUpdateMessage(result);
        });
    }

    private _getDefaultColumnHeaders(): string[] {
        // Use global window variable injected by extension
        const lang = (window as unknown as { vscodeLanguage?: string }).vscodeLanguage || 'en';
        if (lang.startsWith('ja')) {
            return ['列名1', '列名2', '列名3'];
        }
        return ['Column 1', 'Column 2', 'Column 3'];
    }

    // --- Operations ---

    public updateTableMetadata(sheetIdx: number, tableIdx: number, name: string, description: string) {
        this._performAction('update_table_metadata', sheetIdx, tableIdx, name, description);
    }

    public updateVisualMetadata(sheetIdx: number, tableIdx: number, metadata: IVisualMetadata) {
        this._performAction('update_visual_metadata', sheetIdx, tableIdx, metadata);
    }

    public updateSheetMetadata(sheetIdx: number, metadata: Record<string, unknown>) {
        this._performAction('update_sheet_metadata', sheetIdx, metadata);
    }

    public addTable(sheetIdx: number, tableName: string) {
        // tableName is now used
        const headers = this._getDefaultColumnHeaders();
        this._performAction('add_table', sheetIdx, headers, tableName);
    }

    public renameTable(sheetIdx: number, tableIdx: number, newName: string) {
        this._performAction('rename_table', sheetIdx, tableIdx, newName);
    }

    public deleteTable(sheetIdx: number, tableIdx: number) {
        this._performAction('delete_table', sheetIdx, tableIdx);
    }

    public updateRange(
        sheetIdx: number,
        tableIdx: number,
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number,
        newValue: string
    ) {
        this._enqueueRequest(async () => {
            let lastResult: IUpdateSpec | null = null;
            // Handle multi-cell range: update each cell individually
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    lastResult = await this._runPythonFunction<IUpdateSpec>(
                        'update_cell',
                        sheetIdx,
                        tableIdx,
                        r,
                        c,
                        newValue
                    );
                }
            }
            // Only post update message once with the final result
            if (lastResult) {
                this._postUpdateMessage(lastResult);
            }
        });
    }

    public deleteRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this._performAction('delete_row', sheetIdx, tableIdx, rowIndex);
    }

    public deleteRows(sheetIdx: number, tableIdx: number, rowIndices: number[]) {
        this._performAction('delete_rows', sheetIdx, tableIdx, rowIndices);
    }

    public deleteColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this._performAction('delete_column', sheetIdx, tableIdx, colIndex);
    }

    public deleteColumns(sheetIdx: number, tableIdx: number, colIndices: number[]) {
        this._performAction('delete_columns', sheetIdx, tableIdx, colIndices);
    }

    public insertRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this._performAction('insert_row', sheetIdx, tableIdx, rowIndex);
    }

    public insertColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        // "New Column" localization
        // We need to import t from i18n
        // But this is a class, maybe we should let the caller pass the name?
        // Or import t here.
        // Importing t in SpreadsheetService is fine.
        const header = t('newColumn');
        this._performAction('insert_column', sheetIdx, tableIdx, colIndex, header);
    }

    public clearColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this._performAction('clear_column', sheetIdx, tableIdx, colIndex);
    }

    public clearColumns(sheetIdx: number, tableIdx: number, colIndices: number[]) {
        this._performAction('clear_columns', sheetIdx, tableIdx, colIndices);
    }

    public pasteCells(
        sheetIdx: number,
        tableIdx: number,
        startRow: number,
        startCol: number,
        rows: string[][],
        includeHeaders: boolean = false
    ) {
        this._performAction('paste_cells', sheetIdx, tableIdx, startRow, startCol, rows, includeHeaders);
    }

    /**
     * Insert multiple rows with data at a specific position
     * @param sheetIdx Sheet index
     * @param tableIdx Table index
     * @param targetRow Row index where to insert
     * @param rowsData 2D array of row data to insert
     */
    public insertRowsWithData(sheetIdx: number, tableIdx: number, targetRow: number, rowsData: string[][]) {
        this._enqueueRequest(async () => {
            // Insert empty rows first, then paste data
            // Insert from bottom to top to maintain correct indices
            for (let i = 0; i < rowsData.length; i++) {
                await this._runPythonFunction<IUpdateSpec>('insert_row', sheetIdx, tableIdx, targetRow);
            }

            // Now paste the data at target position
            const result = await this._runPythonFunction<IUpdateSpec>(
                'paste_cells',
                sheetIdx,
                tableIdx,
                targetRow,
                0,
                rowsData,
                false
            );

            if (result) this._postUpdateMessage(result);
        });
    }

    /**
     * Insert multiple columns with data at a specific position
     * @param sheetIdx Sheet index
     * @param tableIdx Table index
     * @param targetCol Column index where to insert
     * @param columnsData Array of column data (each inner array is one column's values)
     */
    public insertColumnsWithData(sheetIdx: number, tableIdx: number, targetCol: number, columnsData: string[][]) {
        this._enqueueRequest(async () => {
            // Insert empty columns first
            for (let i = 0; i < columnsData.length; i++) {
                await this._runPythonFunction<IUpdateSpec>('insert_column', sheetIdx, tableIdx, targetCol);
            }

            // Transpose columnsData to row-major format for paste_cells
            const numRows = columnsData.length > 0 ? columnsData[0].length : 0;
            const rowsData: string[][] = [];
            for (let r = 0; r < numRows; r++) {
                const rowData: string[] = [];
                for (let c = 0; c < columnsData.length; c++) {
                    rowData.push(columnsData[c][r] || '');
                }
                rowsData.push(rowData);
            }

            // Paste data at target column, row 0
            const result = await this._runPythonFunction<IUpdateSpec>(
                'paste_cells',
                sheetIdx,
                tableIdx,
                0,
                targetCol,
                rowsData,
                true
            );

            if (result) this._postUpdateMessage(result);
        });
    }
    public moveRows(sheetIdx: number, tableIdx: number, rowIndices: number[], targetRowIndex: number) {
        this._performAction('move_rows', sheetIdx, tableIdx, rowIndices, targetRowIndex);
    }

    public moveColumns(sheetIdx: number, tableIdx: number, colIndices: number[], targetColIndex: number) {
        this._performAction('move_columns', sheetIdx, tableIdx, colIndices, targetColIndex);
    }

    public moveCells(
        sheetIdx: number,
        tableIdx: number,
        sourceRange: { minR: number; maxR: number; minC: number; maxC: number },
        destRow: number,
        destCol: number
    ) {
        this._performAction('move_cells', sheetIdx, tableIdx, sourceRange, destRow, destCol);
    }

    public updateColumnFilter(sheetIdx: number, tableIdx: number, colIndex: number, filter: string[] | null) {
        this._performAction('update_column_filter', sheetIdx, tableIdx, colIndex, filter);
    }

    public sortRows(sheetIdx: number, tableIdx: number, colIndex: number, direction: 'asc' | 'desc') {
        const ascending = direction === 'asc';
        this._performAction('sort_rows', sheetIdx, tableIdx, colIndex, ascending);
    }

    public updateColumnAlign(
        sheetIdx: number,
        tableIdx: number,
        colIndex: number,
        align: 'left' | 'center' | 'right' | null
    ) {
        this._performAction('update_column_align', sheetIdx, tableIdx, colIndex, align);
    }

    public updateColumnFormat(
        sheetIdx: number,
        tableIdx: number,
        colIndex: number,
        format: Record<string, unknown> | null
    ) {
        this._performAction('update_column_format', sheetIdx, tableIdx, colIndex, format);
    }

    public updateColumnWidth(sheetIdx: number, tableIdx: number, colIndex: number, width: number) {
        this._performAction('update_column_width', sheetIdx, tableIdx, colIndex, width);
    }

    public addSheet(newSheetName: string, afterSheetIndex?: number, targetTabOrderIndex?: number) {
        const headers = this._getDefaultColumnHeaders();
        const afterIdx = afterSheetIndex !== undefined ? afterSheetIndex : null;
        const targetIdx = targetTabOrderIndex !== undefined ? targetTabOrderIndex : null;
        this._performAction('add_sheet', newSheetName, headers, afterIdx, targetIdx);
    }

    public createSpreadsheet() {
        const headers = this._getDefaultColumnHeaders();
        this._performAction('create_new_spreadsheet', headers);
    }

    public renameSheet(sheetIdx: number, newName: string) {
        this._performAction('rename_sheet', sheetIdx, newName);
    }

    public deleteSheet(sheetIdx: number) {
        this._performAction('delete_sheet', sheetIdx);
    }

    public renameDocument(docIdx: number, newTitle: string) {
        this._performAction('rename_document', docIdx, newTitle);
    }

    public deleteDocument(docIdx: number) {
        this._enqueueRequest(async () => {
            // Complex Transaction:
            // 1. Delete the document logic in Python (removes internal state).
            // 2. Regenerate the workbook metadata section in Python to reflect the removal.
            // 3. Batches these two changes into a single update message to VS Code.
            //    This ensures the physical markdown file updates atomically.

            // Atomic update using delete_document_and_get_full_update to avoid overlapping ranges
            const result = await this._runPythonFunction<IUpdateSpec>('delete_document_and_get_full_update', docIdx);

            if (result) {
                if (result.error) {
                    console.error('Delete Document failed:', result.error);
                } else {
                    this._postUpdateMessage(result);
                }
            }
        });
    }

    public moveSheet(fromIdx: number, toIdx: number, targetTabOrderIndex: number = -1) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = api.move_sheet(
                    ${fromIdx}, 
                    ${toIdx},
                    target_tab_order_index=${targetTabOrderIndex === -1 ? 'None' : targetTabOrderIndex}
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public updateWorkbookTabOrder(tabOrder: Array<{ type: string; index: number }>) {
        this._performAction('update_workbook_tab_order', tabOrder);
    }

    public addDocument(
        title: string,
        afterDocIndex: number = -1,
        afterWorkbook: boolean = false,
        insertAfterTabOrderIndex: number = -1
    ) {
        this._enqueueRequest(async () => {
            // Complex Transaction:
            // We need to insert a new document AND potentially update the workbook metadata (e.g. invalidating old offsets).
            // Instead of two separate edits (which would create two undo steps), we run a Python script
            // that performs the logic and constructs a single "whole file reconstruction" or merged changeset.
            // This ensures atomic updates and a clean undo history.

            // Add the document and regenerate workbook in a single operation
            // This ensures only one undo step is created
            const result = await this.runPython<IUpdateSpec>(`
                res = api.add_document_and_get_full_update(
                    ${JSON.stringify(title)},
                    after_doc_index=${afterDocIndex},
                    after_workbook=${afterWorkbook ? 'True' : 'False'},
                    insert_after_tab_order_index=${insertAfterTabOrderIndex}
                )
                json.dumps(res) if res else "null"
            `);

            if (result && !result.error) {
                this._postUpdateMessage(result);
            } else if (result?.error) {
                console.error('add_document failed:', result.error);
                this._isSyncing = false;
                this._scheduleProcessQueue();
            }
        });
    }

    public moveDocumentSection(
        fromDocIndex: number,
        toDocIndex: number | null = null,
        toAfterWorkbook: boolean = false,
        toBeforeWorkbook: boolean = false,
        targetTabOrderIndex: number = -1
    ) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = api.move_document_section(
                    ${fromDocIndex},
                    to_doc_index=${toDocIndex === null ? 'None' : toDocIndex},
                    to_after_workbook=${toAfterWorkbook ? 'True' : 'False'},
                    to_before_workbook=${toBeforeWorkbook ? 'True' : 'False'},
                    target_tab_order_index=${targetTabOrderIndex === -1 ? 'None' : targetTabOrderIndex}
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public moveWorkbookSection(toDocIndex: number, toAfterDoc: boolean = false, targetTabOrderIndex: number = -1) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = api.move_workbook_section(
                    to_doc_index=${toDocIndex},
                    to_after_doc=${toAfterDoc ? 'True' : 'False'},
                    target_tab_order_index=${targetTabOrderIndex === -1 ? 'None' : targetTabOrderIndex}
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public async getDocumentSectionRange(docIndex: number) {
        // This method might return a different structure, use any or specific interface if known
        const result = await this.runPython<unknown>(`
            result = api.get_document_section_range(${docIndex})
            json.dumps(result)
        `);
        return result;
    }

    public async initializeWorkbook(mdText: string, config: unknown) {
        if (!this.pyodide) throw new Error('Pyodide not initialized');
        this.pyodide.globals.set('md_text', mdText);
        this.pyodide.globals.set('config', JSON.stringify(config));

        const result = await this.runPython<unknown>(`
            api.initialize_workbook(md_text, config)
            api.get_state()
        `);
        return result;
    }
}
