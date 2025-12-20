import { ReactiveController, ReactiveControllerHost } from 'lit';

interface TableData {
    rows: string[][];
    headers: string[] | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
}

interface SelectionController {
    selectedRow: number;
    selectedCol: number;
}

interface EditController {
    isEditing: boolean;
}

interface ToolbarHost extends ReactiveControllerHost {
    table: TableData | null;
    sheetIndex: number;
    tableIndex: number;
    selectionCtrl: SelectionController;
    editCtrl: EditController;
    dispatchEvent(event: Event): boolean;
    requestUpdate(): void;
    // Callback to get current cell value
    getCellValue(row: number, col: number): string;
    // Callback to update cell value
    updateCellValue(row: number, col: number, value: string): void;
    // Callback to get and set edit mode value
    getEditModeValue(): string;
    setEditModeValue(value: string): void;
}

/**
 * ToolbarController - Manages toolbar formatting actions.
 *
 * Handles:
 * - Alignment actions (align-left, align-center, align-right)
 * - Column format actions (comma, percent, decimal, word wrap)
 * - Text formatting actions (bold, italic, strikethrough, underline)
 */
export class ToolbarController implements ReactiveController {
    host: ToolbarHost;

    constructor(host: ToolbarHost) {
        this.host = host;
        host.addController(this);
    }

    hostConnected() {}
    hostDisconnected() {}

    /**
     * Handle toolbar action
     */
    handleAction(action: string): void {
        // Alignment actions
        if (action.startsWith('align-')) {
            this._handleAlignAction(action);
            return;
        }

        // Column format actions
        if (action.startsWith('format-')) {
            this._handleFormatAction(action);
            return;
        }

        // Text formatting actions (bold, italic, etc.)
        this._handleTextFormatAction(action);
    }

    /**
     * Apply text format toggle (bold, italic, strikethrough, underline)
     */
    applyFormat(text: string, action: string): string {
        if (action === 'bold') {
            if (text.startsWith('**') && text.endsWith('**')) {
                return text.substring(2, text.length - 2);
            }
            return `**${text}**`;
        }
        if (action === 'italic') {
            if (text.startsWith('*') && text.endsWith('*')) {
                return text.substring(1, text.length - 1);
            }
            return `*${text}*`;
        }
        if (action === 'strikethrough') {
            if (text.startsWith('~~') && text.endsWith('~~')) {
                return text.substring(2, text.length - 2);
            }
            return `~~${text}~~`;
        }
        if (action === 'underline') {
            if (text.startsWith('<u>') && text.endsWith('</u>')) {
                return text.substring(3, text.length - 4);
            }
            return `<u>${text}</u>`;
        }
        return text;
    }

    // ---- Private Methods ----

    private _handleAlignAction(action: string): void {
        const align = action.replace('align-', '');
        const col = this.host.selectionCtrl.selectedCol;
        if (col >= 0) {
            this._dispatchPostMessage({
                command: 'update_column_align',
                colIndex: col,
                alignment: align
            });
        }
    }

    private _handleFormatAction(action: string): void {
        const col = this.host.selectionCtrl.selectedCol;
        if (col < 0) {
            console.warn('No column selected for format action');
            return;
        }

        // Get current format for the column
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const visual = (this.host.table?.metadata as any)?.['visual'] || {};
        const currentFormat = visual.columns?.[String(col)]?.format || {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let newFormat: Record<string, any> | null = null;

        if (action === 'format-comma') {
            newFormat = this._toggleThousandsSeparator(currentFormat);
        } else if (action === 'format-percent') {
            newFormat = this._togglePercentFormat(currentFormat);
        } else if (action === 'format-wordwrap') {
            newFormat = this._toggleWordWrap(currentFormat);
        } else if (action === 'format-decimal-increase') {
            newFormat = this._adjustDecimals(currentFormat, 1);
        } else if (action === 'format-decimal-decrease') {
            newFormat = this._adjustDecimals(currentFormat, -1);
        }

        if (newFormat !== null) {
            this._dispatchPostMessage({
                command: 'update_column_format',
                colIndex: col,
                format: Object.keys(newFormat).length > 0 ? newFormat : null
            });
        }
    }

    private _handleTextFormatAction(action: string): void {
        const { selectionCtrl, editCtrl } = this.host;

        if (editCtrl.isEditing) {
            // Edit mode: Apply to pending value
            const currentVal = this.host.getEditModeValue();
            const newValue = this.applyFormat(currentVal, action);
            this.host.setEditModeValue(newValue);
        } else {
            // Non-edit mode: Apply to cell value
            const r = selectionCtrl.selectedRow;
            const c = selectionCtrl.selectedCol;
            if (r >= 0 && c >= 0) {
                const currentValue = this.host.getCellValue(r, c);
                const newValue = this.applyFormat(currentValue, action);
                if (newValue !== currentValue) {
                    this.host.updateCellValue(r, c, newValue);
                }
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _toggleThousandsSeparator(currentFormat: Record<string, any>): Record<string, any> {
        const currentNumberFormat = currentFormat.numberFormat || {};
        const hasComma = currentNumberFormat.useThousandsSeparator === true;

        if (hasComma) {
            const formatType = currentNumberFormat.type || 'number';
            if (formatType === 'number' && !currentNumberFormat.decimals) {
                const { numberFormat: _, ...rest } = currentFormat;
                return rest;
            } else {
                return {
                    ...currentFormat,
                    numberFormat: { ...currentNumberFormat, useThousandsSeparator: false }
                };
            }
        } else {
            return {
                ...currentFormat,
                numberFormat: {
                    ...currentNumberFormat,
                    type: currentNumberFormat.type || 'number',
                    useThousandsSeparator: true
                }
            };
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _togglePercentFormat(currentFormat: Record<string, any>): Record<string, any> {
        const currentNumberFormat = currentFormat.numberFormat || {};
        if (currentNumberFormat.type === 'percent') {
            const { numberFormat: _, ...rest } = currentFormat;
            return rest;
        } else {
            return {
                ...currentFormat,
                numberFormat: { type: 'percent', decimals: 0 }
            };
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _toggleWordWrap(currentFormat: Record<string, any>): Record<string, any> {
        const currentWordWrap = currentFormat.wordWrap !== false;
        return {
            ...currentFormat,
            wordWrap: !currentWordWrap
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _adjustDecimals(currentFormat: Record<string, any>, delta: number): Record<string, any> | null {
        const currentNumberFormat = currentFormat.numberFormat || {};
        const currentDecimals = currentNumberFormat.decimals ?? 0;
        const newDecimals = currentDecimals + delta;

        if (newDecimals < 0) {
            return null; // Can't go below 0
        }

        return {
            ...currentFormat,
            numberFormat: {
                ...currentNumberFormat,
                type: currentNumberFormat.type || 'number',
                decimals: Math.min(newDecimals, 10)
            }
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _dispatchPostMessage(detail: Record<string, any>): void {
        this.host.dispatchEvent(
            new CustomEvent('post-message', {
                detail: {
                    ...detail,
                    sheetIndex: this.host.sheetIndex,
                    tableIndex: this.host.tableIndex
                },
                bubbles: true,
                composed: true
            })
        );
    }
}
