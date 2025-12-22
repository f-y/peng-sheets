/**
 * Styles for SpreadsheetOnboarding component.
 * Extracted to enable CSS linting and improve maintainability.
 */
import { css } from 'lit';

/** Host styles */
export const hostStyles = css`
    :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 1.5rem;
        color: var(--vscode-foreground);
        font-family: var(--vscode-font-family);
    }
`;

/** Typography styles */
export const typographyStyles = css`
    h2 {
        margin: 0;
        font-weight: 500;
        font-size: 1.5em;
    }

    p {
        margin: 0;
        opacity: 0.8;
        max-width: 400px;
        text-align: center;
        line-height: 1.5;
    }
`;

/** Icon container styles */
export const iconStyles = css`
    .icon-container {
        font-size: 4rem;
        opacity: 0.5;
    }
`;

/** Combined styles array for SpreadsheetOnboarding */
export const onboardingStyles = [hostStyles, typographyStyles, iconStyles];
