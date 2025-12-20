/**
 * ss-corner-cell - The corner cell at the intersection of row and column headers.
 *
 * Uses Light DOM rendering and emits custom events for parent handling.
 *
 * Events Emitted:
 * - ss-corner-click: {}
 * - ss-corner-keydown: { originalEvent }
 */
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { emitCellEvent } from '../mixins/cell-events';

@customElement('ss-corner-cell')
export class SSCornerCell extends LitElement {
    // Disable shadow DOM - render to light DOM
    protected createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();
        this.style.display = 'contents';
    }

    @property({ type: Boolean }) isSelected = false;

    private _onClick = () => {
        emitCellEvent(this, 'ss-corner-click', {});
    };

    private _onKeydown = (e: KeyboardEvent) => {
        emitCellEvent(this, 'ss-corner-keydown', { originalEvent: e });
    };

    render() {
        return html`
            <div
                class="cell header-corner ${this.isSelected ? 'selected' : ''}"
                tabindex="0"
                @click="${this._onClick}"
                @keydown="${this._onKeydown}"
            ></div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-corner-cell': SSCornerCell;
    }
}
