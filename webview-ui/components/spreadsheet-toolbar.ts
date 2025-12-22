import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { provideVSCodeDesignSystem, vsCodeButton, vsCodeDivider } from '@vscode/webview-ui-toolkit';
import { t } from '../utils/i18n';
// @ts-expect-error CSS import
import codiconsStyles from '@vscode/codicons/dist/codicon.css?inline';
// @ts-expect-error CSS import
import toolbarStyles from './styles/toolbar.css?inline';

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeDivider());

@customElement('spreadsheet-toolbar')
export class SpreadsheetToolbar extends LitElement {
    static styles = [unsafeCSS(codiconsStyles), unsafeCSS(toolbarStyles)];

    render() {
        return html`
            <div class="toolbar">
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarUndo')}"
                    title="${t('toolbarUndo')} (${this._isMac() ? '⌘Z' : 'Ctrl+Z'})"
                    @click="${() => this._dispatch('undo')}"
                >
                    <span class="codicon codicon-discard"></span>
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarRedo')}"
                    title="${t('toolbarRedo')} (${this._isMac() ? '⌘⇧Z' : 'Ctrl+Y'})"
                    @click="${() => this._dispatch('redo')}"
                >
                    <span class="codicon codicon-redo"></span>
                </vscode-button>

                <div class="divider"></div>

                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarBold')}"
                    title="${t('toolbarBold')}"
                    @click="${() => this._dispatch('bold')}"
                >
                    <span class="codicon codicon-bold"></span>
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarItalic')}"
                    title="${t('toolbarItalic')}"
                    @click="${() => this._dispatch('italic')}"
                >
                    <span class="codicon codicon-italic"></span>
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarStrikethrough')}"
                    title="${t('toolbarStrikethrough')}"
                    @click="${() => this._dispatch('strikethrough')}"
                >
                    <span class="codicon codicon-strikethrough"></span>
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarUnderline')}"
                    title="${t('toolbarUnderline')}"
                    @click="${() => this._dispatch('underline')}"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                    >
                        <path d="M13 5h-1v3.5a4 4 0 1 1-8 0V5H3v3.5a5 5 0 1 0 10 0V5zm-2 9H5v1h6v-1z" />
                    </svg>
                </vscode-button>

                <div class="divider"></div>

                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarAlignLeft')}"
                    title="${t('toolbarAlignLeft')}"
                    @click="${() => this._dispatch('align-left')}"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                    >
                        <path d="M2 4h12v1H2V4zm0 4h8v1H2V8zm0 4h12v1H2v-1z" />
                    </svg>
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarAlignCenter')}"
                    title="${t('toolbarAlignCenter')}"
                    @click="${() => this._dispatch('align-center')}"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                    >
                        <path d="M2 4h12v1H2V4zm2 4h8v1H4V8zm-2 4h12v1H2v-1z" />
                    </svg>
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarAlignRight')}"
                    title="${t('toolbarAlignRight')}"
                    @click="${() => this._dispatch('align-right')}"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                    >
                        <path d="M2 4h12v1H2V4zm4 4h8v1H6V8zm-4 4h12v1H2v-1z" />
                    </svg>
                </vscode-button>

                <div class="divider"></div>

                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarCommaSeparator')}"
                    title="${t('toolbarCommaSeparator')}"
                    @click="${() => this._dispatch('format-comma')}"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <text x="4" y="14" font-size="14" font-weight="bold">,</text>
                    </svg>
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarPercent')}"
                    title="${t('toolbarPercent')}"
                    @click="${() => this._dispatch('format-percent')}"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <text x="3" y="12" font-size="11" font-weight="bold">%</text>
                    </svg>
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarWordWrap')}"
                    title="${t('toolbarWordWrap')}"
                    @click="${() => this._dispatch('format-wordwrap')}"
                >
                    <span class="codicon codicon-word-wrap"></span>
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarDecimalIncrease')}"
                    title="${t('toolbarDecimalIncrease')}"
                    @click="${() => this._dispatch('format-decimal-increase')}"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1 8 L5 5 L5 11 Z" />
                        <text x="6" y="12" font-size="9">.0</text>
                    </svg>
                </vscode-button>
                <vscode-button
                    appearance="icon"
                    aria-label="${t('toolbarDecimalDecrease')}"
                    title="${t('toolbarDecimalDecrease')}"
                    @click="${() => this._dispatch('format-decimal-decrease')}"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <text x="1" y="12" font-size="9">.0</text>
                        <path d="M15 8 L11 5 L11 11 Z" />
                    </svg>
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

    private _isMac(): boolean {
        return navigator.platform.toLowerCase().includes('mac');
    }
}
