import { ReactiveController, ReactiveControllerHost } from 'lit';
import { SpreadsheetService } from '../services/spreadsheet-service';
import {
    ICellEditDetail,
    IRangeEditDetail,
    IRowOperationDetail,
    IColumnOperationDetail,
    IColumnResizeDetail,
    IMetadataEditDetail,
    IMetadataUpdateDetail,
    IRequestAddTableDetail,
    IRequestRenameTableDetail,
    IRequestDeleteTableDetail,
    IVisualMetadataUpdateDetail,
    ISheetMetadataUpdateDetail,
    IPasteCellsDetail,
    PostMessageCommand
} from '../types';

/**
 * Host interface for GlobalEventController
 * Defines the methods and properties that the host component must provide
 */
export interface GlobalEventHost extends ReactiveControllerHost {
    readonly spreadsheetService: SpreadsheetService;
    markdownInput: string;
    config: Record<string, unknown>;

    // Handler methods that must be provided by the host
    _handleRangeEdit(
        sheetIndex: number,
        tableIndex: number,
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number,
        newValue: string
    ): void;
    _handleDeleteRow(sheetIndex: number, tableIndex: number, rowIndex: number): void;
    _handleDeleteRows(sheetIndex: number, tableIndex: number, rowIndices: number[]): void;
    _handleInsertRow(sheetIndex: number, tableIndex: number, rowIndex: number): void;
    _handleDeleteColumn(sheetIndex: number, tableIndex: number, colIndex: number): void;
    _handleInsertColumn(sheetIndex: number, tableIndex: number, colIndex: number): void;
    _handleClearColumn(sheetIndex: number, tableIndex: number, colIndex: number): void;
    _handleColumnResize(detail: IColumnResizeDetail): void;
    _handleMetadataEdit(detail: IMetadataEditDetail): void;
    _handleMetadataUpdate(detail: IMetadataUpdateDetail): void;
    _handleRequestAddTable(detail: IRequestAddTableDetail): void;
    _handleRequestRenameTable(detail: IRequestRenameTableDetail): void;
    _handleRequestDeleteTable(detail: IRequestDeleteTableDetail): void;
    _handleVisualMetadataUpdate(detail: IVisualMetadataUpdateDetail): void;
    _handleSheetMetadataUpdate(detail: ISheetMetadataUpdateDetail): void;
    _handlePasteCells(detail: IPasteCellsDetail): void;
    _handlePostMessage(detail: PostMessageCommand): void;
    _handleDocumentChange(detail: { sectionIndex: number; content: string; title?: string; save?: boolean }): void;
    _handleSave(): void;
    _parseWorkbook(): Promise<void>;
}

/**
 * GlobalEventController - Manages window-level event listeners
 *
 * This controller consolidates all global event listeners from main.ts,
 * providing proper lifecycle management through hostConnected/hostDisconnected.
 */
export class GlobalEventController implements ReactiveController {
    private host: GlobalEventHost;

    // Bound handlers for proper cleanup
    private _boundKeyDown: (e: KeyboardEvent) => void;
    private _boundCellEdit: (e: Event) => void;
    private _boundRangeEdit: (e: Event) => void;
    private _boundRowDelete: (e: Event) => void;
    private _boundRowsDelete: (e: Event) => void;
    private _boundRowInsert: (e: Event) => void;
    private _boundColumnDelete: (e: Event) => void;
    private _boundColumnInsert: (e: Event) => void;
    private _boundColumnClear: (e: Event) => void;
    private _boundColumnResize: (e: Event) => void;
    private _boundMetadataEdit: (e: Event) => void;
    private _boundMetadataUpdate: (e: Event) => void;
    private _boundRequestAddTable: (e: Event) => void;
    private _boundRequestRenameTable: (e: Event) => void;
    private _boundRequestDeleteTable: (e: Event) => void;
    private _boundMetadataChange: (e: Event) => void;
    private _boundSheetMetadataUpdate: (e: Event) => void;
    private _boundPasteCells: (e: Event) => void;
    private _boundPostMessage: (e: Event) => void;
    private _boundDocumentChange: (e: Event) => void;
    private _boundMessage: (e: MessageEvent) => void;

    constructor(host: GlobalEventHost) {
        this.host = host;
        host.addController(this);

        // Bind all handlers
        this._boundKeyDown = this._handleKeyDown.bind(this);
        this._boundCellEdit = this._handleCellEdit.bind(this);
        this._boundRangeEdit = this._handleRangeEdit.bind(this);
        this._boundRowDelete = this._handleRowDelete.bind(this);
        this._boundRowsDelete = this._handleRowsDelete.bind(this);
        this._boundRowInsert = this._handleRowInsert.bind(this);
        this._boundColumnDelete = this._handleColumnDelete.bind(this);
        this._boundColumnInsert = this._handleColumnInsert.bind(this);
        this._boundColumnClear = this._handleColumnClear.bind(this);
        this._boundColumnResize = this._handleColumnResize.bind(this);
        this._boundMetadataEdit = this._handleMetadataEdit.bind(this);
        this._boundMetadataUpdate = this._handleMetadataUpdate.bind(this);
        this._boundRequestAddTable = this._handleRequestAddTable.bind(this);
        this._boundRequestRenameTable = this._handleRequestRenameTable.bind(this);
        this._boundRequestDeleteTable = this._handleRequestDeleteTable.bind(this);
        this._boundMetadataChange = this._handleMetadataChange.bind(this);
        this._boundSheetMetadataUpdate = this._handleSheetMetadataUpdate.bind(this);
        this._boundPasteCells = this._handlePasteCells.bind(this);
        this._boundPostMessage = this._handlePostMessage.bind(this);
        this._boundDocumentChange = this._handleDocumentChange.bind(this);
        this._boundMessage = this._handleMessage.bind(this);
    }

    hostConnected(): void {
        // Global keyboard shortcuts (capture phase)
        window.addEventListener('keydown', this._boundKeyDown, true);

        // Cell/Range editing events
        window.addEventListener('cell-edit', this._boundCellEdit);
        window.addEventListener('range-edit', this._boundRangeEdit);

        // Row operations
        window.addEventListener('row-delete', this._boundRowDelete);
        window.addEventListener('rows-delete', this._boundRowsDelete);
        window.addEventListener('row-insert', this._boundRowInsert);

        // Column operations
        window.addEventListener('column-delete', this._boundColumnDelete);
        window.addEventListener('column-insert', this._boundColumnInsert);
        window.addEventListener('column-clear', this._boundColumnClear);
        window.addEventListener('column-resize', this._boundColumnResize);

        // Metadata events
        window.addEventListener('metadata-edit', this._boundMetadataEdit);
        window.addEventListener('metadata-update', this._boundMetadataUpdate);
        window.addEventListener('metadata-change', this._boundMetadataChange);
        window.addEventListener('sheet-metadata-update', this._boundSheetMetadataUpdate);

        // Table operations
        window.addEventListener('request-add-table', this._boundRequestAddTable);
        window.addEventListener('request-rename-table', this._boundRequestRenameTable);
        window.addEventListener('request-delete-table', this._boundRequestDeleteTable);

        // Other operations
        window.addEventListener('paste-cells', this._boundPasteCells);
        window.addEventListener('post-message', this._boundPostMessage);
        window.addEventListener('document-change', this._boundDocumentChange);

        // VS Code extension messages
        window.addEventListener('message', this._boundMessage);
    }

    hostDisconnected(): void {
        // Remove all listeners to prevent memory leaks
        window.removeEventListener('keydown', this._boundKeyDown, true);
        window.removeEventListener('cell-edit', this._boundCellEdit);
        window.removeEventListener('range-edit', this._boundRangeEdit);
        window.removeEventListener('row-delete', this._boundRowDelete);
        window.removeEventListener('rows-delete', this._boundRowsDelete);
        window.removeEventListener('row-insert', this._boundRowInsert);
        window.removeEventListener('column-delete', this._boundColumnDelete);
        window.removeEventListener('column-insert', this._boundColumnInsert);
        window.removeEventListener('column-clear', this._boundColumnClear);
        window.removeEventListener('column-resize', this._boundColumnResize);
        window.removeEventListener('metadata-edit', this._boundMetadataEdit);
        window.removeEventListener('metadata-update', this._boundMetadataUpdate);
        window.removeEventListener('metadata-change', this._boundMetadataChange);
        window.removeEventListener('sheet-metadata-update', this._boundSheetMetadataUpdate);
        window.removeEventListener('request-add-table', this._boundRequestAddTable);
        window.removeEventListener('request-rename-table', this._boundRequestRenameTable);
        window.removeEventListener('request-delete-table', this._boundRequestDeleteTable);
        window.removeEventListener('paste-cells', this._boundPasteCells);
        window.removeEventListener('post-message', this._boundPostMessage);
        window.removeEventListener('document-change', this._boundDocumentChange);
        window.removeEventListener('message', this._boundMessage);
    }

    // Event handlers delegate to host methods

    private _handleKeyDown(e: KeyboardEvent): void {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            this.host._handleSave();
        }
    }

    private _handleCellEdit(e: Event): void {
        const detail = (e as CustomEvent<ICellEditDetail>).detail;
        this.host._handleRangeEdit(
            detail.sheetIndex,
            detail.tableIndex,
            detail.rowIndex,
            detail.rowIndex,
            detail.colIndex,
            detail.colIndex,
            detail.newValue
        );
    }

    private _handleRangeEdit(e: Event): void {
        const detail = (e as CustomEvent<IRangeEditDetail>).detail;
        this.host._handleRangeEdit(
            detail.sheetIndex,
            detail.tableIndex,
            detail.startRow,
            detail.endRow,
            detail.startCol,
            detail.endCol,
            detail.newValue
        );
    }

    private _handleRowDelete(e: Event): void {
        const detail = (e as CustomEvent<IRowOperationDetail>).detail;
        this.host._handleDeleteRow(detail.sheetIndex, detail.tableIndex, detail.rowIndex);
    }

    private _handleRowsDelete(e: Event): void {
        const detail = (e as CustomEvent<{ sheetIndex: number; tableIndex: number; rowIndices: number[] }>).detail;
        this.host._handleDeleteRows(detail.sheetIndex, detail.tableIndex, detail.rowIndices);
    }

    private _handleRowInsert(e: Event): void {
        const detail = (e as CustomEvent<IRowOperationDetail>).detail;
        this.host._handleInsertRow(detail.sheetIndex, detail.tableIndex, detail.rowIndex);
    }

    private _handleColumnDelete(e: Event): void {
        const detail = (e as CustomEvent<IColumnOperationDetail>).detail;
        this.host._handleDeleteColumn(detail.sheetIndex, detail.tableIndex, detail.colIndex);
    }

    private _handleColumnInsert(e: Event): void {
        const detail = (e as CustomEvent<IColumnOperationDetail>).detail;
        this.host._handleInsertColumn(detail.sheetIndex, detail.tableIndex, detail.colIndex);
    }

    private _handleColumnClear(e: Event): void {
        const detail = (e as CustomEvent<IColumnOperationDetail>).detail;
        this.host._handleClearColumn(detail.sheetIndex, detail.tableIndex, detail.colIndex);
    }

    private _handleColumnResize(e: Event): void {
        this.host._handleColumnResize((e as CustomEvent<IColumnResizeDetail>).detail);
    }

    private _handleMetadataEdit(e: Event): void {
        this.host._handleMetadataEdit((e as CustomEvent<IMetadataEditDetail>).detail);
    }

    private _handleMetadataUpdate(e: Event): void {
        this.host._handleMetadataUpdate((e as CustomEvent<IMetadataUpdateDetail>).detail);
    }

    private _handleRequestAddTable(e: Event): void {
        this.host._handleRequestAddTable((e as CustomEvent<IRequestAddTableDetail>).detail);
    }

    private _handleRequestRenameTable(e: Event): void {
        this.host._handleRequestRenameTable((e as CustomEvent<IRequestRenameTableDetail>).detail);
    }

    private _handleRequestDeleteTable(e: Event): void {
        this.host._handleRequestDeleteTable((e as CustomEvent<IRequestDeleteTableDetail>).detail);
    }

    private _handleMetadataChange(e: Event): void {
        this.host._handleVisualMetadataUpdate((e as CustomEvent<IVisualMetadataUpdateDetail>).detail);
    }

    private _handleSheetMetadataUpdate(e: Event): void {
        this.host._handleSheetMetadataUpdate((e as CustomEvent<ISheetMetadataUpdateDetail>).detail);
    }

    private _handlePasteCells(e: Event): void {
        this.host._handlePasteCells((e as CustomEvent<IPasteCellsDetail>).detail);
    }

    private _handlePostMessage(e: Event): void {
        this.host._handlePostMessage((e as CustomEvent<PostMessageCommand>).detail);
    }

    private _handleDocumentChange(e: Event): void {
        this.host._handleDocumentChange(
            (
                e as CustomEvent<{
                    sectionIndex: number;
                    content: string;
                    title?: string;
                    save?: boolean;
                }>
            ).detail
        );
    }

    private async _handleMessage(event: MessageEvent): Promise<void> {
        const message = event.data;
        switch (message.type) {
            case 'update':
                this.host.markdownInput = message.content;
                await this.host._parseWorkbook();
                this.host.spreadsheetService.notifyUpdateReceived();
                break;
            case 'configUpdate':
                this.host.config = message.config;
                await this.host._parseWorkbook();
                break;
            case 'sync-failed':
                console.warn('Sync failed, resetting queue state.');
                this.host.spreadsheetService.notifyUpdateReceived();
                break;
        }
    }
}
