import { html, css, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provideVSCodeDesignSystem } from "@vscode/webview-ui-toolkit";

import "./components/spreadsheet-toolbar";
import "./components/spreadsheet-table";
import "./components/spreadsheet-onboarding";
import "./components/spreadsheet-document-view";
import "./components/confirmation-modal";
import { TableJSON } from "./components/spreadsheet-table";

// Register the VS Code Design System components
provideVSCodeDesignSystem().register();

declare const loadPyodide: any;

interface SheetJSON {
  name: string;
  header_line?: number;
  tables: TableJSON[];
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
  data?: any;
}

interface StructureItem {
  type: 'workbook' | 'document';
  title?: string;
  content?: string;
}

// Acquire VS Code API
const vscode = acquireVsCodeApi();

// @ts-ignore
import pythonCore from '../python-modules/headless_editor.py?raw';

@customElement("md-spreadsheet-editor")
export class MyEditor extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
    }

    /* Toolbar Section */
    spreadsheet-toolbar {
      flex: 0 0 auto;
    }

    /* Content Section (Grow) */
    .content-area {
      flex: 1 1 auto;
      overflow: auto;
      position: relative;
    }

    .sheet-view {
      height: 100%;
      display: none;
    }
    
    .sheet-view.active {
      display: block;
    }

    .sheet-container {
      padding: 0;
    }

    /* Bottom Tabs Section */
    .bottom-tabs {
      flex: 0 0 auto;
      display: flex;
      background: var(--vscode-editor-background); /* Or slightly darker/lighter */
      border-top: 1px solid var(--vscode-widget-border);
      overflow-x: auto;
    }

    .tab-item {
      padding: 5px 10px;
      cursor: pointer;
      border-right: 1px solid var(--vscode-widget-border);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      font-size: 13px;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 60px;
      gap: 6px;
    }

    .tab-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .tab-item.active {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
      font-weight: bold;
    }

    .tab-item.add-sheet-tab {
      min-width: 30px;
      padding: 5px;
      justify-content: center;
    }

    }

    .tab-input {
        font-family: inherit;
        font-size: inherit;
        color: inherit;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 2px 4px;
        border-radius: 2px;
        width: 100px;
    }

    /* Context Menu */
    .context-menu {
      position: fixed;
      background: var(--vscode-menu-background);
      color: var(--vscode-menu-foreground);
      border: 1px solid var(--vscode-menu-border);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 1000;
      min-width: 150px;
      padding: 4px 0;
    }

    .context-menu-item {
      padding: 6px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      font-size: 13px;
    }

    .context-menu-item:hover {
      background: var(--vscode-menu-selectionBackground);
      color: var(--vscode-menu-selectionForeground);
    }
    
    /* Modal styles removed (moved to component) */

    .output {
        margin: 1rem;
        white-space: pre-wrap;
        font-family: monospace;
        background: var(--vscode-editor-background);
        padding: 0.5rem;
        border: 1px solid var(--vscode-widget-border);
    }
  `;

  @state()
  pyodide: any = null;

  @state()
  output: string = "Initializing Pyodide...";

  @state()
  markdownInput: string = "";

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
  tabContextMenu: { x: number, y: number, index: number } | null = null;
  @state()
  private _isSyncing = false;
  private _requestQueue: Array<() => Promise<void>> = [];

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
    }, 300);
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
        console.error("Queue task failed", e);
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
    const targetTab = this.tabs.find(t => t.type === 'sheet' && t.sheetIndex === sheetIndex);
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

  private async _handleRangeEdit(sheetIdx: number, tableIdx: number, startRow: number, endRow: number, startCol: number, endCol: number, newValue: string) {
    if (!this.pyodide) return;
    if (startRow !== endRow || startCol !== endCol) {
      console.warn("Multi-cell update not fully supported in managed block refactor yet, using first cell.");
    }

    this._enqueueRequest(async () => {
      const resultJson = await this.pyodide.runPythonAsync(`
            import json
            res = update_cell(${sheetIdx}, ${tableIdx}, ${startRow}, ${startCol}, ${JSON.stringify(newValue)})
            json.dumps(res) if res else "null"
        `);
      this._postUpdateMessage(JSON.parse(resultJson));
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
      console.error("Operation failed: ", updateSpec?.error);
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
      console.error("Error loading initial content:", e);
    }
  }

  async firstUpdated() {
    try {
      this.pyodide = await loadPyodide();
      console.log("Loading micropip...");
      await this.pyodide.loadPackage("micropip");
      console.log("Micropip loaded.");
      const micropip = this.pyodide.pyimport("micropip");
      const wheelUri = (window as any).wheelUri;
      console.log("Installing wheel from:", wheelUri);
      try {
        await micropip.install(wheelUri);
        console.log("Wheel installed successfully.");
      } catch (err) {
        console.error("Micropip install failed:", err);
        throw err;
      }


      // ... Python Helper Functions
      console.log("Loading Python Core...");
      await this.pyodide.runPythonAsync(pythonCore);
      console.log("Python Core loaded.");

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

      window.addEventListener('row-delete', (e: any) => {
        this._handleDeleteRow(
          e.detail.sheetIndex,
          e.detail.tableIndex,
          e.detail.rowIndex
        );
      });

      window.addEventListener('column-delete', (e: any) => {
        this._handleDeleteColumn(
          e.detail.sheetIndex,
          e.detail.tableIndex,
          e.detail.colIndex
        );
      });

      window.addEventListener('row-insert', (e: any) => {
        this._handleInsertRow(
          e.detail.sheetIndex,
          e.detail.tableIndex,
          e.detail.rowIndex
        );
      });

      window.addEventListener('column-insert', (e: any) => {
        this._handleInsertColumn(
          e.detail.sheetIndex,
          e.detail.tableIndex,
          e.detail.colIndex
        );
      });

      window.addEventListener('column-clear', (e: any) => {
        this._handleClearColumn(
          e.detail.sheetIndex,
          e.detail.tableIndex,
          e.detail.colIndex
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
      window.addEventListener('metadata-edit', (e: any) => this._handleMetadataEdit(e.detail));
      window.addEventListener('metadata-change', (e: any) => this._handleVisualMetadataUpdate(e.detail));

      // Handle messages from the extension
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
            console.warn("Sync failed, resetting queue state.");
            this._isSyncing = false;
            this._processQueue(); // Try next? or clear?
            break;
        }
      });


      // Valid initialization - Parsing initial content
      console.log("Pyodide initialized. Parsing initial content...");
      await this._parseWorkbook();

    } catch (e: any) {
      this.output = `Error initializing Pyodide: ${e.message} `;
      console.error(e);
    }
  }

  willUpdate(changedProperties: Map<string, any>) {
    if (changedProperties.has('tabs')) {
      const tabs = this.tabs;

      // Handle Add Sheet Selection
      if (this.pendingAddSheet) {
        // Select last sheet (before 'add-sheet' button if present)
        let targetIndex = tabs.length - 1;
        if (tabs.length > 0 && tabs[tabs.length - 1].type === 'add-sheet') {
          targetIndex = tabs.length - 2;
        }

        if (targetIndex >= 0) {
          this.activeTabIndex = targetIndex;
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
    }
  }

  render() {
    if (!this.tabs.length && !this.output) {
      return html`< div class="output" > Loading...</div>`;
    }

    return this._renderContent();
  }

  private _renderContent() {
    if (this.tabs.length === 0) {
      return html`
            <div class="output">${this.output}</div>
        `;
    }

    let activeTab = this.tabs[this.activeTabIndex];
    if (!activeTab && this.tabs.length > 0) {
      activeTab = this.tabs[0];
    }

    if (!activeTab) return html``;

    return html`
        <div class="content-area">
            ${activeTab.type === 'sheet' ? html`
                 <div class="sheet-container">
                    ${activeTab.data.tables.map((table: any, tableIndex: number) => html`
                        <spreadsheet-table 
                            .table="${table}" 
                            .sheetIndex="${activeTab.sheetIndex}" 
                            .tableIndex="${tableIndex}"
                            @cell-edit="${this._onCellEdit}"
                            @range-edit="${this._onRangeEdit}"
                            @metadata-change="${this._onMetadataChange}"
                        ></spreadsheet-table>
                    `)}
                 </div>
            ` : html``}
            
            ${activeTab.type === 'document' ? html`
                <spreadsheet-document-view
                    .title="${activeTab.title}"
                    .content="${activeTab.data.content}"
                ></spreadsheet-document-view>
            ` : html``}
            
            ${activeTab.type === 'onboarding' ? html`
                <spreadsheet-onboarding @create-spreadsheet="${this._onCreateSpreadsheet}"></spreadsheet-onboarding>
            ` : html``}
        </div>

        <div class="bottom-tabs">
            ${this.tabs.map((tab, index) => html`
                <div 
                    class="tab-item ${this.activeTabIndex === index ? 'active' : ''} ${tab.type === 'add-sheet' ? 'add-sheet-tab' : ''}"
                    @click="${() => tab.type === 'add-sheet' ? this._handleAddSheet() : this.activeTabIndex = index}"
                    @dblclick="${() => this._handleTabDoubleClick(index, tab)}"
                    @contextmenu="${(e: MouseEvent) => this._handleTabContextMenu(e, index, tab)}"
                    title="${tab.type === 'add-sheet' ? 'Add New Sheet' : ''}"
                >
                     ${this._renderTabIcon(tab)}
                     ${this.editingTabIndex === index ? html`
                        <input 
                            class="tab-input" 
                            .value="${tab.title}" 
                            @click="${(e: Event) => e.stopPropagation()}"
                            @dblclick="${(e: Event) => e.stopPropagation()}"
                            @keydown="${(e: KeyboardEvent) => this._handleTabInputKey(e, index, tab)}"
                            @blur="${(e: Event) => this._handleTabRename(index, tab, (e.target as HTMLInputElement).value)}"
                        />
                     ` : html`
                        ${tab.type !== 'add-sheet' ? tab.title : ''}
                     `}
                </div>
            `)}
        </div>

        ${this.tabContextMenu ? html`
            <div 
                style="position: fixed; top: ${this.tabContextMenu.y}px; left: ${this.tabContextMenu.x}px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1000; padding: 4px 0; min-width: 150px;"
            >
                <div 
                    style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                    @mouseover="${(e: MouseEvent) => (e.target as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)'}"
                    @mouseout="${(e: MouseEvent) => (e.target as HTMLElement).style.background = 'transparent'}"
                    @click="${() => this._renameSheet(this.tabContextMenu!.index)}"
                >Rename Sheet</div>
                <div 
                    style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                    @mouseover="${(e: MouseEvent) => (e.target as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)'}"
                    @mouseout="${(e: MouseEvent) => (e.target as HTMLElement).style.background = 'transparent'}"
                    @click="${() => this._deleteSheet(this.tabContextMenu!.index)}"
                >Delete Sheet</div>
            </div>
            <!-- Overlay to close menu on click outside -->
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999;" @click="${() => this.tabContextMenu = null}"></div>
        ` : ''}

        <!-- Delete Confirmation Modal -->
        <confirmation-modal 
            .open="${this.confirmDeleteIndex !== null}"
            title="Delete Sheet" 
            confirmLabel="Delete" 
            cancelLabel="Cancel"
            @confirm="${this._performDelete}"
            @cancel="${this._cancelDelete}"
        >
             Are you sure you want to delete sheet "<span style="color: var(--vscode-textPreformat-foreground);">${this.confirmDeleteIndex !== null ? this.tabs[this.confirmDeleteIndex]?.title : ''}</span>"?
             <br>This action cannot be undone.
        </confirmation-modal>
    `;
  }

  private _renderTabIcon(tab: TabDefinition) {
    if (tab.type === 'sheet') {
      return html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M3 3h10v10H3V3zm1 1v3h3V4H4zm4 0v3h3V4H8zm-4 4v3h3V8H4zm4 0v3h3V8H4zm4 0v3h3V8H8z"/></svg>`;
    } else if (tab.type === 'document') {
      return html``;
    } else if (tab.type === 'add-sheet') {
      // Using the text content '+' in render loop, so maybe no icon needed? 
      // Or return a plus icon SVG. Title is '+' in definition.
      // Let's use SVG for better look.
      return html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>`;
    } else {
      return html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M14 7H9V2H7v5H2v2h5v5h2V9h5V7z"/></svg>`;
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
            content: updateSpec.content
          });
        } else if (updateSpec.error) {
          console.error("Delete failed:", updateSpec.error);
        }
      } catch (e) {
        console.error("Python error:", e);
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
          console.error("Rename failed:", updateSpec.error);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  private async _handleAddSheet() {
    if (!this.pyodide) return;

    this.pendingAddSheet = true;

    let newSheetName = "Sheet 1";
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
          console.error("Add Sheet failed:", updateSpec.error);
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
      console.error("Failed to add sheet:", err);
    }
  }

  private _onCreateSpreadsheet() {
    vscode.postMessage({ type: 'createSpreadsheet' });
  }




  private async _parseWorkbook() {
    if (!this.pyodide) return;
    try {


      // 2. Initialization Phase
      this.pyodide.globals.set("md_text", this.markdownInput);
      this.pyodide.globals.set("config", JSON.stringify(this.config));

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

      // Reconstruct Tabs from Structure
      for (const section of structure) {
        if (section.type === 'document') {
          newTabs.push({
            type: 'document',
            title: section.title!,
            index: newTabs.length,
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
      this.output = "Parsed successfully!";

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
}

// Add global definition for acquireVsCodeApi
declare function acquireVsCodeApi(): any;

