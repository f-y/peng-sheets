/**
 * Styles for SpreadsheetDocumentView component.
 * Extracted to enable CSS linting and improve maintainability.
 */
import { css } from 'lit';

/** Host styles */
export const hostStyles = css`
    :host {
        display: block;
        height: 100%;
        overflow: auto;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        position: relative;
    }
`;

/** Container styles */
export const containerStyles = css`
    .container {
        width: 100%;
        padding: 0.2rem;
        margin-top: 20px;
        height: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
    }
`;

/** Output (rendered markdown) styles */
export const outputStyles = css`
    .output {
        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
        font-size: var(--vscode-font-size, 13px);
        line-height: 1.6;
        cursor: text;
        min-height: 100px;
        border-radius: 4px;
        padding: 0.5rem;
        transition: background-color 0.15s ease;
    }

    .output:hover {
        background: rgba(128, 128, 128, 0.05);
    }

    .output.hidden {
        display: none;
    }
`;

/** Editor styles */
export const editorStyles = css`
    .edit-container {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
    }

    .editor {
        width: 100%;
        flex: 1;
        min-height: 400px;
        padding: 0.75rem;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: var(--vscode-editor-font-size, 13px);
        line-height: 1.5;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
        border-radius: 4px;
        resize: none;
        box-sizing: border-box;
    }

    .editor:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }

    .editor.hidden {
        display: none;
    }

    .edit-hint {
        position: absolute;
        top: 6px;
        right: 6px;
        font-size: 0.85em;
        color: var(--vscode-descriptionForeground);
        opacity: 0;
        transition: opacity 0.15s ease;
        pointer-events: none;
    }

    .output:hover ~ .edit-hint,
    .edit-hint.visible {
        opacity: 1;
    }
`;

/** Save button styles */
export const saveButtonStyles = css`
    .save-button {
        position: absolute;
        bottom: 24px;
        right: 24px;
        padding: 5px 12px;
        background: rgba(128, 128, 128, 0.3);
        color: var(--vscode-foreground);
        border: 1px solid rgba(128, 128, 128, 0.4);
        border-radius: 4px;
        font-size: 12px;
        font-weight: normal;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background-color 0.15s ease;
        z-index: 10;
    }

    .save-button:hover {
        background: rgba(128, 128, 128, 0.5);
    }

    .save-button:active {
        background: rgba(128, 128, 128, 0.6);
    }

    .save-button .codicon {
        font-size: 12px;
    }
`;

/** Markdown content styles */
export const markdownStyles = css`
    .output h1 {
        font-size: 2em;
        margin-bottom: 0.5em;
        border-bottom: 1px solid var(--vscode-widget-border);
        padding-bottom: 0.3em;
    }

    .output h2 {
        font-size: 1.5em;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
    }

    .output h3 {
        font-size: 1.25em;
        margin-top: 1em;
        margin-bottom: 0.5em;
    }

    .output p {
        margin: 0.5em 0;
    }

    .output ul,
    .output ol {
        margin: 0.5em 0;
        padding-left: 2em;
    }

    .output li {
        margin: 0.25em 0;
    }

    .output strong {
        font-weight: bold;
    }

    .output em {
        font-style: italic;
    }

    .output a {
        color: var(--vscode-textLink-foreground);
    }

    .output a:hover {
        text-decoration: underline;
    }

    .output code {
        background: var(--vscode-textCodeBlock-background);
        padding: 0.1em 0.3em;
        border-radius: 3px;
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: 0.9em;
    }

    .output pre {
        background: var(--vscode-textCodeBlock-background);
        padding: 1em;
        border-radius: 4px;
        overflow-x: auto;
        margin: 1em 0;
    }

    .output pre code {
        background: none;
        padding: 0;
    }

    .output blockquote {
        border-left: 3px solid var(--vscode-textBlockQuote-border);
        padding-left: 1em;
        margin-left: 0;
        margin-right: 0;
        color: var(--vscode-textBlockQuote-foreground);
    }

    .output hr {
        border: none;
        border-top: 1px solid var(--vscode-widget-border);
        margin: 1.5em 0;
    }

    .output table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
    }

    .output th,
    .output td {
        border: 1px solid var(--vscode-widget-border);
        padding: 0.5em 0.75em;
        text-align: left;
    }

    .output th {
        background: var(--vscode-editor-selectionBackground);
        font-weight: bold;
    }

    .output tr:nth-child(even) td {
        background: var(--vscode-list-hoverBackground);
    }

    .output img {
        max-width: 100%;
        height: auto;
    }
`;

/** Combined styles array for SpreadsheetDocumentView */
export const documentViewStyles = [
    hostStyles,
    containerStyles,
    outputStyles,
    editorStyles,
    saveButtonStyles,
    markdownStyles
];
