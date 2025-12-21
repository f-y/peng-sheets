import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem } from '@vscode/webview-ui-toolkit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { t } from './utils/i18n';
import { mainStyles } from './styles/main-styles';

import './components/spreadsheet-toolbar';
import './components/spreadsheet-table';
import './components/spreadsheet-onboarding';
import './components/spreadsheet-document-view';
import './components/confirmation-modal';
import './components/layout-container';
import { TableJSON } from './components/spreadsheet-table';

// Register the VS Code Design System components
provideVSCodeDesignSystem().register();

declare const loadPyodide: any;

interface SheetJSON {
    name: string;
    header_line?: number;
    tables: TableJSON[];
    metadata?: any;
}

interface DocumentJSON {
    type: 'document';
    title: string;
    content: string;
}

interface WorkbookJSON {
    sheets: SheetJSON[];
}

interface TabDefinition {
    type: 'sheet' | 'document' | 'onboarding' | 'add-sheet';
    title: string;
    index: number;
    sheetIndex?: number;
    docIndex?: number; // Document section index for document tabs
    data?: any;
}

interface StructureItem {
    type: 'workbook' | 'document';
    title?: string;
    content?: string;
}

// Acquire VS Code API
const vscode = acquireVsCodeApi();

// @ts-expect-error Vite raw import for Python module
import pythonCore from '../python-modules/headless_editor.py?raw';

@customElement('md-spreadsheet-editor')
export class MyEditor extends LitElement {
    static styles = [mainStyles];

    @state()
    pyodide: any = null;

    @state()
    output: string = t('initializing');

    @state()
    markdownInput: string = '';

    @state()
    config: any = {};

    @state()
    workbook: WorkbookJSON | null = null;

    @state()
    tabs: TabDefinition[] = [];

    @state()
    activeTabIndex = 0;

    @state()
    editingTabIndex: number | null = null;

    @state()
    pendingAddSheet = false;

    @state()
    confirmDeleteIndex: number | null = null;

    @state()
    tabContextMenu: { x: number; y: number; index: number } | null = null;

    @state()
    isScrollableRight = false;
    @state()
    private _isSyncing = false;
    private _requestQueue: Array<() => Promise<void>> = [];
    private _previousSheetCount = 0; // Track sheet count for add detection

    private _debounceTimer: any = null;
    private _isBatching = false;
    private _pendingUpdateSpec: any = null;

    private _enqueueRequest(task: () => Promise<void>) {
        this._requestQueue.push(task);
        if (!this._isSyncing) {
            this._scheduleProcessQueue();
        }
    }

    private _scheduleProcessQueue() {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this._processQueue();
        }, 100);
    }

    private async _processQueue() {
        this._debounceTimer = null;
        if (this._isSyncing || this._requestQueue.length === 0) return;

        this._isSyncing = true;
        this._isBatching = true;
        this._pendingUpdateSpec = null;

        // Process ALL pending tasks to batch updates
        const tasks = [...this._requestQueue];
        this._requestQueue = [];

        for (const task of tasks) {
            try {
                await task();
            } catch (e) {
                console.error('Queue task failed', e);
            }
        }

        this._isBatching = false;

        if (this._pendingUpdateSpec) {
            vscode.postMessage(this._pendingUpdateSpec);
            this._pendingUpdateSpec = null;
        } else {
            // No valid updates produced (or all failed)
            this._isSyncing = false;
            // Check if new items arrived while processing
            if (this._requestQueue.length > 0) {
                this._scheduleProcessQueue();
            }
        }
    }

    private async _handleMetadataEdit(detail: any) {
        if (!this.pyodide || !this.workbook) return;
        const { sheetIndex, tableIndex, name, description } = detail;

        // Optimistic Update: Update local state immediately to avoid UI flicker
        const targetTab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (targetTab && targetTab.data && targetTab.data.tables) {
            const table = targetTab.data.tables[tableIndex];
            if (table) {
                // Update values directly
                table.name = name;
                table.description = description;

                // Force Lit to re-render with new values
                this.requestUpdate();
            }
        }

        this._enqueueRequest(async () => {
            const result = await this.pyodide.runPythonAsync(`
            import json
            res = update_table_metadata(
                ${sheetIndex}, 
                ${tableIndex}, 
                ${JSON.stringify(name)}, 
                ${JSON.stringify(description)}
            )
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(result));
        });
    }

    /**
     * Handle description-only updates from ss-metadata-editor
     */
    private async _handleMetadataUpdate(detail: any) {
        if (!this.pyodide || !this.workbook) return;
        const { sheetIndex, tableIndex, description } = detail;

        // Get current table name from local state
        const targetTab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        let currentName = '';
        if (targetTab && targetTab.data && targetTab.data.tables) {
            const table = targetTab.data.tables[tableIndex];
            if (table) {
                currentName = table.name || '';
                // Optimistic update
                table.description = description;
                this.requestUpdate();
            }
        }

        this._enqueueRequest(async () => {
            const result = await this.pyodide.runPythonAsync(`
            import json
            res = update_table_metadata(
                ${sheetIndex}, 
                ${tableIndex}, 
                ${JSON.stringify(currentName)}, 
                ${JSON.stringify(description)}
            )
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(result));
        });
    }

    private async _handleVisualMetadataUpdate(detail: any) {
        if (!this.pyodide) return;
        const { sheetIndex, tableIndex, metadata } = detail;
        this._enqueueRequest(async () => {
            const result = await this.pyodide.runPythonAsync(`
            import json
            res = update_visual_metadata(
                ${sheetIndex}, 
                ${tableIndex}, 
                ${JSON.stringify(metadata)}
            )
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(result));
        });
    }

    private async _handleSheetMetadataUpdate(detail: any) {
        if (!this.pyodide) return;
        const { sheetIndex, metadata } = detail;
        // Optimistic Update: Update local state immediately
        const targetTab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (targetTab && targetTab.data) {
            targetTab.data.metadata = {
                ...(targetTab.data.metadata || {}),
                ...metadata
            };
            this.requestUpdate();
        }

        this._enqueueRequest(async () => {
            try {
                const metadataJson = JSON.stringify(metadata);
                // Escape backslashes and single quotes/newlines for Python string literal
                const escapedJson = metadataJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

                const result = await this.pyodide.runPythonAsync(`
            import json
            output_json = "null"
            try:
                data = json.loads('${escapedJson}')
                res = update_sheet_metadata(${sheetIndex}, data)
                output_json = json.dumps(res) if res else "null"
            except Exception as e:
                output_json = json.dumps({"error": str(e)})
            output_json
        `);
                const parsed = JSON.parse(result);
                if (parsed && parsed.error) {
                    console.error('Python metadata update error:', parsed.error);
                } else {
                    this._postUpdateMessage(parsed);
                }
            } catch (e) {
                console.error('Failed to run python metadata update:', e);
            }
        });
    }

    private async _handleRequestAddTable(detail: any) {
        if (!this.pyodide) return;
        const { sheetIndex } = detail;
        this._enqueueRequest(async () => {
            const result = await this.pyodide.runPythonAsync(`
            import json
            res = add_table(${sheetIndex})
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(result));
        });
    }

    private async _handleRequestRenameTable(detail: any) {
        if (!this.pyodide || !this.workbook) return;
        const { sheetIndex, tableIndex, newName } = detail;

        // Find current description from local state
        let currentDesc = '';
        const targetTab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (targetTab && targetTab.data && targetTab.data.tables) {
            const table = targetTab.data.tables[tableIndex];
            if (table) currentDesc = table.description || '';
        }

        // Reuse existing metadata edit logic which handles optimistic updates
        this._handleMetadataEdit({
            sheetIndex,
            tableIndex,
            name: newName,
            description: currentDesc
        });
    }

    private async _handleRequestDeleteTable(detail: any) {
        if (!this.pyodide) return;
        const { sheetIndex, tableIndex } = detail;
        this._enqueueRequest(async () => {
            const result = await this.pyodide.runPythonAsync(`
            import json
            res = delete_table(${sheetIndex}, ${tableIndex})
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(result));
        });
    }

    private _onMetadataChange(e: CustomEvent) {
        this._handleVisualMetadataUpdate(e.detail);
    }

    private async _onCellEdit(e: CustomEvent) {
        const { sheetIndex, tableIndex, rowIndex, colIndex, newValue } = e.detail;
        await this._handleRangeEdit(sheetIndex, tableIndex, rowIndex, rowIndex, colIndex, colIndex, newValue);
    }

    private async _onRangeEdit(e: CustomEvent) {
        const { sheetIndex, tableIndex, startRow, endRow, startCol, endCol, newValue } = e.detail;
        await this._handleRangeEdit(sheetIndex, tableIndex, startRow, endRow, startCol, endCol, newValue);
    }

    private async _handleRangeEdit(
        sheetIdx: number,
        tableIdx: number,
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number,
        newValue: string
    ) {
        if (!this.pyodide) return;

        // Handle multi-cell range: update each cell individually
        this._enqueueRequest(async () => {
            let lastResult: any = null;
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const resultJson = await this.pyodide.runPythonAsync(`
                    import json
                    res = update_cell(${sheetIdx}, ${tableIdx}, ${r}, ${c}, ${JSON.stringify(newValue)})
                    json.dumps(res) if res else "null"
                `);
                    lastResult = JSON.parse(resultJson);
                }
            }
            // Only post update message once with the final result (which contains the full workbook state)
            this._postUpdateMessage(lastResult);
        });
    }

    private async _handleDeleteRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        if (!this.pyodide) return;
        this._enqueueRequest(async () => {
            const resultJson = await this.pyodide.runPythonAsync(`
            import json
            res = delete_row(${sheetIdx}, ${tableIdx}, ${rowIndex})
            json.dumps(res) if res else "null"
       `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    private async _handleDeleteColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        if (!this.pyodide) return;
        this._enqueueRequest(async () => {
            const resultJson = await this.pyodide.runPythonAsync(`
            import json
            res = delete_column(${sheetIdx}, ${tableIdx}, ${colIndex})
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    private async _handleInsertRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        if (!this.pyodide) return;
        this._enqueueRequest(async () => {
            const resultJson = await this.pyodide.runPythonAsync(`
            import json
            res = insert_row(${sheetIdx}, ${tableIdx}, ${rowIndex})
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    private async _handleInsertColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        if (!this.pyodide) return;
        this._enqueueRequest(async () => {
            const resultJson = await this.pyodide.runPythonAsync(`
            import json
            res = insert_column(${sheetIdx}, ${tableIdx}, ${colIndex})
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    private async _handleClearColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        if (!this.pyodide) return;
        this._enqueueRequest(async () => {
            const resultJson = await this.pyodide.runPythonAsync(`
            import json
            res = clear_column(${sheetIdx}, ${tableIdx}, ${colIndex})
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    private async _handlePasteCells(detail: any) {
        if (!this.pyodide) return;
        const { sheetIndex, tableIndex, startRow, startCol, data, includeHeaders } = detail;
        this._enqueueRequest(async () => {
            const resultJson = await this.pyodide.runPythonAsync(`
            import json
            res = paste_cells(${sheetIndex}, ${tableIndex}, ${startRow}, ${startCol}, ${JSON.stringify(data)}, ${includeHeaders ? 'True' : 'False'})
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    private async _handleUpdateColumnFilter(detail: any) {
        if (!this.pyodide) return;
        const { sheetIndex, tableIndex, colIndex, hiddenValues } = detail;
        this._enqueueRequest(async () => {
            const resultJson = await this.pyodide.runPythonAsync(`
             import json
             res = update_column_filter(${sheetIndex}, ${tableIndex}, ${colIndex}, ${JSON.stringify(hiddenValues)})
             json.dumps(res) if res else "null"
         `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    private async _handleSortRows(detail: any) {
        if (!this.pyodide) return;
        const { sheetIndex, tableIndex, colIndex, ascending } = detail;
        this._enqueueRequest(async () => {
            const resultJson = await this.pyodide.runPythonAsync(`
             import json
             # Python implementation uses True/False which JSON handles
             res = sort_rows(${sheetIndex}, ${tableIndex}, ${colIndex}, ${ascending ? 'True' : 'False'})
             json.dumps(res) if res else "null"
         `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    private async _handleUpdateColumnAlign(detail: any) {
        if (!this.pyodide) return;
        const { sheetIndex, tableIndex, colIndex, alignment } = detail;
        this._enqueueRequest(async () => {
            const resultJson = await this.pyodide.runPythonAsync(`
              import json
              res = update_column_align(${sheetIndex}, ${tableIndex}, ${colIndex}, ${JSON.stringify(alignment)})
              json.dumps(res) if res else "null"
          `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    private async _handleUpdateColumnFormat(detail: any) {
        if (!this.pyodide) return;
        const { sheetIndex, tableIndex, colIndex, format } = detail;
        // Convert null to Python None, otherwise use JSON with Python boolean conversion
        let formatArg = 'None';
        if (format !== null) {
            // Convert JSON to Python-compatible format:
            // - true -> True, false -> False
            formatArg = JSON.stringify(format)
                .replace(/\btrue\b/g, 'True')
                .replace(/\bfalse\b/g, 'False');
        }
        this._enqueueRequest(async () => {
            const resultJson = await this.pyodide.runPythonAsync(`
              import json
              res = update_column_format(${sheetIndex}, ${tableIndex}, ${colIndex}, ${formatArg})
              json.dumps(res) if res else "null"
          `);
            this._postUpdateMessage(JSON.parse(resultJson));
        });
    }

    private _handlePostMessage(detail: any) {
        switch (detail.command) {
            case 'update_column_filter':
                this._handleUpdateColumnFilter(detail);
                break;
            case 'sort_rows':
                this._handleSortRows(detail);
                break;
            case 'update_column_align':
                this._handleUpdateColumnAlign(detail);
                break;
            case 'update_column_format':
                this._handleUpdateColumnFormat(detail);
                break;
            default:
                console.warn('Unknown post-message command:', detail.command);
        }
    }

    private async _handleDocumentChange(detail: { sectionIndex: number; content: string; title?: string }) {
        console.log('Document change received:', detail);

        // Find the active document tab
        const activeTab = this.tabs[this.activeTabIndex];
        if (!activeTab || activeTab.type !== 'document') {
            console.warn('Document change event but no active document tab');
            return;
        }

        // Use the docIndex tracked when the tab was created
        const docIndex = activeTab.docIndex;
        if (docIndex === undefined) {
            console.error('Document tab missing docIndex');
            return;
        }

        try {
            // Get the document section range from Python using docIndex
            const result = this.pyodide?.runPython(`
import json
result = get_document_section_range(workbook, ${docIndex})
json.dumps(result)
            `);

            console.log('Python result:', result);

            if (result) {
                const range = JSON.parse(result);
                if (range && range.start_line !== undefined && range.end_line !== undefined) {
                    // Use title from event (may have been edited) or fall back to existing
                    const newTitle = detail.title || activeTab.title;
                    const header = `# ${newTitle}`;
                    // Ensure content ends with newline for separation from next section
                    const body = detail.content.endsWith('\n') ? detail.content : detail.content + '\n';
                    const fullContent = header + '\n' + body;

                    // Send update to VS Code
                    vscode.postMessage({
                        type: 'updateRange',
                        startLine: range.start_line,
                        endLine: range.end_line,
                        endCol: range.end_col,
                        content: fullContent
                    });

                    // Update local state including title
                    activeTab.title = newTitle;
                    activeTab.data.content = detail.content;
                    this.requestUpdate();

                    console.log('Document updated:', {
                        range,
                        title: newTitle,
                        content: fullContent.substring(0, 50) + '...'
                    });
                } else if (range && range.error) {
                    console.error('Python error:', range.error);
                }
            }
        } catch (error) {
            console.error('Failed to update document section:', error);
            // Fallback: just update local state without file save
            if (detail.title) {
                activeTab.title = detail.title;
            }
            activeTab.data.content = detail.content;
            this.requestUpdate();
        }
    }

    private _handleUndo() {
        vscode.postMessage({ type: 'undo' });
    }

    private _handleRedo() {
        vscode.postMessage({ type: 'redo' });
    }

    private _saveDebounceTimer: number | null = null;
    private _handleSave() {
        // Debounce save requests to prevent duplicate calls
        if (this._saveDebounceTimer !== null) {
            console.log('[Webview] Save already queued, skipping duplicate');
            return;
        }
        console.log('[Webview] _handleSave called, sending save message to extension host');
        vscode.postMessage({ type: 'save' });

        // Prevent another save for 500ms
        this._saveDebounceTimer = window.setTimeout(() => {
            this._saveDebounceTimer = null;
        }, 500);
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
            vscode.postMessage({
                type: 'updateRange',
                startLine: updateSpec.startLine,
                endLine: updateSpec.endLine,
                endCol: updateSpec.endCol, // Forward endCol if present
                content: updateSpec.content
            });
            // _isSyncing remains true until Extension sends 'update'
        } else {
            console.error('Operation failed: ', updateSpec?.error);
            this._isSyncing = false; // Reset if we didn't send
            this._scheduleProcessQueue();
        }
    }

    connectedCallback() {
        super.connectedCallback();
        try {
            const initialContent = (window as any).initialContent;
            if (initialContent) {
                this.markdownInput = initialContent;
            }

            const initialConfig = (window as any).initialConfig;
            if (initialConfig) {
                this.config = initialConfig;
            }
        } catch (e) {
            console.error('Error loading initial content:', e);
        }
        window.addEventListener('keydown', this._boundHandleKeyDown, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this._boundHandleKeyDown, true);
    }

    private _boundHandleKeyDown = this._handleGlobalKeyDown.bind(this);

    private _handleGlobalKeyDown(e: KeyboardEvent) {
        // Debug Log
        // console.log('Global keydown:', e.key, 'Ctrl:', e.ctrlKey, 'Meta:', e.metaKey, 'Shift:', e.shiftKey);

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            this._handleSave();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            console.log('Likely Undo detected');
            e.preventDefault();
            this._handleUndo();
        } else if (
            ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
            ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
        ) {
            console.log('Likely Redo detected');
            e.preventDefault();
            this._handleRedo();
        }
    }

    async firstUpdated() {
        try {
            this.pyodide = await loadPyodide();
            console.log('Loading micropip...');
            await this.pyodide.loadPackage('micropip');
            console.log('Micropip loaded.');

            const micropip = this.pyodide.pyimport('micropip');
            const wheelUri = (window as any).wheelUri;
            console.log('Installing wheel from:', wheelUri);

            try {
                await micropip.install(wheelUri);
                console.log('Wheel installed successfully.');
            } catch (err) {
                console.error('Micropip install failed:', err);
                throw err;
            }

            console.log('Loading Python Core...');
            await this.pyodide.runPythonAsync(pythonCore);
            console.log('Python Core loaded.');

            window.addEventListener('cell-edit', (e: any) => {
                this._handleRangeEdit(
                    e.detail.sheetIndex,
                    e.detail.tableIndex,
                    e.detail.rowIndex,
                    e.detail.rowIndex,
                    e.detail.colIndex,
                    e.detail.colIndex,
                    e.detail.newValue
                );
            });

            window.addEventListener('range-edit', (e: any) => {
                this._handleRangeEdit(
                    e.detail.sheetIndex,
                    e.detail.tableIndex,
                    e.detail.startRow,
                    e.detail.endRow,
                    e.detail.startCol,
                    e.detail.endCol,
                    e.detail.newValue
                );
            });

            window.addEventListener('row-delete', (e: any) => {
                this._handleDeleteRow(e.detail.sheetIndex, e.detail.tableIndex, e.detail.rowIndex);
            });

            window.addEventListener('row-insert', (e: any) => {
                this._handleInsertRow(e.detail.sheetIndex, e.detail.tableIndex, e.detail.rowIndex);
            });

            window.addEventListener('column-delete', (e: any) => {
                this._handleDeleteColumn(e.detail.sheetIndex, e.detail.tableIndex, e.detail.colIndex);
            });

            window.addEventListener('column-insert', (e: any) => {
                this._handleInsertColumn(e.detail.sheetIndex, e.detail.tableIndex, e.detail.colIndex);
            });

            window.addEventListener('column-clear', (e: any) => {
                this._handleClearColumn(e.detail.sheetIndex, e.detail.tableIndex, e.detail.colIndex);
            });

            window.addEventListener('column-resize', (e: any) => this._handleColumnResize(e.detail));
            window.addEventListener('metadata-edit', (e: any) => this._handleMetadataEdit(e.detail));
            window.addEventListener('metadata-update', (e: any) => this._handleMetadataUpdate(e.detail));
            window.addEventListener('request-add-table', (e: any) => this._handleRequestAddTable(e.detail));
            window.addEventListener('request-rename-table', (e: any) => this._handleRequestRenameTable(e.detail));
            window.addEventListener('request-delete-table', (e: any) => this._handleRequestDeleteTable(e.detail));
            window.addEventListener('metadata-change', (e: any) => this._handleVisualMetadataUpdate(e.detail));
            window.addEventListener('sheet-metadata-update', (e: any) => this._handleSheetMetadataUpdate(e.detail));
            window.addEventListener('paste-cells', (e: any) => this._handlePasteCells(e.detail));
            window.addEventListener('post-message', (e: any) => this._handlePostMessage(e.detail));
            window.addEventListener('document-change', (e: any) => this._handleDocumentChange(e.detail));

            window.addEventListener('message', async (event) => {
                const message = event.data;
                switch (message.type) {
                    case 'update':
                        this.markdownInput = message.content;
                        await this._parseWorkbook();
                        this._isSyncing = false;
                        this._processQueue();
                        break;
                    case 'configUpdate':
                        this.config = message.config;
                        await this._parseWorkbook();
                        break;
                    case 'sync-failed':
                        // Error recovery
                        console.warn('Sync failed, resetting queue state.');
                        this._isSyncing = false;
                        this._processQueue(); // Try next? or clear?
                        break;
                }
            });

            console.log('Pyodide initialized. Parsing initial content...');
            await this._parseWorkbook();
        } catch (e: any) {
            console.error('Error initializing Pyodide:', e);
            this.output = `Error initializing Pyodide: ${e}`;
        }
    }

    willUpdate(changedProperties: Map<string, any>) {
        if (changedProperties.has('tabs')) {
            const tabs = this.tabs;
            const currentSheetCount = tabs.filter((t) => t.type === 'sheet').length;
            const sheetWasAdded = currentSheetCount === this._previousSheetCount + 1;

            // Handle Add Sheet Selection
            // Use pendingAddSheet flag OR detect sheet count increase as fallback
            if (this.pendingAddSheet || (sheetWasAdded && this._previousSheetCount > 0)) {
                // Find the 'add-sheet' button and select the tab immediately before it
                // (which is the newly added sheet). This handles cases where Documents
                // appear after the Workbook in the tabs array.
                const addSheetIndex = tabs.findIndex((tab) => tab.type === 'add-sheet');
                if (addSheetIndex > 0) {
                    // Select the tab before the add-sheet button (the new sheet)
                    this.activeTabIndex = addSheetIndex - 1;
                } else if (addSheetIndex === 0) {
                    // Edge case: add-sheet is first (shouldn't happen normally)
                    this.activeTabIndex = 0;
                } else {
                    // No add-sheet button found, fallback to last sheet tab
                    const lastSheetIndex =
                        tabs
                            .map((t, i) => ({ t, i }))
                            .filter((x) => x.t.type === 'sheet')
                            .pop()?.i ?? 0;
                    this.activeTabIndex = lastSheetIndex;
                }
                this.pendingAddSheet = false;
            }
            // Sanitize activeTabIndex (fallback)
            else if (this.activeTabIndex >= tabs.length) {
                if (tabs.length > 0) {
                    this.activeTabIndex = tabs.length - 1;
                } else {
                    this.activeTabIndex = 0;
                }
            }

            // If active tab is "add-sheet" (+), try to select previous one
            // (This handles deletion case where index points to +)
            const activeTab = tabs[this.activeTabIndex];
            if (activeTab && activeTab.type === 'add-sheet') {
                if (this.activeTabIndex > 0) {
                    this.activeTabIndex = this.activeTabIndex - 1;
                }
            }

            // Update previous sheet count for next comparison
            this._previousSheetCount = currentSheetCount;
        }
    }

    render() {
        if (!this.tabs.length && !this.output) {
            return html`< div class="output" > ${t('loading')}</div>`;
        }

        return this._renderContent();
    }

    private _renderContent() {
        if (this.tabs.length === 0) {
            return html` <div class="output">${this.output}</div> `;
        }

        let activeTab = this.tabs[this.activeTabIndex];
        if (!activeTab && this.tabs.length > 0) {
            activeTab = this.tabs[0];
        }

        if (!activeTab) return html``;

        return html`
            ${activeTab.type !== 'document'
                ? html` <spreadsheet-toolbar @toolbar-action="${this._handleToolbarAction}"></spreadsheet-toolbar> `
                : html``}
            <div class="content-area">
                ${activeTab.type === 'sheet'
                    ? html`
                          <div class="sheet-container" style="height: 100%">
                              <layout-container
                                  .layout="${activeTab.data.metadata?.layout}"
                                  .tables="${activeTab.data.tables}"
                                  .sheetIndex="${activeTab.sheetIndex}"
                                  @save-requested="${this._handleSave}"
                              ></layout-container>
                          </div>
                      `
                    : activeTab.type === 'document'
                      ? html`
                            <spreadsheet-document-view
                                .title="${activeTab.title}"
                                .content="${activeTab.data.content}"
                            ></spreadsheet-document-view>
                        `
                      : html``}
                ${activeTab.type === 'onboarding'
                    ? html`
                          <spreadsheet-onboarding
                              @create-spreadsheet="${this._onCreateSpreadsheet}"
                          ></spreadsheet-onboarding>
                      `
                    : html``}
            </div>

            <div class="bottom-tabs-container">
                <div
                    class="bottom-tabs"
                    @scroll="${this._handleTabScroll}"
                    @dragover="${this._handleSheetDragOver}"
                    @drop="${this._handleSheetDrop}"
                    @dragleave="${this._handleSheetDragLeave}"
                >
                    ${this.tabs.map(
                        (tab, index) => html`
                            <div
                                class="tab-item ${this.activeTabIndex === index ? 'active' : ''} ${tab.type ===
                                'add-sheet'
                                    ? 'add-sheet-tab'
                                    : ''}"
                                draggable="${tab.type !== 'add-sheet' && this.editingTabIndex !== index}"
                                @click="${() =>
                                    tab.type === 'add-sheet' ? this._handleAddSheet() : (this.activeTabIndex = index)}"
                                @dblclick="${() => this._handleTabDoubleClick(index, tab)}"
                                @contextmenu="${(e: MouseEvent) => this._handleTabContextMenu(e, index, tab)}"
                                @dragstart="${(e: DragEvent) => this._handleSheetDragStart(e, index)}"
                                @dragend="${this._handleSheetDragEnd}"
                                title="${tab.type === 'add-sheet' ? 'Add New Sheet' : ''}"
                                data-index="${index}"
                            >
                                ${this._renderTabIcon(tab)}
                                ${this.editingTabIndex === index
                                    ? html`
                                          <input
                                              class="tab-input"
                                              .value="${tab.title}"
                                              @click="${(e: Event) => e.stopPropagation()}"
                                              @dblclick="${(e: Event) => e.stopPropagation()}"
                                              @keydown="${(e: KeyboardEvent) => this._handleTabInputKey(e, index, tab)}"
                                              @blur="${(e: Event) =>
                                                  this._handleTabRename(
                                                      index,
                                                      tab,
                                                      (e.target as HTMLInputElement).value
                                                  )}"
                                          />
                                      `
                                    : html` ${tab.type !== 'add-sheet' ? tab.title : ''} `}
                            </div>
                        `
                    )}
                </div>
                <div class="scroll-indicator-right ${this.isScrollableRight ? 'visible' : ''}"></div>
            </div>

            ${this.tabContextMenu
                ? html`
                      <div
                          style="position: fixed; top: ${this.tabContextMenu.y}px; left: ${this.tabContextMenu
                              .x}px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1000; padding: 4px 0; min-width: 150px;"
                      >
                          <div
                              style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                              @mouseover="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)')}"
                              @mouseout="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'transparent')}"
                              @click="${() => this._renameSheet(this.tabContextMenu!.index)}"
                          >
                              ${t('renameSheet')}
                          </div>
                          <div
                              style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                              @mouseover="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)')}"
                              @mouseout="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'transparent')}"
                              @click="${() => this._deleteSheet(this.tabContextMenu!.index)}"
                          >
                              ${t('deleteSheet')}
                          </div>
                      </div>
                      <!-- Overlay to close menu on click outside -->
                      <div
                          style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999;"
                          @click="${() => (this.tabContextMenu = null)}"
                      ></div>
                  `
                : ''}

            <!-- Delete Confirmation Modal -->
            <confirmation-modal
                .open="${this.confirmDeleteIndex !== null}"
                title="${t('deleteSheet')}"
                confirmLabel="${t('delete')}"
                cancelLabel="${t('cancel')}"
                @confirm="${this._performDelete}"
                @cancel="${this._cancelDelete}"
            >
                ${unsafeHTML(
                    t(
                        'deleteSheetConfirm',
                        `<span style="color: var(--vscode-textPreformat-foreground);">${
                            this.confirmDeleteIndex !== null
                                ? this.tabs[this.confirmDeleteIndex]?.title?.replace(/</g, '&lt;')
                                : ''
                        }</span>`
                    )
                )}
            </confirmation-modal>
        `;
    }

    private _renderTabIcon(tab: TabDefinition) {
        if (tab.type === 'sheet') {
            return html`<svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
            >
                <path d="M3 3h10v10H3V3zm1 1v3h3V4H4zm4 0v3h3V4H8zm-4 4v3h3V8H4zm4 0v3h3V8H4zm4 0v3h3V8H8z" />
            </svg>`;
        } else if (tab.type === 'document') {
            return html``;
        } else if (tab.type === 'add-sheet') {
            // Using the text content '+' in render loop, so maybe no icon needed?
            // Or return a plus icon SVG. Title is '+' in definition.
            // Let's use SVG for better look.
            return html`<svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
            >
                <path
                    d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"
                />
            </svg>`;
        } else {
            return html`<svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
            >
                <path d="M14 7H9V2H7v5H2v2h5v5h2V9h5V7z" />
            </svg>`;
        }
    }

    private _handleTabDoubleClick(index: number, tab: TabDefinition) {
        if (tab.type === 'sheet') {
            this.editingTabIndex = index;
            // Focus input after render? Lit handles it if we use ref, or simple timeout
            setTimeout(() => {
                const input = this.shadowRoot?.querySelector('.tab-input') as HTMLInputElement;
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 0);
        }
    }

    private _handleTabInputKey(e: KeyboardEvent, index: number, tab: TabDefinition) {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur(); // Trigger blur handler
        } else if (e.key === 'Escape') {
            this.editingTabIndex = null;
        }
    }

    private _handleTabContextMenu(e: MouseEvent, index: number, tab: TabDefinition) {
        if (tab.type !== 'sheet') return;
        e.preventDefault();
        this.tabContextMenu = { x: e.clientX, y: e.clientY - 80, index: index }; // Simple offset or just clientY
        // Adjust Y if too low?
    }

    private _renameSheet(index: number) {
        this.tabContextMenu = null;
        const tab = this.tabs[index];
        if (tab) this._handleTabDoubleClick(index, tab);
    }

    private _deleteSheet(index: number) {
        this.tabContextMenu = null;
        const tab = this.tabs[index];
        if (tab && tab.type === 'sheet' && typeof tab.sheetIndex === 'number') {
            // Trigger modal instead of confirm()
            this.confirmDeleteIndex = index;
        }
    }

    private _cancelDelete() {
        this.confirmDeleteIndex = null;
    }

    private async _performDelete() {
        const index = this.confirmDeleteIndex;
        if (index === null) return;

        // Close modal immediately
        this.confirmDeleteIndex = null;

        const tab = this.tabs[index];
        if (tab && tab.type === 'sheet' && typeof tab.sheetIndex === 'number') {
            if (!this.pyodide) return;
            try {
                const result = await this.pyodide.runPythonAsync(`
                    import json
                    res = delete_sheet(${tab.sheetIndex})
                    json.dumps(res) if res else "null"
                `);
                const updateSpec = JSON.parse(result);
                if (updateSpec && !updateSpec.error) {
                    vscode.postMessage({
                        type: 'updateRange',
                        startLine: updateSpec.startLine,
                        endLine: updateSpec.endLine,
                        endCol: updateSpec.endCol,
                        content: updateSpec.content
                    });
                } else if (updateSpec.error) {
                    console.error('Delete failed:', updateSpec.error);
                }
            } catch (e) {
                console.error('Python error:', e);
            }
        }
    }

    private async _handleTabRename(index: number, tab: TabDefinition, newName: string) {
        if (this.editingTabIndex !== index) return;
        this.editingTabIndex = null; // Exit edit mode

        if (!newName || newName === tab.title) return;
        if (!this.pyodide || !this.workbook) return;

        if (tab.type === 'sheet' && typeof tab.sheetIndex === 'number') {
            try {
                const result = await this.pyodide.runPythonAsync(`
                import json
                res = rename_sheet(${tab.sheetIndex}, ${JSON.stringify(newName)})
                json.dumps(res) if res else "null"
            `);
                const updateSpec = JSON.parse(result);
                if (updateSpec && !updateSpec.error) {
                    vscode.postMessage({
                        type: 'updateRange',
                        startLine: updateSpec.startLine,
                        endLine: updateSpec.endLine,
                        content: updateSpec.content
                    });
                } else if (updateSpec.error) {
                    console.error('Rename failed:', updateSpec.error);
                }
            } catch (e) {
                console.error(e);
            }
        }
    }

    private async _handleAddSheet() {
        if (!this.pyodide) return;

        this.pendingAddSheet = true;

        let newSheetName = 'Sheet 1';
        if (this.workbook && this.workbook.sheets) {
            newSheetName = `Sheet ${this.workbook.sheets.length + 1}`;
        }

        try {
            const result = await this.pyodide.runPythonAsync(`
            import json
            res = add_sheet(${JSON.stringify(newSheetName)})
            json.dumps(res) if res else "null"
        `);

            const updateSpec = JSON.parse(result);

            if (updateSpec) {
                if (updateSpec.error) {
                    console.error('Add Sheet failed:', updateSpec.error);
                    return;
                }

                vscode.postMessage({
                    type: 'updateRange',
                    startLine: updateSpec.startLine,
                    endLine: updateSpec.endLine,
                    content: updateSpec.content
                });
            }
        } catch (err) {
            console.error('Failed to add sheet:', err);
        }
    }

    private _onCreateSpreadsheet() {
        vscode.postMessage({ type: 'createSpreadsheet' });
    }

    private async _parseWorkbook() {
        if (!this.pyodide) return;
        try {
            // 2. Initialization Phase
            this.pyodide.globals.set('md_text', this.markdownInput);
            this.pyodide.globals.set('config', JSON.stringify(this.config));

            const resultJson = await this.pyodide.runPythonAsync(`
        initialize_workbook(md_text, config)
        get_state()
      `);

            if (!resultJson) return;

            const result = JSON.parse(resultJson);
            this.workbook = result.workbook;

            const structure: StructureItem[] = result.structure;
            const newTabs: TabDefinition[] = [];
            let workbookFound = false;
            let docIndex = 0; // Track document section index separately

            // Reconstruct Tabs from Structure
            for (const section of structure) {
                if (section.type === 'document') {
                    newTabs.push({
                        type: 'document',
                        title: section.title!,
                        index: newTabs.length,
                        docIndex: docIndex++, // Store document section index
                        data: section
                    });
                } else if (section.type === 'workbook') {
                    workbookFound = true;
                    if (this.workbook && this.workbook.sheets.length > 0) {
                        this.workbook.sheets.forEach((sheet: any, shIdx: number) => {
                            newTabs.push({
                                type: 'sheet',
                                title: sheet.name || `Sheet ${shIdx + 1}`,
                                index: newTabs.length,
                                sheetIndex: shIdx,
                                data: sheet
                            });
                        });
                        // Add "Add Sheet" button
                        newTabs.push({
                            type: 'add-sheet',
                            title: '+',
                            index: newTabs.length
                        });
                    } else {
                        // Empty workbook placeholder
                        newTabs.push({
                            type: 'onboarding',
                            title: 'New Spreadsheet',
                            index: newTabs.length
                        });
                    }
                }
            }

            if (!workbookFound) {
                // If no workbook marker found, add empty placeholder at end
                newTabs.push({
                    type: 'onboarding',
                    title: 'New Spreadsheet',
                    index: newTabs.length
                });
            }

            this.tabs = newTabs;

            this.requestUpdate();

            // Update output message if successful
            this.output = 'Parsed successfully!';

            // Send structure to host
            vscode.postMessage({
                type: 'updateStructure',
                structure: result.structure
            });
        } catch (err: any) {
            console.error(err);
            this.output = `Error parsing: ${err.message}`;
            this.workbook = null;
            this.tabs = [];
        }
    }

    private _handleSheetDragStart(e: DragEvent, index: number) {
        if (!e.dataTransfer) return;
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';
    }

    private _handleSheetDragOver(e: DragEvent) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';

        const tabs = this.shadowRoot?.querySelectorAll('.tab-item');
        tabs?.forEach((t) => t.classList.remove('drag-over-left', 'drag-over-right'));

        const target = e
            .composedPath()
            .find(
                (n) => (n as HTMLElement).classList && (n as HTMLElement).classList.contains('tab-item')
            ) as HTMLElement;
        if (target && !target.classList.contains('add-sheet-tab')) {
            const rect = target.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            if (e.clientX < mid) target.classList.add('drag-over-left');
            else target.classList.add('drag-over-right');
        }
    }

    private _handleSheetDragLeave(e: DragEvent) {
        // Optional cleanup
    }

    private _handleSheetDragEnd() {
        const tabs = this.shadowRoot?.querySelectorAll('.tab-item');
        tabs?.forEach((t) => t.classList.remove('drag-over-left', 'drag-over-right'));
    }

    private async _handleSheetDrop(e: DragEvent) {
        e.preventDefault();
        this._handleSheetDragEnd();

        const fromIndexStr = e.dataTransfer?.getData('text/plain');
        if (!fromIndexStr) return;
        const fromIndex = parseInt(fromIndexStr);
        if (isNaN(fromIndex)) return;

        const target = e
            .composedPath()
            .find(
                (n) => (n as HTMLElement).classList && (n as HTMLElement).classList.contains('tab-item')
            ) as HTMLElement;
        let toIndex = -1;

        if (target) {
            const indexAttr = target.getAttribute('data-index');
            if (indexAttr) {
                const initialIndex = parseInt(indexAttr);
                if (!isNaN(initialIndex)) {
                    const rect = target.getBoundingClientRect();
                    const mid = rect.left + rect.width / 2;
                    toIndex = e.clientX < mid ? initialIndex : initialIndex + 1;
                }
            }
        } else if ((e.target as HTMLElement).classList.contains('bottom-tabs')) {
            const addTab = this.tabs.find((t) => t.type === 'add-sheet');
            if (addTab) {
                toIndex = addTab.index;
            } else {
                toIndex = this.tabs.length;
            }
        }

        if (toIndex !== -1 && fromIndex !== toIndex) {
            const fromTab = this.tabs[fromIndex];

            if (fromTab.type !== 'sheet') return;

            const fromSheetIndex = fromTab.sheetIndex!;
            let toSheetIndex = 0;

            if (toIndex < this.tabs.length) {
                const toTab = this.tabs[toIndex];
                // Map to sheet indices
                if (toTab.type === 'sheet') {
                    toSheetIndex = toTab.sheetIndex!;
                } else if (toTab.type === 'add-sheet') {
                    const sheets = this.tabs.filter((t) => t.type === 'sheet');
                    toSheetIndex = sheets.length;
                } else {
                    toSheetIndex = 0;
                }
            } else {
                const sheets = this.tabs.filter((t) => t.type === 'sheet');
                toSheetIndex = sheets.length;
            }

            this._moveSheet(fromSheetIndex, toSheetIndex);
        }
    }

    private async _moveSheet(from: number, to: number) {
        if (from === to) return;

        if (from < to) {
            to -= 1;
        }

        this._enqueueRequest(async () => {
            const result = await this.pyodide.runPythonAsync(`
              res = move_sheet(${from}, ${to})
              json.dumps(res) if res else "null"
          `);
            const updateSpec = JSON.parse(result);
            if (updateSpec && !updateSpec.error) {
                vscode.postMessage({
                    type: 'updateRange',
                    startLine: updateSpec.startLine,
                    endLine: updateSpec.endLine,
                    content: updateSpec.content
                });
            } else if (updateSpec && updateSpec.error) {
                console.error('Move Sheet Error:', updateSpec.error);
            }
        });
    }

    private async _handleColumnResize(detail: any) {
        if (!this.pyodide) return;
        const { sheetIndex, tableIndex, col, width } = detail;
        this._enqueueRequest(async () => {
            const result = await this.pyodide.runPythonAsync(`
            import json
            res = update_column_width(
                ${sheetIndex}, 
                ${tableIndex}, 
                ${col}, 
                ${width}
            )
            json.dumps(res) if res else "null"
        `);
            this._postUpdateMessage(JSON.parse(result));
        });
    }

    private _handleToolbarAction(e: CustomEvent) {
        console.log('Main: _handleToolbarAction', e.detail);
        const action = e.detail.action;

        // Handle undo/redo at main.ts level (not delegated to table)
        if (action === 'undo') {
            this._handleUndo();
            return;
        }
        if (action === 'redo') {
            this._handleRedo();
            return;
        }

        // Delegate other actions to active table
        const table = (window as any).activeSpreadsheetTable;
        if (table && table.handleToolbarAction) {
            table.handleToolbarAction(action);
        } else {
            console.warn('Main: No active table found to handle action');
        }
    }

    updated(changedProperties: Map<string, any>) {
        if (changedProperties.has('tabs') || changedProperties.has('activeTabIndex')) {
            // Defer to ensure layout is complete
            setTimeout(() => this._checkScrollOverflow(), 0);
        }
    }

    private _handleTabScroll() {
        this._checkScrollOverflow();
    }

    private _checkScrollOverflow() {
        const container = this.shadowRoot?.querySelector('.bottom-tabs') as HTMLElement;
        if (container) {
            // Tolerance of 2px
            const isScrollable = container.scrollWidth > container.clientWidth;
            const isAtEnd = Math.abs(container.scrollWidth - container.clientWidth - container.scrollLeft) < 2;

            const shouldShow = isScrollable && !isAtEnd;

            if (this.isScrollableRight !== shouldShow) {
                this.isScrollableRight = shouldShow;
            }
        }
    }
}

// Add global definition for acquireVsCodeApi
declare function acquireVsCodeApi(): any;
