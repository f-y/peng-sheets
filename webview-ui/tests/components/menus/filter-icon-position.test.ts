/**
 * Filter Icon Click Position Test
 *
 * Verifies that clicking the filter icon emits coordinates based on
 * the icon element's bounding rect, not the mouse cursor position.
 */
import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../../components/cells/ss-column-header';
import { SSColumnHeader } from '../../../components/cells/ss-column-header';

describe('Filter Icon Click Position', () => {
    it('should emit ss-filter-click with element bottom, not mouse Y', async () => {
        const el = await fixture<SSColumnHeader>(html`
            <ss-column-header .col="${0}" .value="${'A'}"></ss-column-header>
        `);

        const filterSpy = vi.fn();
        el.addEventListener('ss-filter-click', filterSpy);

        const filterIcon = el.querySelector('.filter-icon') as HTMLElement;
        expect(filterIcon).toBeTruthy();

        // Mock getBoundingClientRect to return a known position
        const mockRect = {
            left: 100,
            right: 120,
            top: 10,
            bottom: 30,
            width: 20,
            height: 20
        };
        vi.spyOn(filterIcon, 'getBoundingClientRect').mockReturnValue(mockRect as DOMRect);

        // Click at a DIFFERENT position than the element's bounds
        // This simulates clicking in the middle of the icon
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            composed: true,
            clientX: 110, // Middle of icon
            clientY: 200 // WAY below the element's bottom (30)
        });
        filterIcon.dispatchEvent(clickEvent);

        expect(filterSpy).toHaveBeenCalled();
        const detail = filterSpy.mock.calls[0][0].detail;

        // The y should be element's bottom (30), NOT the mouse Y (200)
        expect(detail.y).toBe(30); // rect.bottom
        expect(detail.x).toBe(100); // rect.left
        expect(detail.col).toBe(0);
    });

    it('should NOT emit ss-col-click or ss-col-mousedown when filter icon is clicked', async () => {
        const el = await fixture<SSColumnHeader>(html`
            <ss-column-header .col="${0}" .value="${'A'}"></ss-column-header>
        `);

        const clickSpy = vi.fn();
        const mousedownSpy = vi.fn();
        const filterSpy = vi.fn();

        el.addEventListener('ss-col-click', clickSpy);
        el.addEventListener('ss-col-mousedown', mousedownSpy);
        el.addEventListener('ss-filter-click', filterSpy);

        const filterIcon = el.querySelector('.filter-icon') as HTMLElement;
        expect(filterIcon).toBeTruthy();

        // Dispatch mousedown (should NOT propagate)
        const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, composed: true });
        filterIcon.dispatchEvent(mousedownEvent);
        expect(mousedownSpy).not.toHaveBeenCalled();

        // Dispatch click (should emit filter-click, NOT col-click)
        filterIcon.click();
        expect(filterSpy).toHaveBeenCalled();
        expect(clickSpy).not.toHaveBeenCalled();
    });
});
