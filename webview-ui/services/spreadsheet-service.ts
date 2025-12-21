export class SpreadsheetService {
    private pyodide: any = null;
    private _requestQueue: Array<() => Promise<void>> = [];
    private _isSyncing: boolean = false;
    private _isBatching: boolean = false;
    private _pendingUpdateSpec: any = null;
    private vscode: any;

    private pythonCore: string;

    constructor(pythonCore: string, vscode: any) {
        this.pythonCore = pythonCore;
        this.vscode = vscode;
    }

    public async initialize() {
        if (typeof (globalThis as any).loadPyodide === 'function') {
            this.pyodide = await (globalThis as any).loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
            });

            await this.pyodide.loadPackage('micropip');
            const micropip = this.pyodide.pyimport('micropip');

            const wheelUri = (window as any).wheelUri;
            if (wheelUri) {
                await micropip.install(wheelUri);
            }

            await this.pyodide.runPythonAsync(this.pythonCore);
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

    private _postUpdateMessage(updateSpec: any) {
        if (this._isBatching) {
            if (updateSpec && !updateSpec.error && updateSpec.startLine !== undefined) {
                this._pendingUpdateSpec = {
                    type: 'updateRange',
                    startLine: updateSpec.startLine,
                    endLine: updateSpec.endLine,
                    content: updateSpec.content
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

    private async runPythonAsync(code: string): Promise<string> {
        if (!this.pyodide) throw new Error('Pyodide not initialized');
        return await this.pyodide.runPythonAsync(code);
    }

    // --- Operations ---

    public updateTableMetadata(sheetIdx: number, tableIdx: number, name: string, description: string) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = update_table_metadata(
                    ${sheetIdx}, 
                    ${tableIdx}, 
                    ${JSON.stringify(name)}, 
                    ${JSON.stringify(description)}
                )
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public updateVisualMetadata(sheetIdx: number, tableIdx: number, metadata: any) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = update_visual_metadata(
                    ${sheetIdx},
                    ${tableIdx},
                    json.loads(${JSON.stringify(JSON.stringify(metadata))})
                )
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public updateSheetMetadata(sheetIdx: number, metadata: any) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = update_sheet_metadata(
                    ${sheetIdx},
                    json.loads(${JSON.stringify(JSON.stringify(metadata))})
                )
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public addTable(sheetIdx: number, tableName: string) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = add_table(${sheetIdx}, ${JSON.stringify(tableName)})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public renameTable(sheetIdx: number, tableIdx: number, newName: string) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = rename_table(${sheetIdx}, ${tableIdx}, ${JSON.stringify(newName)})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public deleteTable(sheetIdx: number, tableIdx: number) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = delete_table(${sheetIdx}, ${tableIdx})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
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
            let lastResult: any = null;
            // Handle multi-cell range: update each cell individually
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const resultJson = await this.runPythonAsync(`
                    import json
                    res = update_cell(${sheetIdx}, ${tableIdx}, ${r}, ${c}, ${JSON.stringify(newValue)})
                    json.dumps(res) if res else "null"
                `);
                    lastResult = JSON.parse(resultJson);
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
            const resultJson = await this.runPythonAsync(`
                import json
                res = delete_row(${sheetIdx}, ${tableIdx}, ${rowIndex})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public deleteColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = delete_column(${sheetIdx}, ${tableIdx}, ${colIndex})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public insertRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = insert_row(${sheetIdx}, ${tableIdx}, ${rowIndex})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public insertColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = insert_column(${sheetIdx}, ${tableIdx}, ${colIndex})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public clearColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = clear_column(${sheetIdx}, ${tableIdx}, ${colIndex})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
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
            const resultJson = await this.runPythonAsync(`
                import json
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
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public updateColumnFilter(sheetIdx: number, tableIdx: number, colIndex: number, filter: any) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = update_column_filter(
                    ${sheetIdx},
                    ${tableIdx},
                    ${colIndex},
                    json.loads(${JSON.stringify(JSON.stringify(filter || null))})
                )
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public sortRows(sheetIdx: number, tableIdx: number, colIndex: number, direction: 'asc' | 'desc') {
        this._enqueueRequest(async () => {
            const ascending = direction === 'asc' ? 'True' : 'False';
            const resultJson = await this.runPythonAsync(`
                import json
                res = sort_rows(
                    ${sheetIdx},
                    ${tableIdx},
                    ${colIndex},
                    ${ascending}
                )
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public updateColumnAlign(
        sheetIdx: number,
        tableIdx: number,
        colIndex: number,
        align: 'left' | 'center' | 'right' | null
    ) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = update_column_align(
                    ${sheetIdx},
                    ${tableIdx},
                    ${colIndex},
                    json.loads(${JSON.stringify(JSON.stringify(align))})
                )
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public updateColumnFormat(sheetIdx: number, tableIdx: number, colIndex: number, format: any) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = update_column_format(
                    ${sheetIdx},
                    ${tableIdx},
                    ${colIndex},
                    json.loads(${JSON.stringify(JSON.stringify(format || null))})
                )
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public updateColumnWidth(sheetIdx: number, tableIdx: number, colIndex: number, width: number) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = update_column_width(
                    ${sheetIdx}, 
                    ${tableIdx}, 
                    ${colIndex}, 
                    ${width}
                )
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public addSheet(newSheetName: string) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = add_sheet(${JSON.stringify(newSheetName)})
                json.dumps(res) if res else "null"
            `);
            const updateSpec = JSON.parse(resultJson);
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
            const resultJson = await this.runPythonAsync(`
                import json
                res = rename_sheet(${sheetIdx}, ${JSON.stringify(newName)})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public deleteSheet(sheetIdx: number) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = delete_sheet(${sheetIdx})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public moveSheet(fromIdx: number, toIdx: number) {
        this._enqueueRequest(async () => {
            const resultJson = await this.runPythonAsync(`
                import json
                res = move_sheet(${fromIdx}, ${toIdx})
                json.dumps(res) if res else "null"
            `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    public async getDocumentSectionRange(docIndex: number) {
        const resultJson = await this.runPythonAsync(`
            import json
            result = get_document_section_range(workbook, ${docIndex})
            json.dumps(result)
        `);
        return JSON.parse(resultJson);
    }

    public async initializeWorkbook(mdText: string, config: any) {
        if (!this.pyodide) throw new Error('Pyodide not initialized');
        this.pyodide.globals.set('md_text', mdText);
        this.pyodide.globals.set('config', JSON.stringify(config));

        const resultJson = await this.runPythonAsync(`
            initialize_workbook(md_text, config)
            get_state()
        `);
        return JSON.parse(resultJson);
    }
}
