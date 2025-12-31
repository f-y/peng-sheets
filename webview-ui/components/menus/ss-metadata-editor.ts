/**
 * ss-metadata-editor - Editor for table metadata (description).
 *
 * Shows table description with click-to-edit functionality.
 *
 * Events Emitted:
 * - ss-metadata-change: { description }
 */
import { LitElement, html, css, PropertyValues, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../../utils/i18n';
import sharedStyles from '../../styles/spreadsheet-shared.css?inline';
import { isIMEComposing } from '../../utils/keyboard-utils';

@customElement('ss-metadata-editor')
export class SSMetadataEditor extends LitElement {
    static styles = [
        css`
            :host {
                display: block;
            }
        `,
        unsafeCSS(sharedStyles)
    ];

    @property({ type: String }) description = '';
    @property({ type: String }) placeholder = '';
    @state() private _isEditing = false;
    @state() private _pendingDescription = '';

    /**
     * Reset editing state when description property changes externally
     * (e.g., when switching sheets)
     */
    protected willUpdate(changedProperties: PropertyValues): void {
        if (changedProperties.has('description') && this._isEditing) {
            // If description changed externally while editing, exit edit mode
            const oldValue = changedProperties.get('description') as string;
            if (oldValue !== undefined && oldValue !== this.description) {
                this._isEditing = false;
                this._pendingDescription = '';
            }
        }
    }

    private _handleClick() {
        this._pendingDescription = this.description || '';
        this._isEditing = true;
        this.requestUpdate();
        // Focus textarea after render
        this.updateComplete.then(() => {
            requestAnimationFrame(() => {
                const input = this.shadowRoot?.querySelector('.metadata-input-desc') as HTMLTextAreaElement;
                if (input) {
                    input.focus();
                    input.select();
                }
            });
        });
    }

    private _handleInput(e: Event) {
        const target = e.target as HTMLTextAreaElement;
        this._pendingDescription = target.value;
    }

    private _handleKeyDown(e: KeyboardEvent) {
        if (isIMEComposing(e)) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            this._isEditing = false;
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this._commit();
        }
    }

    private _handleBlur() {
        this._commit();
    }

    private _commit() {
        this._isEditing = false;
        this.dispatchEvent(
            new CustomEvent('ss-metadata-change', {
                detail: { description: this._pendingDescription },
                bubbles: true,
                composed: true
            })
        );
    }

    render() {
        if (this._isEditing) {
            return html`
                <div class="metadata-container">
                    <textarea
                        class="metadata-input-desc"
                        rows="2"
                        .value="${this._pendingDescription}"
                        placeholder="${this.placeholder || t('description')}"
                        @input="${this._handleInput}"
                        @keydown="${this._handleKeyDown}"
                        @blur="${this._handleBlur}"
                    ></textarea>
                </div>
            `;
        }

        const isEmpty = !this.description;
        const placeholderText = this.placeholder || t('addDescription');
        return html`
            <div class="metadata-container ${isEmpty ? 'empty' : ''}">
                <div class="metadata-desc ${isEmpty ? 'empty' : ''}" @click="${this._handleClick}">
                    ${this.description || html`<span class="placeholder">${placeholderText}</span>`}
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-metadata-editor': SSMetadataEditor;
    }
}
