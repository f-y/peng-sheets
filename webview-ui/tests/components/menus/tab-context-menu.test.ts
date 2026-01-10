/**
 * Tab Context Menu Tests
 *
 * These tests verify that the tab context menu correctly adjusts its position
 * to stay within the viewport boundaries.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { TabContextMenu } from '../../../components/tab-context-menu';
import '../../../components/tab-context-menu';

describe('TabContextMenu Viewport Adjustment', () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
        originalInnerWidth = window.innerWidth;
        originalInnerHeight = window.innerHeight;
    });

    afterEach(() => {
        // Restore window dimensions
        vi.stubGlobal('innerWidth', originalInnerWidth);
        vi.stubGlobal('innerHeight', originalInnerHeight);
    });

    /**
     * Helper to wait for the component to update and adjust position
     */
    async function waitForPositionAdjustment(): Promise<void> {
        // Wait for setTimeout(0) in updated() to execute
        await new Promise((resolve) => setTimeout(resolve, 10));
    }

    describe('X position adjustment (right edge)', () => {
        it('should adjust X position when menu would overflow right edge', async () => {
            // Set viewport width
            vi.stubGlobal('innerWidth', 800);
            vi.stubGlobal('innerHeight', 600);

            const el = await fixture<TabContextMenu>(html`
                <tab-context-menu .open=${true} .x=${750} .y=${100} .tabType=${'sheet'}>
                </tab-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            // The menu should be repositioned to fit within viewport
            const rect = menuEl.getBoundingClientRect();
            expect(rect.right).to.be.lessThanOrEqual(800);
        });

        it('should not adjust X position when menu fits within viewport', async () => {
            vi.stubGlobal('innerWidth', 800);
            vi.stubGlobal('innerHeight', 600);

            const el = await fixture<TabContextMenu>(html`
                <tab-context-menu .open=${true} .x=${100} .y=${100} .tabType=${'sheet'}>
                </tab-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            // The left position should match the original x value
            expect(menuEl.style.left).to.equal('100px');
        });
    });

    describe('Y position adjustment (bottom edge)', () => {
        it('should adjust Y position when menu would overflow bottom edge', async () => {
            vi.stubGlobal('innerWidth', 800);
            vi.stubGlobal('innerHeight', 400);

            const el = await fixture<TabContextMenu>(html`
                <tab-context-menu .open=${true} .x=${100} .y=${380} .tabType=${'sheet'}>
                </tab-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            // The menu should be repositioned to fit within viewport
            const rect = menuEl.getBoundingClientRect();
            expect(rect.bottom).to.be.lessThanOrEqual(400);
        });

        it('should not adjust Y position when menu fits within viewport', async () => {
            vi.stubGlobal('innerWidth', 800);
            vi.stubGlobal('innerHeight', 600);

            const el = await fixture<TabContextMenu>(html`
                <tab-context-menu .open=${true} .x=${100} .y=${100} .tabType=${'sheet'}>
                </tab-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            // The top position should match the original y value
            expect(menuEl.style.top).to.equal('100px');
        });
    });

    describe('Combined X and Y adjustment', () => {
        it('should adjust both X and Y when menu would overflow both edges', async () => {
            vi.stubGlobal('innerWidth', 400);
            vi.stubGlobal('innerHeight', 300);

            const el = await fixture<TabContextMenu>(html`
                <tab-context-menu .open=${true} .x=${350} .y=${280} .tabType=${'sheet'}>
                </tab-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            const rect = menuEl.getBoundingClientRect();
            expect(rect.right).to.be.lessThanOrEqual(400);
            expect(rect.bottom).to.be.lessThanOrEqual(300);
        });
    });

    describe('Menu visibility', () => {
        it('should not render menu when not open', async () => {
            const el = await fixture<TabContextMenu>(html`
                <tab-context-menu .open=${false} .x=${100} .y=${100} .tabType=${'sheet'}>
                </tab-context-menu>
            `);

            const menuEl = el.shadowRoot?.querySelector('.context-menu');
            expect(menuEl).to.be.null;
        });
    });
});
