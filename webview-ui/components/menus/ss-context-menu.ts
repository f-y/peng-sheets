/**
 * ss-context-menu - A context menu for row/column operations.
 *
 * Shows insert/delete options for rows or columns.
 *
 * Events Emitted:
 * - ss-insert-row: { index, position: 'above' | 'below' }
 * - ss-delete-row: { index }
 * - ss-insert-col: { index, position: 'left' | 'right' }
 * - ss-delete-col: { index }
 * - ss-menu-close: {}
 */
import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { t } from '../../utils/i18n';
import sharedStyles from '../../styles/spreadsheet-shared.css?inline';

@customElement('ss-context-menu')
export class SSContextMenu extends LitElement {
    static styles = [
        css`
            :host {
                display: block;
            }
        `,
        unsafeCSS(sharedStyles)
    ];

    @property({ type: Number }) x = 0;
    @property({ type: Number }) y = 0;
    @property({ type: String }) menuType: 'row' | 'col' | 'cell' = 'row';
    @property({ type: Number }) index = 0;
    @property({ type: Boolean }) hasCopiedRows = false;
    @property({ type: Boolean }) hasCopiedColumns = false;

    connectedCallback() {
        super.connectedCallback();
        // Close menu on outside click
        window.addEventListener('click', this._handleOutsideClick);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('click', this._handleOutsideClick);
    }

    private _handleOutsideClick = () => {
        this.dispatchEvent(
            new CustomEvent('ss-menu-close', {
                bubbles: true,
                composed: true
            })
        );
    };

    private _handleInsertAbove(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-insert-row', {
                detail: { index: this.index, position: 'above' },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleInsertBelow(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-insert-row', {
                detail: { index: this.index + 1, position: 'below' },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleDeleteRow(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-delete-row', {
                detail: { index: this.index },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleInsertCopiedAbove(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-insert-copied-rows', {
                detail: { index: this.index, position: 'above' },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleInsertCopiedBelow(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-insert-copied-rows', {
                detail: { index: this.index, position: 'below' },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleInsertLeft(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-insert-col', {
                detail: { index: this.index, position: 'left' },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleInsertRight(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-insert-col', {
                detail: { index: this.index + 1, position: 'right' },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleDeleteCol(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-delete-col', {
                detail: { index: this.index },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleInsertCopiedLeft(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-insert-copied-cols', {
                detail: { index: this.index, position: 'left' },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleInsertCopiedRight(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-insert-copied-cols', {
                detail: { index: this.index, position: 'right' },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleDataValidation(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-data-validation', {
                detail: { index: this.index },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleCopy(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-copy', {
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleCut(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-cut', {
                bubbles: true,
                composed: true
            })
        );
    }

    private _handlePaste(e: MouseEvent) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('ss-paste', {
                bubbles: true,
                composed: true
            })
        );
    }

    private _stopPropagation(e: MouseEvent) {
        e.stopPropagation();
    }

    render() {
        if (this.menuType === 'cell') {
            return html`
                <div class="context-menu" style="left: ${this.x}px; top: ${this.y}px" @click="${this._stopPropagation}">
                    <div class="context-menu-item" @click="${this._handleCopy}">${t('copy')}</div>
                    <div class="context-menu-item" @click="${this._handleCut}">${t('cut')}</div>
                    <div class="context-menu-item" @click="${this._handlePaste}">${t('paste')}</div>
                </div>
            `;
        } else if (this.menuType === 'row') {
            return html`
                <div class="context-menu" style="left: ${this.x}px; top: ${this.y}px" @click="${this._stopPropagation}">
                    <div class="context-menu-item" @click="${this._handleInsertAbove}">${t('insertRowAbove')}</div>
                    <div class="context-menu-item" @click="${this._handleInsertBelow}">${t('insertRowBelow')}</div>
                    <div class="context-menu-item" @click="${this._handleDeleteRow}">${t('deleteRow')}</div>
                    ${this.hasCopiedRows
                        ? html`
                              <div class="context-menu-separator"></div>
                              <div class="context-menu-item" @click="${this._handleInsertCopiedAbove}">
                                  ${t('insertCopiedRowsAbove')}
                              </div>
                              <div class="context-menu-item" @click="${this._handleInsertCopiedBelow}">
                                  ${t('insertCopiedRowsBelow')}
                              </div>
                          `
                        : ''}
                </div>
            `;
        } else {
            return html`
                <div class="context-menu" style="left: ${this.x}px; top: ${this.y}px" @click="${this._stopPropagation}">
                    <div class="context-menu-item" @click="${this._handleInsertLeft}">${t('insertColLeft')}</div>
                    <div class="context-menu-item" @click="${this._handleInsertRight}">${t('insertColRight')}</div>
                    <div class="context-menu-item" @click="${this._handleDeleteCol}">${t('deleteCol')}</div>
                    ${this.hasCopiedColumns
                        ? html`
                              <div class="context-menu-separator"></div>
                              <div class="context-menu-item" @click="${this._handleInsertCopiedLeft}">
                                  ${t('insertCopiedColsLeft')}
                              </div>
                              <div class="context-menu-item" @click="${this._handleInsertCopiedRight}">
                                  ${t('insertCopiedColsRight')}
                              </div>
                          `
                        : ''}
                    <div class="context-menu-separator"></div>
                    <div class="context-menu-item" @click="${this._handleDataValidation}">${t('dataValidation')}</div>
                </div>
            `;
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-context-menu': SSContextMenu;
    }
}
