import { html, LitElement, unsafeCSS, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { t } from '../utils/i18n';
// @ts-expect-error CSS import
import styles from './styles/tab-context-menu.css?inline';

/**
 * Context menu component for sheet/document tabs.
 *
 * @fires rename - When rename option is clicked
 * @fires delete - When delete option is clicked
 * @fires add-document - When add document option is clicked
 * @fires add-sheet - When add sheet option is clicked
 * @fires close - When menu should close (overlay click)
 */
@customElement('tab-context-menu')
export class TabContextMenu extends LitElement {
    static styles = unsafeCSS(styles);

    /** Whether the menu is open */
    @property({ type: Boolean })
    open = false;

    /** X position of the menu */
    @property({ type: Number })
    x = 0;

    /** Y position of the menu */
    @property({ type: Number })
    y = 0;

    /** Type of the tab: 'sheet' or 'document' */
    @property({ type: String })
    tabType: 'sheet' | 'document' = 'sheet';

    private _dispatchAction(action: string) {
        this.dispatchEvent(
            new CustomEvent(action, {
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleOverlayClick() {
        this._dispatchAction('close');
    }

    render() {
        if (!this.open) return nothing;

        return html`
            <div class="context-menu" style="top: ${this.y}px; left: ${this.x}px;">
                ${this.tabType === 'sheet'
                    ? html`
                          <div class="context-menu-item" @click="${() => this._dispatchAction('rename')}">
                              ${t('renameSheet')}
                          </div>
                          <div class="context-menu-item" @click="${() => this._dispatchAction('delete')}">
                              ${t('deleteSheet')}
                          </div>
                      `
                    : html`
                          <div class="context-menu-item" @click="${() => this._dispatchAction('rename')}">
                              ${t('renameDocument')}
                          </div>
                          <div class="context-menu-item" @click="${() => this._dispatchAction('delete')}">
                              ${t('deleteDocument')}
                          </div>
                      `}
                <div class="menu-divider"></div>
                <div class="context-menu-item" @click="${() => this._dispatchAction('add-document')}">
                    ${t('addNewDocument')}
                </div>
                <div class="context-menu-item" @click="${() => this._dispatchAction('add-sheet')}">
                    ${t('addNewSheet')}
                </div>
            </div>
            <!-- Overlay to close menu on click outside -->
            <div class="overlay" @click="${this._handleOverlayClick}"></div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'tab-context-menu': TabContextMenu;
    }
}
