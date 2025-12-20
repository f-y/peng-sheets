import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../../components/split-view';
import { SplitView } from '../../../components/split-view';
import { TableJSON, SplitNode } from '../types';

describe('SplitView', () => {
    let element: SplitView;

    const mockTables: TableJSON[] = [
        { name: 'Table 1', rows: [], headers: [], metadata: {}, start_line: 0, end_line: 0 }
    ];

    beforeEach(async () => {
        element = await fixture<SplitView>(html`<split-view></split-view>`);
    });

    it('renders horizontal split layout correctly', async () => {
        const node: SplitNode = {
            type: 'split',
            id: 'split-1',
            direction: 'horizontal',
            sizes: [50, 50],
            children: [
                { type: 'pane', id: 'pane-1', tables: [0], activeTableIndex: 0 },
                { type: 'pane', id: 'pane-2', tables: [0], activeTableIndex: 0 }
            ]
        };
        element.node = node;
        element.tables = mockTables;
        await element.updateComplete;

        const resizers = element.shadowRoot!.querySelectorAll('.resizer');
        expect(resizers.length).to.equal(1);

        const children = element.shadowRoot!.querySelectorAll('.child-wrapper');
        expect(children.length).to.equal(2);

        // Check direction attribute
        expect(element.getAttribute('direction')).to.equal('horizontal');
    });

    it('renders vertical split layout correctly', async () => {
        const node: SplitNode = {
            type: 'split',
            id: 'split-1',
            direction: 'vertical',
            sizes: [30, 30, 40],
            children: [
                { type: 'pane', id: 'pane-1', tables: [], activeTableIndex: 0 },
                { type: 'pane', id: 'pane-2', tables: [], activeTableIndex: 0 },
                { type: 'pane', id: 'pane-3', tables: [], activeTableIndex: 0 }
            ]
        };
        element.node = node;
        element.tables = mockTables;
        await element.updateComplete;

        const resizers = element.shadowRoot!.querySelectorAll('.resizer');
        expect(resizers.length).to.equal(2); // n-1 resizers

        expect(element.getAttribute('direction')).to.equal('vertical');
    });

    it('handles resize interaction', async () => {
        const node: SplitNode = {
            type: 'split',
            id: 'split-1',
            direction: 'horizontal',
            sizes: [50, 50],
            children: [
                { type: 'pane', id: 'p1', tables: [], activeTableIndex: 0 },
                { type: 'pane', id: 'p2', tables: [], activeTableIndex: 0 }
            ]
        };
        element.node = node;
        element.tables = mockTables;
        await element.updateComplete;

        // Spy on getBoundingClientRect to ensure predictable dimension calc
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
            width: 1000,
            height: 500,
            top: 0,
            left: 0,
            bottom: 500,
            right: 1000,
            x: 0,
            y: 0,
            toJSON: () => {}
        });

        // Listen for pane-action
        const paneActionSpy = vi.fn();
        element.addEventListener('pane-action', (e: any) => paneActionSpy(e.detail));

        const resizer = element.shadowRoot!.querySelector('.resizer') as HTMLElement;

        // 1. MouseDown on resizer
        resizer.dispatchEvent(
            new MouseEvent('mousedown', {
                bubbles: true,
                clientX: 500, // Middle (50%)
                clientY: 0
            })
        );

        // 2. MouseMove on Window (Move 100px right = +10%)
        // New sizes should be roughly [60, 40]
        window.dispatchEvent(
            new MouseEvent('mousemove', {
                bubbles: true,
                clientX: 600,
                clientY: 0
            })
        );

        // Need to wait for requestAnimationFrame
        // Vitest might need wait or mock timer?
        // Let's use loop with small delay or just wait
        await new Promise((r) => setTimeout(r, 50));

        // 3. MouseUp on Window
        window.dispatchEvent(
            new MouseEvent('mouseup', {
                bubbles: true,
                clientX: 600,
                clientY: 0
            })
        );

        expect(paneActionSpy).toHaveBeenCalled();
        const callArgs = paneActionSpy.mock.calls[0][0];
        expect(callArgs.type).to.equal('resize-split');
        expect(callArgs.nodeId).to.equal('split-1');
        expect(callArgs.newSizes.length).to.equal(2);

        // Verify roughly [60, 40]
        expect(callArgs.newSizes[0]).to.be.closeTo(60, 1);
        expect(callArgs.newSizes[1]).to.be.closeTo(40, 1);
    });

    it('normalizes missing sizes', async () => {
        const node: SplitNode = {
            type: 'split',
            id: 'split-bad',
            direction: 'horizontal',
            sizes: [], // Missing
            children: [
                { type: 'pane', id: 'p1', tables: [], activeTableIndex: 0 },
                { type: 'pane', id: 'p2', tables: [], activeTableIndex: 0 }
            ]
        };
        element.node = node;
        await element.updateComplete;

        const wrappers = element.shadowRoot!.querySelectorAll('.child-wrapper');
        // If sizes normalized to [50, 50], flex style should reflect it
        // implementation: flex: ${size} 1 0%
        const style1 = (wrappers[0] as HTMLElement).getAttribute('style');
        expect(style1).to.contain('flex: 50');
    });
});
