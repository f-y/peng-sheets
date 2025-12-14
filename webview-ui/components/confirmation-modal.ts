import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { provideVSCodeDesignSystem } from "@vscode/webview-ui-toolkit";

// Ensure toolkit is registered
provideVSCodeDesignSystem().register();

@customElement('confirmation-modal')
export class ConfirmationModal extends LitElement {
    static styles = css`
        :host {
            display: contents;
        }
        
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 2000;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .modal-container {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
            padding: 24px;
            width: 400px;
            max-width: 90%;
            border-radius: 4px;
        }

        .modal-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--vscode-foreground);
        }

        .modal-content {
            font-size: 14px;
            margin-bottom: 24px;
            color: var(--vscode-descriptionForeground);
        }

        .modal-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }
    `;

    @property({ type: Boolean })
    open = false;

    @property({ type: String })
    title = 'Confirm Action';

    @property({ type: String })
    confirmLabel = 'Delete';

    @property({ type: String })
    cancelLabel = 'Cancel';

    private _handleOverlayClick() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    private _handleStopPropagation(e: Event) {
        e.stopPropagation();
    }

    private _handleConfirm() {
        this.dispatchEvent(new CustomEvent('confirm'));
    }

    private _handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    render() {
        if (!this.open) return html``;

        return html`
            <div class="modal-overlay" @click="${this._handleOverlayClick}">
                <div class="modal-container" @click="${this._handleStopPropagation}">
                    <div class="modal-title">${this.title}</div>
                    <div class="modal-content">
                        <slot></slot>
                    </div>
                    <div class="modal-buttons">
                        <vscode-button appearance="secondary" @click="${this._handleCancel}">${this.cancelLabel}</vscode-button>
                        <vscode-button appearance="primary" @click="${this._handleConfirm}">${this.confirmLabel}</vscode-button>
                    </div>
                </div>
            </div>
        `;
    }
}
