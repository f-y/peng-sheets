import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/pane-view';
import { PaneView } from '../components/pane-view';
import { TableJSON, LeafNode } from '../types';

describe('PaneView', () => {
    let element: PaneView;

    const mockTables: TableJSON[] = [
        { name: 'Table 1', rows: [], headers: [], metadata: {}, start_line: 0, end_line: 0 },
        { name: 'Table 2', rows: [], headers: [], metadata: {}, start_line: 10, end_line: 10 },
    ];

    beforeEach(async () => {
        element = await fixture<PaneView>(html`<pane-view></pane-view>`);
    });

    it('renders tabs for provided tables', async () => {
        element.tables = mockTables;
        element.node = {
            type: 'pane',
            id: 'test-pane',
            tables: [0, 1],
            activeTableIndex: 0
        };
        await element.updateComplete;

        const tabs = element.shadowRoot!.querySelectorAll('.tab');
        expect(tabs.length).to.equal(2);
        expect(tabs[0].textContent).to.contain('Table 1');
        expect(tabs[1].textContent).to.contain('Table 2');
        expect(tabs[0].classList.contains('active')).to.be.true;
    });

    it('dispatches switch-tab event on tab click', async () => {
        element.tables = mockTables;
        element.node = {
            type: 'pane',
            id: 'test-pane',
            tables: [0, 1],
            activeTableIndex: 0
        };
        await element.updateComplete;

        const paneActionSpy = vi.fn();
        element.addEventListener('pane-action', (e: any) => paneActionSpy(e.detail));

        const tabs = element.shadowRoot!.querySelectorAll('.tab');
        (tabs[1] as HTMLElement).click();

        expect(paneActionSpy).toHaveBeenCalledWith({
            type: 'switch-tab',
            paneId: 'test-pane',
            index: 1
        });
    });

    it('dispatches add-table event on add button click', async () => {
        element.node = {
            type: 'pane',
            id: 'test-pane',
            tables: [0],
            activeTableIndex: 0
        };
        element.tables = [mockTables[0]];

        await element.updateComplete;

        const paneActionSpy = vi.fn();
        element.addEventListener('pane-action', (e: any) => paneActionSpy(e.detail));

        const addBtn = element.shadowRoot!.querySelector('.tab-add') as HTMLElement;
        if (!addBtn) throw new Error('Add button not found');
        addBtn.click();

        expect(paneActionSpy).toHaveBeenCalledWith({
            type: 'add-table',
            paneId: 'test-pane'
        });
    });

    it('handles rename interaction', async () => {
        element.tables = mockTables;
        element.node = {
            type: 'pane',
            id: 'test-pane',
            tables: [0, 1],
            activeTableIndex: 0
        };
        await element.updateComplete;

        const paneActionSpy = vi.fn();
        element.addEventListener('pane-action', (e: any) => paneActionSpy(e.detail));

        // 1. Double click to start editing
        const tabs = element.shadowRoot!.querySelectorAll('.tab');
        const firstTab = tabs[0] as HTMLElement;

        firstTab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        await element.updateComplete;
        await new Promise(r => setTimeout(r, 10)); // Allow setTimeout(focus) in component

        const input = element.shadowRoot!.querySelector('.tab-input') as HTMLInputElement;
        expect(input).to.exist;
        expect(input.value).to.equal('Table 1');

        // 2. Change value and blur/enter
        input.value = 'New Name';
        input.dispatchEvent(new Event('input', { bubbles: true })); // @input handler
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

        expect(paneActionSpy).toHaveBeenCalledWith({
            type: 'rename-table',
            tableIndex: 0, // global index
            newName: 'New Name'
        });
    });

    it('dispatches drag start event', async () => {
        element.tables = mockTables;
        element.node = {
            type: 'pane',
            id: 'test-pane',
            tables: [0, 1],
            activeTableIndex: 0
        };
        await element.updateComplete;

        const tabs = element.shadowRoot!.querySelectorAll('.tab');
        const dragStartSpy = vi.fn();
        tabs[0].addEventListener('dragstart', dragStartSpy);

        // We need to mock dataTransfer
        const evt = new Event('dragstart', { bubbles: true });
        Object.defineProperty(evt, 'dataTransfer', {
            value: {
                setData: vi.fn(),
                effectAllowed: 'none'
            }
        });

        // Add typescript ignore or cast if needed because Event doesn't have dataTransfer
        // but we defined property.
        // However, the listener expects DragEvent.
        // We can cast `as unknown as DragEvent`.

        tabs[0].dispatchEvent(evt);

        expect(evt.dataTransfer!.setData).toHaveBeenCalledWith(
            'application/json',
            expect.stringContaining('"type":"tab-drag"')
        );
    });
});
