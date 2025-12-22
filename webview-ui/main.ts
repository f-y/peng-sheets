import { html, LitElement, PropertyValues } from 'lit';
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
import './components/layout-container';
import {
    SheetJSON,
    DocumentJSON,
    WorkbookJSON,
    TabDefinition,
    StructureItem,
    PostMessageCommand,
    IParseResult,
    isSheetJSON,
    isDocumentJSON,
    isIDocumentSectionRange,
    IMetadataEditDetail,
    IMetadataUpdateDetail,
    ISortRowsDetail,
    IColumnUpdateDetail,
    IVisualMetadataUpdateDetail,
    ISheetMetadataUpdateDetail,
    IRequestAddTableDetail,
    IRequestRenameTableDetail,
    IRequestDeleteTableDetail,
    IPasteCellsDetail,
    ICellEditDetail,
    IRangeEditDetail,
    IRowOperationDetail,
    IColumnOperationDetail,
    IColumnResizeDetail,
    IColumnFilterDetail
} from './types';

// Register the VS Code Design System components
import { SpreadsheetService } from './services/spreadsheet-service';

// Register the VS Code Design System components
provideVSCodeDesignSystem().register();

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeSpreadsheetTable?: any;
        initialContent?: string;
        initialConfig?: Record<string, unknown>;
    }
}

// declare const loadPyodide: any; // Moved to service usage

// Acquire VS Code API
const vscode = acquireVsCodeApi();

// @ts-expect-error Vite raw import for Python module
import pythonCore from '../python-modules/headless_editor.py?raw';

@customElement('md-spreadsheet-editor')
export class MyEditor extends LitElement {
    static styles = [mainStyles];

    private spreadsheetService = new SpreadsheetService(pythonCore, vscode);

    @state()
    output: string = t('initializing');

    @state()
    markdownInput: string = '';

    @state()
    config: Record<string, unknown> = {};

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

    // Track sheet count for add detection
    private _previousSheetCount = 0;

    private async _handleMetadataEdit(detail: IMetadataEditDetail) {
        if (!this.workbook) return;
        const { sheetIndex, tableIndex, name, description } = detail;

        // Optimistic Update: Update local state immediately to avoid UI flicker
        const targetTab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (targetTab && isSheetJSON(targetTab.data)) {
            const table = targetTab.data.tables[tableIndex];
            if (table) {
                // Update values directly
                table.name = name;
                table.description = description;

                // Force Lit to re-render with new values
                this.requestUpdate();
            }
        }

        this.spreadsheetService.updateTableMetadata(sheetIndex, tableIndex, name, description);
    }

    /**
     * Handle description-only updates from ss-metadata-editor
     */
    /**
     * Handle description-only updates from ss-metadata-editor
     */
    private async _handleMetadataUpdate(detail: IMetadataUpdateDetail) {
        if (!this.workbook) return;
        const { sheetIndex, tableIndex, description } = detail;

        // Get current table name from local state
        const targetTab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        let currentName = '';
        if (targetTab && isSheetJSON(targetTab.data)) {
            const table = targetTab.data.tables[tableIndex];
            if (table) {
                currentName = table.name || '';
                // Optimistic update
                table.description = description;
                this.requestUpdate();
            }
        }

        this.spreadsheetService.updateTableMetadata(sheetIndex, tableIndex, currentName, description);
    }

    private async _handleVisualMetadataUpdate(detail: IVisualMetadataUpdateDetail) {
        const { sheetIndex, tableIndex, visual } = detail;
        this.spreadsheetService.updateVisualMetadata(sheetIndex, tableIndex, visual);
    }

    private async _handleSheetMetadataUpdate(detail: ISheetMetadataUpdateDetail) {
        const { sheetIndex, metadata } = detail;
        // Optimistic Update: Update local state immediately
        const targetTab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (targetTab && isSheetJSON(targetTab.data)) {
            targetTab.data.metadata = {
                ...(targetTab.data.metadata || {}),
                ...metadata
            };
            this.requestUpdate();
        }

        this.spreadsheetService.updateSheetMetadata(sheetIndex, metadata);
    }

    private async _handleRequestAddTable(detail: IRequestAddTableDetail) {
        const { sheetIndex } = detail;
        this.spreadsheetService.addTable(sheetIndex, t('newTable'));
    }

    private async _handleRequestRenameTable(detail: IRequestRenameTableDetail) {
        if (!this.workbook) return;
        const { sheetIndex, tableIndex, newName } = detail;

        this.spreadsheetService.renameTable(sheetIndex, tableIndex, newName);
    }

    private async _handleRequestDeleteTable(detail: IRequestDeleteTableDetail) {
        const { sheetIndex, tableIndex } = detail;

        // Optimistic update
        const tab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (tab && isSheetJSON(tab.data)) {
            tab.data.tables.splice(tableIndex, 1);
            this.requestUpdate();
        }

        this.spreadsheetService.deleteTable(sheetIndex, tableIndex);
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
        this.spreadsheetService.updateRange(sheetIdx, tableIdx, startRow, endRow, startCol, endCol, newValue);
    }

    private async _handleDeleteRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this.spreadsheetService.deleteRow(sheetIdx, tableIdx, rowIndex);
    }

    private async _handleDeleteColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this.spreadsheetService.deleteColumn(sheetIdx, tableIdx, colIndex);
    }

    private async _handleInsertRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this.spreadsheetService.insertRow(sheetIdx, tableIdx, rowIndex);
    }

    private async _handleInsertColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this.spreadsheetService.insertColumn(sheetIdx, tableIdx, colIndex);
    }

    private async _handleClearColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this.spreadsheetService.clearColumn(sheetIdx, tableIdx, colIndex);
    }

    private async _handlePasteCells(detail: IPasteCellsDetail) {
        const { sheetIndex, tableIndex, startRow, startCol, data, includeHeaders } = detail;
        this.spreadsheetService.pasteCells(sheetIndex, tableIndex, startRow, startCol, data, includeHeaders);
    }

    private async _handleUpdateColumnFilter(detail: IColumnFilterDetail) {
        const { sheetIndex, tableIndex, colIndex, hiddenValues } = detail;
        this.spreadsheetService.updateColumnFilter(sheetIndex, tableIndex, colIndex, hiddenValues);
    }

    private async _handleSortRows(detail: ISortRowsDetail) {
        const { sheetIndex, tableIndex, colIndex, ascending } = detail;
        this.spreadsheetService.sortRows(sheetIndex, tableIndex, colIndex, ascending ? 'asc' : 'desc');
    }

    private async _handleUpdateColumnAlign(detail: IColumnUpdateDetail) {
        const { sheetIndex, tableIndex, colIndex, alignment } = detail;
        this.spreadsheetService.updateColumnAlign(sheetIndex, tableIndex, colIndex, alignment ?? null);
    }

    private async _handleUpdateColumnFormat(detail: IColumnUpdateDetail) {
        const { sheetIndex, tableIndex, colIndex, format } = detail;
        this.spreadsheetService.updateColumnFormat(sheetIndex, tableIndex, colIndex, format ?? null);
    }

    private _handlePostMessage(detail: PostMessageCommand) {
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
                console.warn('Unknown post-message command:', (detail as PostMessageCommand).command);
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
            const range = await this.spreadsheetService.getDocumentSectionRange(docIndex);

            console.log('Python result:', range);

            if (range && isIDocumentSectionRange(range)) {
                if (range.start_line !== undefined && range.end_line !== undefined) {
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
                    if (isDocumentJSON(activeTab.data)) {
                        activeTab.data.content = detail.content;
                    } else {
                        // Initialize if missing or wrong type
                        activeTab.data = {
                            type: 'document',
                            title: newTitle,
                            content: detail.content
                        };
                    }
                    this.requestUpdate();

                    console.log('Document updated:', {
                        range,
                        title: newTitle,
                        content: fullContent.substring(0, 50) + '...'
                    });
                } else if (range.error) {
                    console.error('Python error:', range.error);
                }
            }
        } catch (error) {
            console.error('Failed to update document section:', error);
            // Fallback: just update local state without file save
            if (detail.title) {
                activeTab.title = detail.title;
            }
            if (isDocumentJSON(activeTab.data)) {
                activeTab.data.content = detail.content;
            } else {
                activeTab.data = {
                    type: 'document',
                    title: detail.title || activeTab.title,
                    content: detail.content
                };
            }
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

    connectedCallback() {
        super.connectedCallback();
        try {
            const initialContent = window.initialContent;
            if (initialContent) {
                this.markdownInput = initialContent;
            }

            const initialConfig = window.initialConfig;
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
            await this.spreadsheetService.initialize();
            console.log('Spreadsheet Service initialized.');

            window.addEventListener('cell-edit', (e: Event) => {
                const detail = (e as CustomEvent<ICellEditDetail>).detail;
                this._handleRangeEdit(
                    detail.sheetIndex,
                    detail.tableIndex,
                    detail.rowIndex,
                    detail.rowIndex,
                    detail.colIndex,
                    detail.colIndex,
                    detail.newValue
                );
            });

            window.addEventListener('range-edit', (e: Event) => {
                const detail = (e as CustomEvent<IRangeEditDetail>).detail;
                this._handleRangeEdit(
                    detail.sheetIndex,
                    detail.tableIndex,
                    detail.startRow,
                    detail.endRow,
                    detail.startCol,
                    detail.endCol,
                    detail.newValue
                );
            });

            window.addEventListener('row-delete', (e: Event) => {
                const detail = (e as CustomEvent<IRowOperationDetail>).detail;
                this._handleDeleteRow(detail.sheetIndex, detail.tableIndex, detail.rowIndex);
            });

            window.addEventListener('row-insert', (e: Event) => {
                const detail = (e as CustomEvent<IRowOperationDetail>).detail;
                this._handleInsertRow(detail.sheetIndex, detail.tableIndex, detail.rowIndex);
            });

            window.addEventListener('column-delete', (e: Event) => {
                const detail = (e as CustomEvent<IColumnOperationDetail>).detail;
                this._handleDeleteColumn(detail.sheetIndex, detail.tableIndex, detail.colIndex);
            });

            window.addEventListener('column-insert', (e: Event) => {
                const detail = (e as CustomEvent<IColumnOperationDetail>).detail;
                this._handleInsertColumn(detail.sheetIndex, detail.tableIndex, detail.colIndex);
            });

            window.addEventListener('column-clear', (e: Event) => {
                const detail = (e as CustomEvent<IColumnOperationDetail>).detail;
                this._handleClearColumn(detail.sheetIndex, detail.tableIndex, detail.colIndex);
            });

            window.addEventListener('column-resize', (e: Event) =>
                this._handleColumnResize((e as CustomEvent<IColumnResizeDetail>).detail)
            );
            window.addEventListener('metadata-edit', (e: Event) =>
                this._handleMetadataEdit((e as CustomEvent<IMetadataEditDetail>).detail)
            );
            window.addEventListener('metadata-update', (e: Event) =>
                this._handleMetadataUpdate((e as CustomEvent<IMetadataUpdateDetail>).detail)
            );
            window.addEventListener('request-add-table', (e: Event) =>
                this._handleRequestAddTable((e as CustomEvent<IRequestAddTableDetail>).detail)
            );
            window.addEventListener('request-rename-table', (e: Event) =>
                this._handleRequestRenameTable((e as CustomEvent<IRequestRenameTableDetail>).detail)
            );
            window.addEventListener('request-delete-table', (e: Event) =>
                this._handleRequestDeleteTable((e as CustomEvent<IRequestDeleteTableDetail>).detail)
            );
            window.addEventListener('metadata-change', (e: Event) =>
                this._handleVisualMetadataUpdate((e as CustomEvent<IVisualMetadataUpdateDetail>).detail)
            );
            window.addEventListener('sheet-metadata-update', (e: Event) =>
                this._handleSheetMetadataUpdate((e as CustomEvent<ISheetMetadataUpdateDetail>).detail)
            );
            window.addEventListener('paste-cells', (e: Event) =>
                this._handlePasteCells((e as CustomEvent<IPasteCellsDetail>).detail)
            );
            window.addEventListener('post-message', (e: Event) =>
                this._handlePostMessage((e as CustomEvent<PostMessageCommand>).detail)
            );
            window.addEventListener('document-change', (e: Event) =>
                this._handleDocumentChange(
                    (e as CustomEvent<{ sectionIndex: number; content: string; title?: string }>).detail
                )
            );

            window.addEventListener('message', async (event) => {
                const message = event.data;
                switch (message.type) {
                    case 'update':
                        this.markdownInput = message.content;
                        await this._parseWorkbook();
                        this.spreadsheetService.notifyUpdateReceived();
                        break;
                    case 'configUpdate':
                        this.config = message.config;
                        await this._parseWorkbook();
                        break;
                    case 'sync-failed':
                        // Error recovery
                        console.warn('Sync failed, resetting queue state.');
                        this.spreadsheetService.notifyUpdateReceived();
                        break;
                }
            });

            console.log('Pyodide initialized. Parsing initial content...');
            await this._parseWorkbook();
        } catch (e: unknown) {
            console.error('Error initializing Pyodide:', e);
            this.output = `Error initializing Pyodide: ${e}`;
        }
    }

    willUpdate(changedProperties: PropertyValues<this>) {
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
            ${activeTab.type !== 'document' && activeTab.type !== 'onboarding'
                ? html` <spreadsheet-toolbar @toolbar-action="${this._handleToolbarAction}"></spreadsheet-toolbar> `
                : html``}
            <div class="content-area">
                ${activeTab.type === 'sheet' && isSheetJSON(activeTab.data)
                ? html`
                          <div class="sheet-container" style="height: 100%">
                              <layout-container
                                  .layout="${(activeTab.data as SheetJSON).metadata?.layout}"
                                  .tables="${(activeTab.data as SheetJSON).tables}"
                                  .sheetIndex="${activeTab.sheetIndex}"
                                  @save-requested="${this._handleSave}"
                              ></layout-container>
                          </div>
                      `
                : activeTab.type === 'document' && isDocumentJSON(activeTab.data)
                    ? html`
                            <spreadsheet-document-view
                                .title="${activeTab.title}"
                                .content="${(activeTab.data as DocumentJSON).content}"
                                @input="${(e: InputEvent) =>
                            this._handleDocumentChangeInput(
                                activeTab.sheetIndex || 0,
                                (e.target as HTMLTextAreaElement).value
                            )}"
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
                                title="${tab.type === 'add-sheet' ? t('addNewSheet') : ''}"
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
                                              @keydown="${(e: KeyboardEvent) => this._handleTabInputKey(e)}"
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
                        `<span style="color: var(--vscode-textPreformat-foreground);">${this.confirmDeleteIndex !== null
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

    private _handleDocumentChangeInput(sheetIndex: number, content: string) {
        // Update local state directly for document view
        const tab = this.tabs.find((t) => t.sheetIndex === sheetIndex && t.type === 'document');
        if (tab && isDocumentJSON(tab.data)) {
            tab.data.content = content;
            this.requestUpdate();
            // TODO: Debounce and send update to backend if persistence is needed
        }
    }

    private _handleTabInputKey(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur(); // Trigger blur handler
        } else if (e.key === 'Escape') {
            this.editingTabIndex = null;
        }
    }

    private _handleTabContextMenu(e: MouseEvent, index: number, tab: TabDefinition) {
        // Prevent default context menu for all tab types
        e.preventDefault();

        // Only show custom context menu for sheet tabs
        if (tab.type !== 'sheet') return;

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

    private _performDelete() {
        const index = this.confirmDeleteIndex;
        if (index === null) return;

        // Close modal immediately
        this.confirmDeleteIndex = null;

        const tab = this.tabs[index];
        if (tab && tab.type === 'sheet' && typeof tab.sheetIndex === 'number') {
            this.spreadsheetService.deleteSheet(tab.sheetIndex);
        }
    }

    private async _handleTabRename(index: number, tab: TabDefinition, newName: string) {
        if (this.editingTabIndex !== index) return;
        this.editingTabIndex = null; // Exit edit mode

        if (!newName || newName === tab.title) return;

        if (tab.type === 'sheet' && typeof tab.sheetIndex === 'number') {
            this.spreadsheetService.renameSheet(tab.sheetIndex, newName);
        }
    }

    private async _handleAddSheet() {
        this.pendingAddSheet = true;

        let newSheetName = 'Sheet 1';
        if (this.workbook && this.workbook.sheets) {
            newSheetName = `Sheet ${this.workbook.sheets.length + 1}`;
        }
        this.spreadsheetService.addSheet(newSheetName);
    }

    private _onCreateSpreadsheet() {
        vscode.postMessage({ type: 'createSpreadsheet' });
    }

    private async _parseWorkbook() {
        try {
            // 2. Initialization Phase
            const result = (await this.spreadsheetService.initializeWorkbook(
                this.markdownInput,
                this.config
            )) as unknown as IParseResult;

            if (!result) return;

            this.workbook = result.workbook;

            const structure: StructureItem[] = result.structure as unknown as StructureItem[];
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
                        this.workbook.sheets.forEach((sheet, shIdx: number) => {
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
                            title: t('newSpreadsheet'),
                            index: newTabs.length
                        });
                    }
                }
            }

            if (!workbookFound) {
                // If no workbook marker found, add empty placeholder at end
                newTabs.push({
                    type: 'onboarding',
                    title: t('newSpreadsheet'),
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
        } catch (err: unknown) {
            console.error(err);
            this.output = `Error parsing: ${(err as Error).message}`;
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

    private _handleSheetDragLeave() {
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

        this.spreadsheetService.moveSheet(from, to);
    }

    private async _handleColumnResize(detail: IColumnResizeDetail) {
        const { sheetIndex, tableIndex, col, width } = detail;
        this.spreadsheetService.updateColumnWidth(sheetIndex, tableIndex, col, width);
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
        const table = window.activeSpreadsheetTable;
        if (table && table.handleToolbarAction) {
            table.handleToolbarAction(action);
        } else {
            console.warn('Main: No active table found to handle action');
        }
    }

    updated(changedProperties: PropertyValues<this>) {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function acquireVsCodeApi(): any;
