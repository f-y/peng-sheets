/**
 * Styles for SpreadsheetToolbar component.
 * Extracted to enable CSS linting and improve maintainability.
 */
import { css } from 'lit';

/** Host styles */
export const hostStyles = css`
    :host {
        display: block;
        margin-bottom: 0;
        background: var(--vscode-editor-background);
        padding: 0.25rem;
        border-bottom: 1px solid var(--vscode-widget-border);
    }
`;

/** Toolbar layout styles */
export const toolbarStyles = css`
    .toolbar {
        display: flex;
        gap: 0.25rem;
        align-items: center;
    }

    .codicon {
        font-size: 16px;
        color: inherit;
    }

    .divider {
        width: 1px;
        height: 16px;
        background-color: var(--vscode-widget-border);
        margin: 0 4px;
    }
`;

/** Combined styles array for SpreadsheetToolbar */
export const spreadsheetToolbarStyles = [hostStyles, toolbarStyles];
