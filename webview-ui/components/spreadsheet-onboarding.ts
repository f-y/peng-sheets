import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { provideVSCodeDesignSystem } from '@vscode/webview-ui-toolkit';
import { onboardingStyles } from './styles/onboarding-styles';
import { t } from '../utils/i18n';

provideVSCodeDesignSystem().register();

@customElement('spreadsheet-onboarding')
export class SpreadsheetOnboarding extends LitElement {
    static styles = onboardingStyles;

    render() {
        return html`
            <div class="icon-container">
                <svg width="64" height="64" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <path d="M3 3h10v10H3V3zm1 1v3h3V4H4zm4 0v3h3V4H8zm-4 4v3h3V8H4zm4 0v3h3V8H4zm4 0v3h3V8H8z" />
                </svg>
            </div>
            <h2>${t('noSpreadsheetFound')}</h2>
            <p>${t('noSpreadsheetMessage')}</p>
            <vscode-button @click="${this._handleCreate}"> ${t('createSpreadsheet')} </vscode-button>
        `;
    }

    private _handleCreate() {
        this.dispatchEvent(
            new CustomEvent('create-spreadsheet', {
                bubbles: true,
                composed: true
            })
        );
    }
}
