/**
 * SSContextMenu Position Adjustment Tests
 *
 * These tests verify that the ss-context-menu correctly adjusts its position
 * to stay within the viewport boundaries.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SSContextMenu } from '../../../components/menus/ss-context-menu';
import '../../../components/menus/ss-context-menu';

describe('SSContextMenu Viewport Adjustment', () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
        originalInnerWidth = window.innerWidth;
        originalInnerHeight = window.innerHeight;
    });

    afterEach(() => {
        vi.stubGlobal('innerWidth', originalInnerWidth);
        vi.stubGlobal('innerHeight', originalInnerHeight);
    });

    /**
     * Helper to wait for the component to update and adjust position
     */
    async function waitForPositionAdjustment(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }

    describe('X position adjustment (right edge)', () => {
        it('should adjust X position when menu would overflow right edge (row menu)', async () => {
            vi.stubGlobal('innerWidth', 600);
            vi.stubGlobal('innerHeight', 600);

            const el = await fixture<SSContextMenu>(html`
                <ss-context-menu .x=${550} .y=${100} .menuType=${'row'} .index=${0}> </ss-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            const rect = menuEl.getBoundingClientRect();
            expect(rect.right).to.be.lessThanOrEqual(600);
        });

        it('should adjust X position when menu would overflow right edge (column menu)', async () => {
            vi.stubGlobal('innerWidth', 600);
            vi.stubGlobal('innerHeight', 600);

            const el = await fixture<SSContextMenu>(html`
                <ss-context-menu .x=${550} .y=${100} .menuType=${'col'} .index=${0}> </ss-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            const rect = menuEl.getBoundingClientRect();
            expect(rect.right).to.be.lessThanOrEqual(600);
        });

        it('should adjust X position when menu would overflow right edge (cell menu)', async () => {
            vi.stubGlobal('innerWidth', 600);
            vi.stubGlobal('innerHeight', 600);

            const el = await fixture<SSContextMenu>(html`
                <ss-context-menu .x=${550} .y=${100} .menuType=${'cell'} .index=${0}> </ss-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            const rect = menuEl.getBoundingClientRect();
            expect(rect.right).to.be.lessThanOrEqual(600);
        });
    });

    describe('Y position adjustment (bottom edge)', () => {
        it('should adjust Y position when menu would overflow bottom edge (row menu)', async () => {
            vi.stubGlobal('innerWidth', 600);
            vi.stubGlobal('innerHeight', 300);

            const el = await fixture<SSContextMenu>(html`
                <ss-context-menu .x=${100} .y=${250} .menuType=${'row'} .index=${0}> </ss-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            const rect = menuEl.getBoundingClientRect();
            expect(rect.bottom).to.be.lessThanOrEqual(300);
        });

        it('should adjust Y position when menu would overflow bottom edge (column menu)', async () => {
            vi.stubGlobal('innerWidth', 600);
            vi.stubGlobal('innerHeight', 300);

            const el = await fixture<SSContextMenu>(html`
                <ss-context-menu .x=${100} .y=${250} .menuType=${'col'} .index=${0}> </ss-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            const rect = menuEl.getBoundingClientRect();
            expect(rect.bottom).to.be.lessThanOrEqual(300);
        });
    });

    describe('Combined X and Y adjustment', () => {
        it('should adjust both X and Y when menu would overflow both edges', async () => {
            vi.stubGlobal('innerWidth', 300);
            vi.stubGlobal('innerHeight', 200);

            const el = await fixture<SSContextMenu>(html`
                <ss-context-menu .x=${250} .y=${180} .menuType=${'row'} .index=${0}> </ss-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            const rect = menuEl.getBoundingClientRect();
            expect(rect.right).to.be.lessThanOrEqual(300);
            expect(rect.bottom).to.be.lessThanOrEqual(200);
        });
    });

    describe('No adjustment needed', () => {
        it('should not adjust position when menu fits within viewport', async () => {
            vi.stubGlobal('innerWidth', 800);
            vi.stubGlobal('innerHeight', 600);

            const el = await fixture<SSContextMenu>(html`
                <ss-context-menu .x=${100} .y=${100} .menuType=${'row'} .index=${0}> </ss-context-menu>
            `);

            await waitForPositionAdjustment();
            await el.updateComplete;

            const menuEl = el.shadowRoot?.querySelector('.context-menu') as HTMLElement;
            expect(menuEl).to.exist;

            // The position should match the original values
            expect(menuEl.style.left).to.equal('100px');
            expect(menuEl.style.top).to.equal('100px');
        });
    });
});
