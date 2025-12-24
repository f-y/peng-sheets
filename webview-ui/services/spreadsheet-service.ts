import { IPyodide, IVSCodeApi, IUpdateSpec, IVisualMetadata } from './types';

// @ts-expect-error Vite raw import for Python module
import pyodideCacheModule from '../../python-modules/pyodide_cache.py?raw';

export class SpreadsheetService {
    private pyodide: IPyodide | null = null;
    private _requestQueue: Array<() => Promise<void>> = [];
    private _isSyncing: boolean = false;
    private _isBatching: boolean = false;
    private _pendingUpdateSpec: IUpdateSpec | null = null;
    private vscode: IVSCodeApi;

    private pythonCore: string;
    private pyodideCache: string = pyodideCacheModule;

    constructor(pythonCore: string, vscode: IVSCodeApi) {
        this.pythonCore = pythonCore;
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
                const mountDir = '/local_cache';
                let isCached = false;

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

                    if (cachedVersion === wheelUri && this.pyodide.FS.analyzePath(`${mountDir}/site-packages`).exists) {
                        isCached = true;
                    }
                }

                if (isCached) {
                    console.log('Pyodide: Restoring packages from cache...');
                    try {
                        // Load the pyodide_cache functions into global namespace and call setup
                        await this.runPythonAsync(this.pyodideCache);
                        await this.runPythonAsync(`setup_cached_path("${mountDir}/site-packages")`);
                        // Test import to detect bytecode version mismatch
                        await this.runPythonAsync('import md_spreadsheet_parser');
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

                        if (this.pyodide.FS) {
                            console.log('Pyodide: Caching packages...');
                            // Load pyodide_cache functions and call cache function
                            await this.runPythonAsync(this.pyodideCache);
                            await this.runPythonAsync(`cache_installed_packages("${mountDir}", "${wheelUri}")`);

                            await new Promise<void>((resolve) => this.pyodide!.FS!.syncfs(false, () => resolve()));
                        }
                    }
                }

                await this.runPythonAsync(this.pythonCore);
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
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = update_table_metadata(
                    ${sheetIdx}, 
                    ${tableIdx}, 
                    ${JSON.stringify(name)}, 
                    ${JSON.stringify(description)}
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public updateVisualMetadata(sheetIdx: number, tableIdx: number, metadata: IVisualMetadata) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = update_visual_metadata(
                    ${sheetIdx},
                    ${tableIdx},
                    json.loads(${JSON.stringify(JSON.stringify(metadata))})
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public updateSheetMetadata(sheetIdx: number, metadata: Record<string, unknown>) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = update_sheet_metadata(
                    ${sheetIdx},
                    json.loads(${JSON.stringify(JSON.stringify(metadata))})
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public addTable(sheetIdx: number, _tableName: string) {
        const headers = this._getDefaultColumnHeaders();
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = add_table(${sheetIdx}, ${JSON.stringify(headers)})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public renameTable(sheetIdx: number, tableIdx: number, newName: string) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = rename_table(${sheetIdx}, ${tableIdx}, ${JSON.stringify(newName)})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public deleteTable(sheetIdx: number, tableIdx: number) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = delete_table(${sheetIdx}, ${tableIdx})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
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
                    const result = await this.runPython<IUpdateSpec>(`
                    res = update_cell(${sheetIdx}, ${tableIdx}, ${r}, ${c}, ${JSON.stringify(newValue)})
                    json.dumps(res) if res else "null"
                `);
                    lastResult = result;
                }
            }
            // Only post update message once with the final result
            if (lastResult) {
                this._postUpdateMessage(lastResult);
            }
        });
    }

    public deleteRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = delete_row(${sheetIdx}, ${tableIdx}, ${rowIndex})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public deleteRows(sheetIdx: number, tableIdx: number, rowIndices: number[]) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = delete_rows(${sheetIdx}, ${tableIdx}, ${JSON.stringify(rowIndices)})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public deleteColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = delete_column(${sheetIdx}, ${tableIdx}, ${colIndex})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public insertRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = insert_row(${sheetIdx}, ${tableIdx}, ${rowIndex})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public insertColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = insert_column(${sheetIdx}, ${tableIdx}, ${colIndex})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public clearColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = clear_column(${sheetIdx}, ${tableIdx}, ${colIndex})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public pasteCells(
        sheetIdx: number,
        tableIdx: number,
        startRow: number,
        startCol: number,
        rows: string[][],
        includeHeaders: boolean = false
    ) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = paste_cells(
                    ${sheetIdx}, 
                    ${tableIdx}, 
                    ${startRow}, 
                    ${startCol}, 
                    json.loads(${JSON.stringify(JSON.stringify(rows))}),
                    ${includeHeaders ? 'True' : 'False'}
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public updateColumnFilter(sheetIdx: number, tableIdx: number, colIndex: number, filter: string[] | null) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = update_column_filter(
                    ${sheetIdx},
                    ${tableIdx},
                    ${colIndex},
                    json.loads(${JSON.stringify(JSON.stringify(filter || null))})
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public sortRows(sheetIdx: number, tableIdx: number, colIndex: number, direction: 'asc' | 'desc') {
        this._enqueueRequest(async () => {
            const ascending = direction === 'asc' ? 'True' : 'False';
            const result = await this.runPython<IUpdateSpec>(`
                res = sort_rows(
                    ${sheetIdx},
                    ${tableIdx},
                    ${colIndex},
                    ${ascending}
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public updateColumnAlign(
        sheetIdx: number,
        tableIdx: number,
        colIndex: number,
        align: 'left' | 'center' | 'right' | null
    ) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = update_column_align(
                    ${sheetIdx},
                    ${tableIdx},
                    ${colIndex},
                    json.loads(${JSON.stringify(JSON.stringify(align))})
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public updateColumnFormat(
        sheetIdx: number,
        tableIdx: number,
        colIndex: number,
        format: Record<string, unknown> | null
    ) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = update_column_format(
                    ${sheetIdx},
                    ${tableIdx},
                    ${colIndex},
                    json.loads(${JSON.stringify(JSON.stringify(format || null))})
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public updateColumnWidth(sheetIdx: number, tableIdx: number, colIndex: number, width: number) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = update_column_width(
                    ${sheetIdx}, 
                    ${tableIdx}, 
                    ${colIndex}, 
                    ${width}
                )
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public addSheet(newSheetName: string) {
        const headers = this._getDefaultColumnHeaders();
        this._enqueueRequest(async () => {
            const updateSpec = await this.runPython<IUpdateSpec>(`
                res = add_sheet(${JSON.stringify(newSheetName)}, ${JSON.stringify(headers)})
                json.dumps(res) if res else "null"
            `);

            if (updateSpec) {
                if (updateSpec.error) {
                    console.error('Add Sheet failed:', updateSpec.error);
                } else {
                    this._postUpdateMessage(updateSpec);
                }
            }
        });
    }

    public renameSheet(sheetIdx: number, newName: string) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = rename_sheet(${sheetIdx}, ${JSON.stringify(newName)})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public deleteSheet(sheetIdx: number) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = delete_sheet(${sheetIdx})
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public renameDocument(docIdx: number, newTitle: string) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = rename_document(${docIdx}, ${JSON.stringify(newTitle)})
                json.dumps(res) if res else "null"
            `);
            if (result) {
                if (result.error) {
                    console.error('Rename Document failed:', result.error);
                } else {
                    this._postUpdateMessage(result);
                }
            }
        });
    }

    public deleteDocument(docIdx: number) {
        this._enqueueRequest(async () => {
            // First call delete_document, then regenerate the workbook section
            const deleteResult = await this.runPython<IUpdateSpec>(`
                res = delete_document(${docIdx})
                json.dumps(res) if res else "null"
            `);
            if (deleteResult) {
                if (deleteResult.error) {
                    console.error('Delete Document failed:', deleteResult.error);
                } else {
                    // Also regenerate workbook section to update metadata
                    const regenerateResult = await this.runPython<IUpdateSpec>(`
                        res = generate_and_get_range()
                        json.dumps(res) if res else "null"
                    `);

                    if (regenerateResult) {
                        // Adjust coordinates for the second edit (metadata update)
                        // Since we're batching them into a single transaction, both edits must target the PRE-edit document state.
                        // The regenerateResult we got from Python is based on the POST-delete state.
                        // So if the metadata section is AFTER the deleted section, we must shift it back (add deleted lines).
                        const deletedCount = deleteResult.endLine! - deleteResult.startLine! + 1;
                        const adjustedRegenerate = { ...regenerateResult };

                        if (adjustedRegenerate.startLine! >= deleteResult.startLine!) {
                            adjustedRegenerate.startLine = adjustedRegenerate.startLine! + deletedCount;
                            adjustedRegenerate.endLine = adjustedRegenerate.endLine! + deletedCount;
                        }

                        this._postBatchUpdateMessage([
                            {
                                ...deleteResult,
                                undoStopBefore: true,
                                undoStopAfter: false
                            },
                            {
                                ...adjustedRegenerate,
                                undoStopBefore: false,
                                undoStopAfter: true
                            }
                        ]);
                    } else {
                        // Fallback if regenerate fails (shouldn't happen)
                        this._postUpdateMessage(deleteResult);
                    }
                }
            }
        });
    }

    public moveSheet(fromIdx: number, toIdx: number, targetTabOrderIndex: number = -1) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = move_sheet(
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
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = update_workbook_tab_order(json.loads(${JSON.stringify(JSON.stringify(tabOrder))}))
                json.dumps(res) if res else "null"
            `);
            if (result) this._postUpdateMessage(result);
        });
    }

    public addDocument(
        title: string,
        afterDocIndex: number = -1,
        afterWorkbook: boolean = false,
        insertAfterTabOrderIndex: number = -1
    ) {
        this._enqueueRequest(async () => {
            // First, add the document (this updates the in-memory workbook metadata)
            const result = await this.runPython<IUpdateSpec>(`
                res = add_document(
                    ${JSON.stringify(title)},
                    after_doc_index=${afterDocIndex},
                    after_workbook=${afterWorkbook ? 'True' : 'False'},
                    insert_after_tab_order_index=${insertAfterTabOrderIndex}
                )
                json.dumps(res) if res else "null"
            `);

            if (result && !result.error) {
                // Post the document addition first
                this._postUpdateMessage(result);

                // Then regenerate the workbook section to include updated metadata
                const workbookUpdate = await this.runPython<IUpdateSpec>(`
                    res = generate_and_get_range()
                    json.dumps(res) if res else "null"
                `);

                if (workbookUpdate && !workbookUpdate.error) {
                    this._postUpdateMessage(workbookUpdate);
                }
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
                res = move_document_section(
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

    public async getDocumentSectionRange(docIndex: number) {
        // This method might return a different structure, use any or specific interface if known
        const result = await this.runPython<unknown>(`
            result = get_document_section_range(workbook, ${docIndex})
            json.dumps(result)
        `);
        return result;
    }

    public async initializeWorkbook(mdText: string, config: unknown) {
        if (!this.pyodide) throw new Error('Pyodide not initialized');
        this.pyodide.globals.set('md_text', mdText);
        this.pyodide.globals.set('config', JSON.stringify(config));

        const result = await this.runPython<unknown>(`
            initialize_workbook(md_text, config)
            get_state()
        `);
        return result;
    }
}
