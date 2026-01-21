/**
 * Test to verify that newly added tables are automatically selected
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../../components/layout-container';
import { LayoutContainer } from '../../../components/layout-container';
import { LayoutNode } from '../../../types';

describe('LayoutContainer - Add Table Auto-Selection', () => {
    let element: LayoutContainer;

    beforeEach(async () => {
        element = await fixture<LayoutContainer>(html`<layout-container></layout-container>`);
    });

    it('should auto-select newly added table when using pending target pane', async () => {
        // Setup: Initial layout with one table
        const initialLayout: LayoutNode = {
            type: 'pane',
            id: 'test-pane',
            tables: [0],
            activeTableIndex: 0
        };

        element.layout = initialLayout;
        element.tables = [
            { name: 'Table 1', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 }
        ];
        await element.updateComplete;

        // Verify initial state
        let layout = (element as any)._currentLayout;
        expect(layout.tables).to.deep.equal([0]);
        expect(layout.activeTableIndex).to.equal(0);

        // Simulate user clicking "+" button in the pane
        const pane = element.shadowRoot!.querySelector('pane-view')!;
        pane.dispatchEvent(
            new CustomEvent('pane-action', {
                detail: {
                    type: 'add-table',
                    paneId: 'test-pane'
                },
                bubbles: true,
                composed: true
            })
        );
        await element.updateComplete;

        // Verify that pending target pane is set
        expect((element as any)._pendingNewTableTargetPaneId).to.equal('test-pane');

        // Simulate backend adding a new table (index 1)
        element.tables = [
            { name: 'Table 1', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'Table 2', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 }
        ];
        await element.updateComplete;

        // CRITICAL: Verify the new table (index 1) is now selected
        layout = (element as any)._currentLayout;
        expect(layout.tables).to.deep.equal([0, 1]);
        expect(layout.activeTableIndex).to.equal(1, 'New table should be auto-selected');

        // Verify pending state was cleared
        expect((element as any)._pendingNewTableTargetPaneId).to.be.null;
    });

    it('should auto-select newly added table in split view', async () => {
        // Setup: Split view with two panes
        const leftPaneId = 'left-pane';
        const rightPaneId = 'right-pane';
        const initialLayout: LayoutNode = {
            type: 'split',
            id: 'split1',
            direction: 'horizontal',
            sizes: [50, 50],
            children: [
                { type: 'pane', id: leftPaneId, tables: [0], activeTableIndex: 0 },
                { type: 'pane', id: rightPaneId, tables: [1], activeTableIndex: 0 }
            ]
        };

        element.layout = initialLayout;
        element.tables = [
            { name: 'Table 1', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'Table 2', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 }
        ];
        await element.updateComplete;

        // Simulate user clicking "+" in right pane
        const splitView = element.shadowRoot!.querySelector('split-view')!;
        splitView.dispatchEvent(
            new CustomEvent('pane-action', {
                detail: {
                    type: 'add-table',
                    paneId: rightPaneId
                },
                bubbles: true,
                composed: true
            })
        );
        await element.updateComplete;

        // Verify pending target is right pane
        expect((element as any)._pendingNewTableTargetPaneId).to.equal(rightPaneId);

        // Simulate backend adding new table (index 2)
        element.tables = [
            { name: 'Table 1', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'Table 2', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'Table 3', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 }
        ];
        await element.updateComplete;

        // CRITICAL: Verify the new table is in right pane and is selected
        const layout = (element as any)._currentLayout;
        expect(layout.type).to.equal('split');

        const rightPane = layout.children[1];
        expect(rightPane.id).to.equal(rightPaneId);
        expect(rightPane.tables).to.deep.equal([1, 2]);
        expect(rightPane.activeTableIndex).to.equal(1, 'New table should be at index 1 in pane (last position)');
    });

    it('should preserve selection when adding table without pending target', async () => {
        // Setup: Initial layout with two tables
        const initialLayout: LayoutNode = {
            type: 'pane',
            id: 'test-pane',
            tables: [0, 1],
            activeTableIndex: 1  // Currently viewing Table 2
        };

        element.layout = initialLayout;
        element.tables = [
            { name: 'Table 1', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'Table 2', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 }
        ];
        await element.updateComplete;

        // Verify initial state
        let layout = (element as any)._currentLayout;
        expect(layout.activeTableIndex).to.equal(1);

        // Simulate backend adding a new table WITHOUT user clicking "+" 
        // (e.g., table added via programmatic API or from another source)
        // In this case, there's NO pending target pane
        element.tables = [
            { name: 'Table 1', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'Table 2', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 },
            { name: 'Table 3', rows: [[]], headers: [], metadata: {}, start_line: 0, end_line: 0 }
        ];
        await element.updateComplete;

        // When no pending target, the new table goes to last pane but selection should be preserved
        layout = (element as any)._currentLayout;
        expect(layout.tables).to.deep.equal([0, 1, 2]);
        expect(layout.activeTableIndex).to.equal(1, 'Selection should be preserved when no pending target');
    });
});
