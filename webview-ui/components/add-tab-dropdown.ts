import { html, LitElement, unsafeCSS, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { t } from '../utils/i18n';
import styles from './styles/add-tab-dropdown.css?inline';

/**
 * Dropdown menu for adding new sheets or documents.
 *
 * @fires add-sheet - When "Add Sheet" option is clicked
 * @fires add-document - When "Add Document" option is clicked
 * @fires close - When menu should close (overlay click)
 */
@customElement('add-tab-dropdown')
export class AddTabDropdown extends LitElement {
    static styles = unsafeCSS(styles);

    /** Whether the dropdown is open */
    @property({ type: Boolean })
    open = false;

    /** X position of the dropdown */
    @property({ type: Number })
    x = 0;

    /** Y position of the dropdown */
    @property({ type: Number })
    y = 0;

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
            <div class="dropdown-menu" style="top: ${this.y}px; left: ${this.x}px;">
                <div class="dropdown-item" @click="${() => this._dispatchAction('add-sheet')}">${t('addNewSheet')}</div>
                <div class="dropdown-item" @click="${() => this._dispatchAction('add-document')}">
                    ${t('addNewDocument')}
                </div>
            </div>
            <!-- Overlay to close menu on click outside -->
            <div class="overlay" @click="${this._handleOverlayClick}"></div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'add-tab-dropdown': AddTabDropdown;
    }
}
