import { html, css, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { provideVSCodeDesignSystem, vsCodeButton, vsCodeDivider } from '@vscode/webview-ui-toolkit';
import { t } from '../utils/i18n';
// @ts-expect-error type import
import codiconsStyles from '@vscode/codicons/dist/codicon.css?inline';

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeDivider());

@customElement('spreadsheet-toolbar')
export class SpreadsheetToolbar extends LitElement {
    static styles = [
        unsafeCSS(codiconsStyles),
        css`
            :host {
                display: block;
                margin-bottom: 0;
                background: var(--vscode-editor-background);
                padding: 0.25rem;
                border-bottom: 1px solid var(--vscode-widget-border);
            }
            .toolbar {
                display: flex;
                gap: 0.25rem;
                align-items: center;
            }
            vscode-button {
                /* Fix alignment of codicons inside button */
            }
            .codicon {
                font-size: 16px;
                /* Ensure it inherits color */
                color: inherit;
            }
        `
    ];

    render() {
        return html`
                <vscode-button appearance="icon" aria-label="${t('toolbarBold')}" @click="${() => this._dispatch('bold')}">
                    <span class="codicon codicon-bold"></span>
                </vscode-button>
                <vscode-button appearance="icon" aria-label="${t('toolbarItalic')}" @click="${() => this._dispatch('italic')}">
                    <span class="codicon codicon-italic"></span>
                </vscode-button>
                <vscode-button appearance="icon" aria-label="${t('toolbarStrikethrough')}" @click="${() => this._dispatch('strikethrough')}">
                    <span class="codicon codicon-strikethrough"></span>
                </vscode-button>
                <vscode-button appearance="icon" aria-label="${t('toolbarUnderline')}" @click="${() => this._dispatch('underline')}">
                   <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M13 5h-1v3.5a4 4 0 1 1-8 0V5H3v3.5a5 5 0 1 0 10 0V5zm-2 9H5v1h6v-1z"/></svg>
                </vscode-button>
                <vscode-divider></vscode-divider>
                <vscode-button appearance="icon" aria-label="${t('toolbarAlignLeft')}" @click="${() => this._dispatch('align-left')}">
                    <span class="codicon codicon-text-align-left"></span>
                </vscode-button>
                <vscode-button appearance="icon" aria-label="${t('toolbarAlignCenter')}" @click="${() => this._dispatch('align-center')}">
                    <span class="codicon codicon-text-align-center"></span>
                </vscode-button>
                <vscode-button appearance="icon" aria-label="${t('toolbarAlignRight')}" @click="${() => this._dispatch('align-right')}">
                    <span class="codicon codicon-text-align-right"></span>
                </vscode-button>
            </div>
        `;
    }

    private _dispatch(action: string) {
        this.dispatchEvent(
            new CustomEvent('toolbar-action', {
                detail: { action },
                bubbles: true,
                composed: true
            })
        );
    }
}
