/**
 * ss-validation-dialog - Dialog for setting column data validation rules.
 *
 * Events Emitted:
 * - ss-validation-update: { colIndex, rule: ValidationRule | null }
 * - ss-dialog-close: {}
 */
import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../../utils/i18n';
import sharedStyles from '../../styles/spreadsheet-shared.css?inline';
import type { ValidationRule, ValidationRuleType } from '../../controllers/validation-controller';

@customElement('ss-validation-dialog')
export class SSValidationDialog extends LitElement {
    static styles = [
        css`
            :host {
                display: block;
            }
            .dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            .dialog {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                padding: 16px;
                min-width: 300px;
                max-width: 400px;
            }
            .dialog-title {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 16px;
                color: var(--vscode-foreground);
            }
            .form-group {
                margin-bottom: 12px;
            }
            .form-group label {
                display: block;
                margin-bottom: 4px;
                font-size: 12px;
                color: var(--vscode-foreground);
            }
            .form-group select,
            .form-group input,
            .form-group textarea {
                width: 100%;
                padding: 6px 8px;
                border: 1px solid var(--vscode-input-border);
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 2px;
                font-size: 12px;
                box-sizing: border-box;
            }
            .form-group textarea {
                resize: vertical;
                min-height: 60px;
            }
            .button-row {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 16px;
            }
            .button {
                padding: 6px 12px;
                border: none;
                border-radius: 2px;
                font-size: 12px;
                cursor: pointer;
            }
            .button-primary {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            .button-primary:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .button-secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
            .button-danger {
                background: var(--vscode-inputValidation-errorBackground);
                color: var(--vscode-errorForeground);
            }
            .range-inputs {
                display: flex;
                gap: 8px;
            }
            .range-inputs input {
                flex: 1;
            }
        `,
        unsafeCSS(sharedStyles)
    ];

    @property({ type: Number }) colIndex = 0;
    @property({ type: Object }) currentRule: ValidationRule | null = null;

    @state() private _selectedType: ValidationRuleType | 'none' = 'none';
    @state() private _listValues = '';
    @state() private _minValue = '';
    @state() private _maxValue = '';

    connectedCallback() {
        super.connectedCallback();
        this._initFromCurrentRule();
    }

    private _initFromCurrentRule() {
        if (!this.currentRule) {
            this._selectedType = 'none';
            return;
        }

        this._selectedType = this.currentRule.type;

        switch (this.currentRule.type) {
            case 'list':
                this._listValues = this.currentRule.values.join('\n');
                break;
            case 'integer':
                this._minValue = this.currentRule.min?.toString() ?? '';
                this._maxValue = this.currentRule.max?.toString() ?? '';
                break;
        }
    }

    private _handleTypeChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        this._selectedType = select.value as ValidationRuleType | 'none';
    }

    private _handleListValuesChange(e: Event) {
        this._listValues = (e.target as HTMLTextAreaElement).value;
    }

    private _handleMinChange(e: Event) {
        this._minValue = (e.target as HTMLInputElement).value;
    }

    private _handleMaxChange(e: Event) {
        this._maxValue = (e.target as HTMLInputElement).value;
    }

    private _handleApply() {
        let rule: ValidationRule | null = null;

        if (this._selectedType !== 'none') {
            switch (this._selectedType) {
                case 'list':
                    rule = {
                        type: 'list',
                        values: this._listValues
                            .split('\n')
                            .map((v) => v.trim())
                            .filter((v) => v.length > 0)
                    };
                    break;
                case 'date':
                    rule = { type: 'date' };
                    break;
                case 'integer': {
                    const intRule: ValidationRule = { type: 'integer' };
                    if (this._minValue) {
                        (intRule as { min?: number }).min = parseInt(this._minValue, 10);
                    }
                    if (this._maxValue) {
                        (intRule as { max?: number }).max = parseInt(this._maxValue, 10);
                    }
                    rule = intRule;
                    break;
                }
                case 'email':
                    rule = { type: 'email' };
                    break;
                case 'url':
                    rule = { type: 'url' };
                    break;
            }
        }

        this.dispatchEvent(
            new CustomEvent('ss-validation-update', {
                detail: { colIndex: this.colIndex, rule },
                bubbles: true,
                composed: true
            })
        );
        this._close();
    }

    private _handleRemove() {
        this.dispatchEvent(
            new CustomEvent('ss-validation-update', {
                detail: { colIndex: this.colIndex, rule: null },
                bubbles: true,
                composed: true
            })
        );
        this._close();
    }

    private _close() {
        this.dispatchEvent(
            new CustomEvent('ss-dialog-close', {
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleOverlayClick(e: MouseEvent) {
        if ((e.target as HTMLElement).classList.contains('dialog-overlay')) {
            this._close();
        }
    }

    private _stopPropagation(e: Event) {
        e.stopPropagation();
    }

    private _renderTypeOptions() {
        return html`
            <select @change="${this._handleTypeChange}" .value="${this._selectedType}">
                <option value="none">${t('noValidation') || 'No Validation'}</option>
                <option value="list">${t('validationList') || 'List (Dropdown)'}</option>
                <option value="date">${t('validationDate') || 'Date (YYYY-MM-DD)'}</option>
                <option value="integer">${t('validationInteger') || 'Integer'}</option>
                <option value="email">${t('validationEmail') || 'Email'}</option>
                <option value="url">${t('validationUrl') || 'URL'}</option>
            </select>
        `;
    }

    private _renderTypeSpecificFields() {
        switch (this._selectedType) {
            case 'list':
                return html`
                    <div class="form-group">
                        <label>${t('listValues') || 'Values (one per line)'}</label>
                        <textarea
                            .value="${this._listValues}"
                            @input="${this._handleListValuesChange}"
                            placeholder="Open
Closed
Pending"
                        ></textarea>
                    </div>
                `;
            case 'integer':
                return html`
                    <div class="form-group">
                        <label>${t('integerRange') || 'Range (optional)'}</label>
                        <div class="range-inputs">
                            <input
                                type="number"
                                placeholder="Min"
                                .value="${this._minValue}"
                                @input="${this._handleMinChange}"
                            />
                            <input
                                type="number"
                                placeholder="Max"
                                .value="${this._maxValue}"
                                @input="${this._handleMaxChange}"
                            />
                        </div>
                    </div>
                `;
            default:
                return null;
        }
    }

    render() {
        return html`
            <div class="dialog-overlay" @click="${this._handleOverlayClick}">
                <div class="dialog" @click="${this._stopPropagation}">
                    <div class="dialog-title">${t('dataValidation') || 'Data Validation'}</div>

                    <div class="form-group">
                        <label>${t('validationType') || 'Validation Type'}</label>
                        ${this._renderTypeOptions()}
                    </div>

                    ${this._renderTypeSpecificFields()}

                    <div class="button-row">
                        ${this.currentRule
                            ? html`<button class="button button-danger" @click="${this._handleRemove}">
                                  ${t('removeValidation') || 'Remove'}
                              </button>`
                            : null}
                        <button class="button button-secondary" @click="${this._close}">
                            ${t('cancel') || 'Cancel'}
                        </button>
                        <button class="button button-primary" @click="${this._handleApply}">
                            ${t('apply') || 'Apply'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-validation-dialog': SSValidationDialog;
    }
}
