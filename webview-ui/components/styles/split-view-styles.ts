/**
 * Styles for SplitView component.
 * Extracted to enable CSS linting and improve maintainability.
 */
import { css } from 'lit';

/** Host and layout styles */
export const hostStyles = css`
    :host {
        display: flex;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }

    :host([direction='vertical']) {
        flex-direction: column;
    }

    :host([direction='horizontal']) {
        flex-direction: row;
    }
`;

/** Child wrapper styles */
export const childWrapperStyles = css`
    .child-wrapper {
        position: relative;
        overflow: hidden;
    }
`;

/** Resizer handle styles */
export const resizerStyles = css`
    .resizer {
        background-color: var(--vscode-widget-border);
        z-index: 10;
    }

    :host([direction='horizontal']) .resizer {
        width: 4px;
        cursor: col-resize;
    }

    :host([direction='vertical']) .resizer {
        height: 4px;
        cursor: row-resize;
    }
`;

/** Combined styles array for SplitView */
export const splitViewStyles = [hostStyles, childWrapperStyles, resizerStyles];
