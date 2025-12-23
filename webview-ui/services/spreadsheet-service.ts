import { IPyodide, IVSCodeApi, IUpdateSpec, IVisualMetadata } from './types';

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
                    await this.runPythonAsync(`
                        import sys
                        sys.path.append("${mountDir}/site-packages")
                    `);
                } else {
                    console.log('Pyodide: Installing packages...');
                    await this.pyodide.loadPackage('micropip');
                    const micropip = this.pyodide.pyimport('micropip') as { install: (uri: string) => Promise<void> };

                    if (wheelUri) {
                        await micropip.install(wheelUri);

                        if (this.pyodide.FS) {
                            console.log('Pyodide: Caching packages...');
                            this.pyodide.globals.set('wheel_uri', wheelUri);
                            this.pyodide.globals.set('mount_dir', mountDir);

                            await this.runPythonAsync(`
                                import shutil
                                import site
                                import os
                                
                                site_packages = site.getsitepackages()[0]
                                target = f"{mount_dir}/site-packages"
                                
                                if os.path.exists(target):
                                    shutil.rmtree(target)
                                
                                shutil.copytree(site_packages, target)
                                
                                with open(f"{mount_dir}/version.txt", "w") as f:
                                    f.write(wheel_uri)
                            `);

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
