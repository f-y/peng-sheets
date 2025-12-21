/**
 * Styles for SpreadsheetTable component.
 * Extracted to reduce main component file size.
 */
import { css } from 'lit';

/** Host and base styles */
export const hostStyles = css`
    :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: relative;
        --cell-padding: 2px;
        --header-bg: var(--vscode-editor-background);
        --header-fg: var(--vscode-editor-foreground);
        --border-color: var(--vscode-editorWidget-border);
        --selection-bg: var(--vscode-editor-selectionBackground);
        --selection-border: var(--vscode-focusBorder);
        --selection-color: var(--vscode-focusBorder);
        --row-hover: var(--vscode-list-hoverBackground);
    }

    *,
    *:before,
    *:after {
        box-sizing: inherit;
    }
`;

/** Table container and grid layout */
export const containerStyles = css`
    .table-container {
        flex: 1;
        overflow: auto;
        width: 100%;
        height: 100%;
        border: 1px solid var(--border-color);
        position: relative;
    }

    .grid {
        display: grid;
        transform-style: preserve-3d;
        padding-bottom: 24px; /* Ensure Ghost Row is fully visible when scrolled to bottom */
    }
`;

/** Base cell styles */
export const cellStyles = css`
    .cell {
        padding: var(--cell-padding);
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
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
    }

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

    .cell.selected {
        z-index: 100;
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

    .cell:focus {
        outline: none;
    }

    .cell.selected:focus {
    }
`;

/** Cell selection styles */
export const selectionStyles = css`
    .cell.selected-row-cell {
        background-color: rgba(33, 115, 70, 0.05);
        z-index: 90;
    }
    .cell.selected-row-cell::after {
        border-top: 2px solid var(--selection-color);
        border-bottom: 2px solid var(--selection-color);
    }
    .cell.selected-row-cell.first::after {
        border-left: 2px solid var(--selection-color);
    }
    .cell.selected-row-cell.last::after {
        border-right: 2px solid var(--selection-color);
    }

    .cell.selected-col-cell {
        background-color: rgba(33, 115, 70, 0.05);
        z-index: 90;
    }
    .cell.selected-col-cell::after {
        border-left: 2px solid var(--selection-color);
        border-right: 2px solid var(--selection-color);
    }
    .cell.selected-col-cell.first::after {
        border-top: 2px solid var(--selection-color);
    }
    .cell.selected-col-cell.last::after {
        border-bottom: 2px solid var(--selection-color);
    }

    .cell.selected-all-cell {
        background-color: rgba(33, 115, 70, 0.05);
        z-index: 90;
    }
    .cell.selected-all-cell.first-row::after {
        border-top: 2px solid var(--selection-color);
    }
    .cell.selected-all-cell.last-row::after {
        border-bottom: 2px solid var(--selection-color);
    }
    .cell.selected-all-cell.first-col::after {
        border-left: 2px solid var(--selection-color);
    }
    .cell.selected-all-cell.last-col::after {
        border-right: 2px solid var(--selection-color);
    }

    .cell.selected-range {
        background-color: rgba(0, 120, 215, 0.1);
    }

    .cell.range-top::after {
        border-top: 2px solid var(--selection-color);
    }
    .cell.range-bottom::after {
        border-bottom: 2px solid var(--selection-color);
    }
    .cell.range-left::after {
        border-left: 2px solid var(--selection-color);
    }
    .cell.range-right::after {
        border-right: 2px solid var(--selection-color);
    }

    .cell.active-cell {
    }

    .cell.active-cell-no-outline {
        outline: none !important;
        z-index: 101;
    }
`;

/** Cell editing styles */
export const editingStyles = css`
    .cell.editing {
        z-index: 101;
        background-color: var(--vscode-input-background, #fff);
        color: var(--vscode-input-foreground);
        outline: 2px solid var(--selection-color);
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

/** Header cell styles */
export const headerStyles = css`
    .cell.header-col {
        background-color: var(--header-bg);
        font-weight: normal;
        color: var(--vscode-descriptionForeground);
        text-align: center;
        position: sticky;
        top: 0;
        z-index: 1000;
        transform: translateZ(10px);
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        padding: 0 20px;
        outline-offset: -2px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .cell.header-col.selected {
        background-color: var(--vscode-editor-selectionBackground);
        color: var(--vscode-editor-selectionForeground);
        outline: none;
    }

    .cell.header-col.selected-range {
        background-color: var(--vscode-editor-selectionBackground);
        color: var(--vscode-editor-selectionForeground);
    }

    .header-row {
        background-color: var(--header-bg);
        text-align: center;
        font-weight: normal;
        color: var(--vscode-descriptionForeground);
        position: sticky;
        left: 0;
        z-index: 1002;
        transform: translateZ(15px);
        user-select: none;
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        outline-offset: -2px;
    }

    .header-row.selected {
        background-color: var(--vscode-editor-selectionBackground);
        color: var(--vscode-editor-selectionForeground);
        outline: none;
    }

    .cell.header-row.selected {
        background-color: var(--vscode-editor-selectionBackground);
        color: var(--vscode-editor-selectionForeground);
        outline: none;
    }

    .cell.header-row.selected-range {
        background-color: var(--vscode-editor-selectionBackground);
        color: var(--vscode-editor-selectionForeground);
    }

    .header-corner {
        z-index: 1005;
        transform: translateZ(20px);
        position: sticky;
        top: 0;
        left: 0;
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        text-align: center;
        color: var(--header-bg);
        user-select: none;
        outline-offset: -2px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .header-corner.selected {
        background-color: var(--vscode-editor-selectionBackground);
    }
`;

/** Metadata editor styles */
export const metadataStyles = css`
    .metadata-input-title {
        font-size: 1.17em;
        font-weight: bold;
        width: 100%;
        margin: 1rem 0 0.5rem 0;
        box-sizing: border-box;
        border: 1px solid var(--border-color);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        padding: 4px;
    }

    .metadata-input-desc {
        width: 100%;
        margin: 0 0 1rem 0;
        box-sizing: border-box;
        border: 1px solid var(--border-color);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-family: inherit;
        padding: 4px;
    }

    .metadata-container {
        margin-bottom: 0;
        min-height: 8px;
    }

    .metadata-desc {
        min-height: 1.5em;
        margin: 0;
        padding: 8px;
        transition:
            margin 0.2s,
            min-height 0.2s;
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
`;

/** Context menu styles */
export const contextMenuStyles = css`
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

/** Column resize handle styles */
export const resizeStyles = css`
    .col-resize-handle {
        position: absolute;
        top: 0;
        right: 0;
        width: 5px;
        height: 100%;
        cursor: col-resize;
        z-index: 20;
    }

    .col-resize-handle:hover {
        background-color: var(--selection-color);
    }
`;

/** Filter and format icon styles */
export const filterIconStyles = css`
    .filter-icon {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12px;
        cursor: pointer;
        color: var(--vscode-descriptionForeground);
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s;
        z-index: 200;
    }

    .cell.header-col:hover .filter-icon,
    .filter-icon.active {
        visibility: visible;
        opacity: 1;
        color: var(--vscode-textLink-foreground);
    }

    .format-icon {
        position: absolute;
        right: 22px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12px;
        cursor: pointer;
        color: var(--vscode-descriptionForeground);
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s;
        z-index: 200;
    }

    .cell.header-col:hover .format-icon {
        visibility: visible;
        opacity: 1;
        color: var(--vscode-textLink-foreground);
    }
`;

/** Combined styles array for SpreadsheetTable */
export const spreadsheetTableStyles = [
    hostStyles,
    containerStyles,
    cellStyles,
    selectionStyles,
    editingStyles,
    headerStyles,
    metadataStyles,
    contextMenuStyles,
    resizeStyles,
    filterIconStyles
];
