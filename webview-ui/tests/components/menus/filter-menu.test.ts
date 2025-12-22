import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../../components/filter-menu';
import { FilterMenu } from '../../../components/filter-menu';

describe('FilterMenu Component', () => {
    let element: FilterMenu;

    beforeEach(() => {
        element = document.createElement('filter-menu') as FilterMenu;
        document.body.appendChild(element);
    });

    afterEach(() => {
        document.body.removeChild(element);
    });

    it('renders correctly', async () => {
        element.columnName = 'Test Col';
        element.values = ['A', 'B', 'C'];
        await element.updateComplete;

        const shadow = element.shadowRoot!;
        expect(shadow.querySelector('.search-input')).toBeTruthy();
        expect(shadow.querySelectorAll('.value-item').length).toBe(4);
    });

    it('dispatches sort events', async () => {
        const sortSpy = vi.fn();
        element.addEventListener('sort', sortSpy);
        element.columnName = 'Test';
        await element.updateComplete;

        const shadow = element.shadowRoot!;
        const btns = shadow.querySelectorAll('.action-btn');
        const ascBtn = btns[0] as HTMLButtonElement;
        const descBtn = btns[1] as HTMLButtonElement;

        ascBtn.click();
        expect(sortSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: { direction: 'asc', column: 'Test' }
            })
        );

        descBtn.click();
        expect(sortSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: { direction: 'desc', column: 'Test' }
            })
        );
    });

    it('filters value list by search', async () => {
        element.values = ['Apple', 'Banana', 'Cherry'];
        await element.updateComplete;

        const shadow = element.shadowRoot!;
        const input = shadow.querySelector('.search-input') as HTMLInputElement;

        input.value = 'Ban';
        input.dispatchEvent(new Event('input'));
        await element.updateComplete;

        const items = shadow.querySelectorAll('.value-item');
        expect(items.length).toBe(2);
        expect(items[1].textContent).toContain('Banana');
    });

    it('dispatches filter-change event when unchecking value', async () => {
        const filterSpy = vi.fn();
        element.addEventListener('filter-change', filterSpy);
        element.columnName = 'Test';
        element.values = ['A', 'B'];
        element.hiddenValues = []; // All visible
        await element.updateComplete;

        const shadow = element.shadowRoot!;
        const checkboxes = Array.from(shadow.querySelectorAll('input[type="checkbox"]'));
        const checkboxA = checkboxes[1] as HTMLInputElement;

        // Uncheck 'A' (hide it)
        checkboxA.checked = false;
        checkboxA.dispatchEvent(new Event('change'));

        expect(filterSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: { column: 'Test', hiddenValues: ['A'] }
            })
        );
    });

    it('dispatches filter-change event when checking value', async () => {
        const filterSpy = vi.fn();
        element.addEventListener('filter-change', filterSpy);
        element.columnName = 'Test';
        element.values = ['A', 'B'];
        element.hiddenValues = ['A']; // A is hidden
        await element.updateComplete;

        const shadow = element.shadowRoot!;
        const checkboxes = Array.from(shadow.querySelectorAll('input[type="checkbox"]'));
        // index 0 is Select All, index 1 is A
        const checkboxA = checkboxes[1] as HTMLInputElement;

        // Check 'A' (unhide it)
        checkboxA.checked = true;
        checkboxA.dispatchEvent(new Event('change'));

        expect(filterSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: { column: 'Test', hiddenValues: [] }
            })
        );
    });

    it('dispatches clear-filter event', async () => {
        const clearSpy = vi.fn();
        element.addEventListener('clear-filter', clearSpy);
        element.columnName = 'Test';
        element.hiddenValues = ['A'];
        await element.updateComplete;

        const shadow = element.shadowRoot!;
        const clearBtn = shadow.querySelector('.action-btn:nth-child(3)') as HTMLButtonElement;

        expect(clearBtn.disabled).toBe(false);
        clearBtn.click();

        expect(clearSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: { column: 'Test' }
            })
        );
    });
    it('handles "Select All" toggle', async () => {
        const filterSpy = vi.fn();
        element.addEventListener('filter-change', filterSpy);
        element.columnName = 'Test';
        element.values = ['A', 'B'];
        element.hiddenValues = [];
        await element.updateComplete;

        const shadow = element.shadowRoot!;
        // The first checkbox is Select All
        const selectAllCheckbox = shadow.querySelector('.value-item input[type="checkbox"]') as HTMLInputElement;
        expect(selectAllCheckbox).toBeTruthy();
        expect(selectAllCheckbox.checked).toBe(true);

        // Uncheck Select All -> Hide All
        selectAllCheckbox.checked = false;
        selectAllCheckbox.dispatchEvent(new Event('change'));

        expect(filterSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: { column: 'Test', hiddenValues: ['A', 'B'] }
            })
        );
    });

    it('handles "Select All" with search', async () => {
        const filterSpy = vi.fn();
        element.addEventListener('filter-change', filterSpy);
        element.columnName = 'Test';
        element.values = ['Apple', 'Banana'];
        element.hiddenValues = [];
        await element.updateComplete;

        const shadow = element.shadowRoot!;
        const searchInput = shadow.querySelector('.search-input') as HTMLInputElement;
        searchInput.value = 'App'; // Matches Apple
        searchInput.dispatchEvent(new Event('input'));
        await element.updateComplete;

        const selectAllCheckbox = shadow.querySelector('.value-item input[type="checkbox"]') as HTMLInputElement;

        // Uncheck Select All -> Hide "Apple" only
        selectAllCheckbox.checked = false;
        selectAllCheckbox.dispatchEvent(new Event('change'));

        expect(filterSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                detail: { column: 'Test', hiddenValues: ['Apple'] } // Banana remains visible (not hidden)
            })
        );
    });
});
