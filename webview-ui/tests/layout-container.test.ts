import { describe, it, expect, beforeEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/layout-container';
import { LayoutContainer } from '../components/layout-container';
import { LayoutNode } from '../types';

describe('LayoutContainer', () => {
    let element: LayoutContainer;

    beforeEach(async () => {
        element = await fixture<LayoutContainer>(html`<layout-container></layout-container>`);
    });

    it('renders default single pane if no layout provided', async () => {
        element.tables = [
            { name: 'Table 1', rows: [['A']], headers: ['H'], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'Table 2', rows: [['B']], headers: ['H'], metadata: {}, start_line: 0, end_line: 0 },
        ];
        await element.updateComplete;

        // Current Layout should be a single pane with both tables
        const layout = (element as any)._currentLayout;
        expect(layout).to.exist;
        expect(layout.type).to.equal('pane');
        expect(layout.tables).to.deep.equal([0, 1]);
        expect(layout.activeTableIndex).to.equal(0);

        // Verify rendering
        const pane = element.shadowRoot!.querySelector('pane-view');
        expect(pane).to.exist;
    });

    it('reconciles layout when table count changes (removal)', async () => {
        // Initial: 2 tables
        const initialLayout: LayoutNode = {
            type: 'pane',
            id: 'root',
            tables: [0, 1],
            activeTableIndex: 1
        };
        element.layout = initialLayout;
        element.tables = [
            { name: 'Table 1', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 }, // Index 0
            // Table 2 (Index 1) removed physically from 'tables' array
        ];
        await element.updateComplete;

        // Should prune index 1
        const layout = (element as any)._currentLayout;
        expect(layout.tables).to.deep.equal([0]);
        // Active index 1 was invalid, should reset to 0 (length-1)
        expect(layout.activeTableIndex).to.equal(0);
    });

    it('reconciles layout when table count changes (addition)', async () => {
        // Initial: 1 table
        const initialLayout: LayoutNode = {
            type: 'pane',
            id: 'root',
            tables: [0],
            activeTableIndex: 0
        };
        element.layout = initialLayout;
        element.tables = [
            { name: 'Table 1', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'Table 2', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
        ];
        await element.updateComplete;

        // Should add index 1 to the pane (addToLastPane behavior)
        const layout = (element as any)._currentLayout;
        expect(layout.tables).to.deep.equal([0, 1]);
    });

    it('handles pane switch action', async () => {
        element.tables = [
            { name: 'Table 1', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'Table 2', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
        ];
        await element.updateComplete;

        const pane = element.shadowRoot!.querySelector('pane-view')!;

        // Simulate event from pane-view: switch-tab
        const paneId = (element as any)._currentLayout.id;
        pane.dispatchEvent(new CustomEvent('pane-action', {
            detail: {
                type: 'switch-tab',
                paneId: paneId,
                index: 1, // Switch to 2nd table
            },
            bubbles: true,
            composed: true
        }));
        await element.updateComplete;

        const layout = (element as any)._currentLayout;
        expect(layout.activeTableIndex).to.equal(1);
    });

    it('dispatches request-add-table event', async () => {
        element.tables = [
            { name: 'Table 1', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
        ];
        await element.updateComplete;

        let evt: any = null;
        element.addEventListener('request-add-table', (e: any) => evt = e);

        const pane = element.shadowRoot!.querySelector('pane-view')!;
        const paneId = (element as any)._currentLayout.id;

        pane.dispatchEvent(new CustomEvent('pane-action', {
            detail: {
                type: 'add-table',
                paneId: paneId
            },
            bubbles: true,
            composed: true
        }));

        expect(evt).to.exist;
        expect(evt.detail.sheetIndex).to.equal(element.sheetIndex);
        // Also verify internal pending state
        expect((element as any)._pendingNewTableTargetPaneId).to.equal(paneId);
    });

    it('handles split-pane action', async () => {
        // Setup simple 2-table pane
        element.tables = [
            { name: 'T1', rows: [], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'T2', rows: [], headers: [], metadata: {}, start_line: 0, end_line: 0 },
        ];
        // Layout: One pane with [0, 1]
        await element.updateComplete;

        const paneId = (element as any)._currentLayout.id;

        // Perform split: Move T2 (index 1) to new pane 'right' (after)
        const pane = element.shadowRoot!.querySelector('pane-view')!;
        pane.dispatchEvent(new CustomEvent('pane-action', {
            detail: {
                type: 'split-pane',
                sourcePaneId: paneId,
                targetPaneId: paneId, // Splitting self
                tableIndex: 1, // T2
                direction: 'horizontal',
                placement: 'after'
            },
            bubbles: true,
            composed: true
        }));
        await element.updateComplete;

        const layout = (element as any)._currentLayout;
        expect(layout.type).to.equal('split');
        expect(layout.direction).to.equal('horizontal');
        expect(layout.children.length).to.equal(2);

        // Left child (Original pane, now should have T1 only)
        const left = layout.children[0];
        expect(left.type).to.equal('pane');
        expect(left.tables).to.deep.equal([0]);

        // Right child (New pane, T2 only)
        const right = layout.children[1];
        expect(right.type).to.equal('pane');
        expect(right.tables).to.deep.equal([1]);
    });

    it('handles move-tab action (drag & drop)', async () => {
        // Setup: Split view with:
        // Left: [0] (T1)
        // Right: [1] (T2)
        const leftId = 'left-pane';
        const rightId = 'right-pane';
        element.layout = {
            type: 'split',
            id: 'split1',
            direction: 'horizontal',
            sizes: [50, 50],
            children: [
                { type: 'pane', id: leftId, tables: [0], activeTableIndex: 0 },
                { type: 'pane', id: rightId, tables: [1], activeTableIndex: 0 }
            ]
        };
        element.tables = [
            { name: 'T1', rows: [], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'T2', rows: [], headers: [], metadata: {}, start_line: 0, end_line: 0 },
        ];
        await element.updateComplete;

        // Move T1 from Left to Right (append)
        const root = element.shadowRoot!.querySelector('split-view')!;
        root.dispatchEvent(new CustomEvent('pane-action', {
            detail: {
                type: 'move-tab',
                sourcePaneId: leftId,
                targetPaneId: rightId,
                tableIndex: 0, // T1
                index: 1 // Append after T2 (which is at index 0 in target)
            },
            bubbles: true,
            composed: true
        }));
        await element.updateComplete;

        const layout = (element as any)._currentLayout;

        // Since left pane became empty, it should have been removed (or logically empty)?
        // The implementation _removeTableFromLayout returns modified node. 
        // If pane becomes empty, _removeTableFromLayout returns { layout: {... tables: [] } }.
        // BUT wait, _removeTableFromLayout:
        // if (newTables.length === 0) return { layout: null ... }
        // So the left pane node is NULL.
        // The split parent then sees one child remaining?
        // if (newChildren.length === 1) return newChildren[0] (Collapse)

        // So we expect the layout to collapse to just the Right Pane (containing [1, 0])
        expect(layout.type).to.equal('pane');
        expect(layout.id).to.equal(rightId); // Should be the surviving pane
        expect(layout.tables).to.deep.equal([1, 0]); // T2, T1
    });
});
