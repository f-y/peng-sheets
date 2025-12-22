export interface IPyodide {
    runPythonAsync(code: string): Promise<string>;
    loadPackage(names: string | string[]): Promise<void>;
    pyimport(name: string): unknown;
    globals: Map<string, unknown>;
}

export interface IVSCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

export interface IUpdateSpec {
    type?: 'updateRange';
    error?: string;
    startLine?: number;
    endLine?: number;
    endCol?: number;
    content?: string;
    // Additional fields that might be returned
    [key: string]: unknown;
}

export interface IVisualMetadata {
    [key: string]: unknown;
}

export class SpreadsheetService {
    private pyodide: IPyodide | null = null;
    private _requestQueue: Array<() => Promise<void>> = [];
    private _isSyncing: boolean = false;
    private _isBatching: boolean = false;
    private _pendingUpdateSpec: IUpdateSpec | null = null;
    private vscode: IVSCodeApi;

    private pythonCore: string;

    constructor(pythonCore: string, vscode: IVSCodeApi) {
        this.pythonCore = pythonCore;
        this.vscode = vscode;
    }

    public async initialize() {
        if (typeof (globalThis as unknown as { loadPyodide: unknown }).loadPyodide === 'function') {
            this.pyodide = await (
                globalThis as unknown as {
                    loadPyodide: (config: { indexURL: string }) => Promise<IPyodide>;
                }
            ).loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
            });

            if (this.pyodide) {
                await this.pyodide.loadPackage('micropip');
                const micropip = this.pyodide.pyimport('micropip') as { install: (uri: string) => Promise<void> };

                const wheelUri = (window as unknown as { wheelUri?: string }).wheelUri;
                if (wheelUri) {
                    await micropip.install(wheelUri);
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

    private _postUpdateMessage(updateSpec: IUpdateSpec) {
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
                content: updateSpec.content
            });
            // _isSyncing remains true until Extension sends 'update'
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

    public addTable(sheetIdx: number, tableName: string) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = add_table(${sheetIdx}, ${JSON.stringify(tableName)})
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

    public updateColumnFilter(sheetIdx: number, tableIdx: number, colIndex: number, filter: Record<string, unknown> | null) {
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

    public updateColumnFormat(sheetIdx: number, tableIdx: number, colIndex: number, format: Record<string, unknown> | null) {
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
        this._enqueueRequest(async () => {
            const updateSpec = await this.runPython<IUpdateSpec>(`
                res = add_sheet(${JSON.stringify(newSheetName)})
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

    public moveSheet(fromIdx: number, toIdx: number) {
        this._enqueueRequest(async () => {
            const result = await this.runPython<IUpdateSpec>(`
                res = move_sheet(${fromIdx}, ${toIdx})
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
