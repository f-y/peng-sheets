/**
 * Shared CSS for spreadsheet components.
 * Contains CSS variables and common styles shared across all SS components.
 */

/* CSS Variables (should be applied at :host level with adoptedStyleSheets or import) */
export const sharedVariables = `
    --ss-cell-padding: 2px;
    --ss-header-bg: var(--vscode-editor-background);
    --ss-header-fg: var(--vscode-editor-foreground);
    --ss-border-color: var(--vscode-editorWidget-border);
    --ss-selection-bg: var(--vscode-editor-selectionBackground);
    --ss-selection-border: var(--vscode-focusBorder);
    --ss-selection-color: var(--vscode-focusBorder);
    --ss-row-hover: var(--vscode-list-hoverBackground);
`;

/* Base cell styles - shared by all cell types */
export const baseCellStyles = `
    .cell {
        padding: var(--ss-cell-padding, 2px);
        border-right: 1px solid var(--ss-border-color, var(--vscode-editorWidget-border));
        border-bottom: 1px solid var(--ss-border-color, var(--vscode-editorWidget-border));
        white-space: nowrap;
        overflow: hidden;
        min-height: 20px;
        line-height: 20px;
        outline: none;
        background-color: var(--vscode-editor-background);
        cursor: default;
        user-select: none;
        position: relative;
        z-index: 1;
        box-sizing: border-box;
    }

    .cell::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        box-sizing: border-box;
        z-index: 90;
    }

    .cell.selected {
        z-index: 100;
    }

    .cell.selected-range {
        background-color: rgba(0, 120, 215, 0.1);
    }

    /* Range perimeter borders */
    .cell.range-top::after {
        border-top: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
    .cell.range-bottom::after {
        border-bottom: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
    .cell.range-left::after {
        border-left: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
    .cell.range-right::after {
        border-right: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }

    .cell.active-cell-no-outline {
        outline: none !important;
        z-index: 101;
    }

    .cell:focus {
        outline: none;
    }
`;

/* Header cell styles - shared by row/col headers */
export const headerCellStyles = `
    .header-cell {
        background-color: var(--ss-header-bg, var(--vscode-editor-background));
        font-weight: normal;
        color: var(--vscode-descriptionForeground);
        text-align: center;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: center;
        outline-offset: -2px;
    }

    .header-cell.selected {
        background-color: var(--vscode-editor-selectionBackground);
        color: var(--vscode-editor-selectionForeground);
        outline: none;
    }

    .header-cell.selected-range {
        background-color: var(--vscode-editor-selectionBackground);
        color: var(--vscode-editor-selectionForeground);
    }
`;

/* Editing cell styles */
export const editingCellStyles = `
    .cell.editing {
        z-index: 101;
        background-color: var(--vscode-input-background, #fff);
        color: var(--vscode-input-foreground);
        outline: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
        outline-offset: -2px;
        user-select: text;
        cursor: text;
        white-space: break-spaces;
        word-break: break-word;
        overflow: visible;
        min-height: 1em;
    }

    .cell.editing:not(:has(br ~ *)):not(:has(* ~ br)) > br:only-child {
        line-height: 0;
        font-size: 0;
    }
`;

/* Word wrap styles */
export const wordWrapStyles = `
    .cell.word-wrap {
        white-space: pre-wrap;
        word-break: break-word;
        overflow: hidden;
    }

    .cell.no-wrap {
        white-space: nowrap;
        overflow: visible;
        z-index: 50;
    }
`;

/* Row selection styles */
export const rowSelectionStyles = `
    .cell.selected-row-cell {
        background-color: rgba(33, 115, 70, 0.05);
        z-index: 90;
    }
    .cell.selected-row-cell::after {
        border-top: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
        border-bottom: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
    .cell.selected-row-cell.first::after {
        border-left: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
    .cell.selected-row-cell.last::after {
        border-right: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
`;

/* Column selection styles */
export const colSelectionStyles = `
    .cell.selected-col-cell {
        background-color: rgba(33, 115, 70, 0.05);
        z-index: 90;
    }
    .cell.selected-col-cell::after {
        border-left: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
        border-right: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
    .cell.selected-col-cell.first::after {
        border-top: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
    .cell.selected-col-cell.last::after {
        border-bottom: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
`;

/* Full table selection styles */
export const allSelectionStyles = `
    .cell.selected-all-cell {
        background-color: rgba(33, 115, 70, 0.05);
        z-index: 90;
    }
    .cell.selected-all-cell.first-row::after {
        border-top: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
    .cell.selected-all-cell.last-row::after {
        border-bottom: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
    .cell.selected-all-cell.first-col::after {
        border-left: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
    .cell.selected-all-cell.last-col::after {
        border-right: 2px solid var(--ss-selection-color, var(--vscode-focusBorder));
    }
`;

/* Context menu styles */
export const contextMenuStyles = `
    .context-menu {
        position: fixed;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-widget-border);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 2000;
        min-width: 150px;
        padding: 4px 0;
    }

    .context-menu-item {
        padding: 6px 12px;
        cursor: pointer;
        font-family: var(--vscode-font-family);
        font-size: 13px;
        color: var(--vscode-foreground);
    }

    .context-menu-item:hover {
        background: var(--vscode-list-hoverBackground);
        color: var(--vscode-list-hoverForeground);
    }
`;

/* Metadata editor styles */
export const metadataEditorStyles = `
    .metadata-container {
        margin-bottom: 0;
    }

    .metadata-desc {
        min-height: 1.5em;
        margin: 0;
        padding: 8px;
        transition:
            margin 0.2s,
            min-height 0.2s;
        cursor: text;
        color: var(--vscode-descriptionForeground);
    }

    .metadata-desc.empty {
        margin: 0;
        padding: 0;
        height: 0;
        min-height: 0;
        overflow: hidden;
        opacity: 0;
        transition:
            opacity 0.2s,
            min-height 0.2s,
            padding 0.2s,
            margin 0.2s;
    }

    .metadata-container:hover .metadata-desc.empty {
        min-height: 2em;
        margin: 0;
        padding: 4px;
        opacity: 1;
    }

    .metadata-desc.empty:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.02);
    }

    .placeholder {
        opacity: 0.5;
        font-size: 0.9em;
    }

    .metadata-input-desc {
        width: 100%;
        margin: 0 0 1rem 0;
        box-sizing: border-box;
        border: 1px solid var(--vscode-editorWidget-border);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-family: inherit;
        padding: 4px;
        resize: vertical;
    }
`;
