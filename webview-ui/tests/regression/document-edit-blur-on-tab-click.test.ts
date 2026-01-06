/**
 * Bug Reproduction: Document edit mode should exit when clicking on bottom-tabs
 *
 * Expected behavior:
 * 1. User enters document edit mode (textarea is focused)
 * 2. User clicks on a tab in bottom-tabs
 * 3. The textarea should blur, triggering _exitEditMode
 * 4. Document edit mode should be cancelled
 *
 * Bug: The e.preventDefault() in TabDragController.startPotentialDrag()
 * prevents the focus from moving, so blur never fires.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../components/spreadsheet-document-view';
import '../../components/bottom-tabs';
import type { SpreadsheetDocumentView } from '../../components/spreadsheet-document-view';
import type { BottomTabs } from '../../components/bottom-tabs';

describe('Bug: Document edit mode should exit when clicking on bottom-tabs', () => {
    let documentView: SpreadsheetDocumentView;
    let bottomTabs: BottomTabs;
    let container: HTMLElement;

    beforeEach(async () => {
        // Create container with both components
        container = await fixture<HTMLElement>(html`
            <div>
                <spreadsheet-document-view
                    .title=${'Test Document'}
                    .content=${'Test content'}
                    .sectionIndex=${0}
                ></spreadsheet-document-view>
                <bottom-tabs
                    .tabs=${[
                        { title: 'Sheet 1', type: 'sheet', index: 0, sheetIndex: 0 },
                        { title: 'Document 1', type: 'document', index: 1, docIndex: 0 }
                    ]}
                    .activeIndex=${1}
                ></bottom-tabs>
            </div>
        `);

        documentView = container.querySelector('spreadsheet-document-view') as SpreadsheetDocumentView;
        bottomTabs = container.querySelector('bottom-tabs') as BottomTabs;

        await documentView.updateComplete;
        await bottomTabs.updateComplete;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should exit edit mode when clicking on a tab in bottom-tabs', async () => {
        const documentShadow = documentView.shadowRoot!;

        // Step 1: Enter edit mode by clicking on the output div
        const outputDiv = documentShadow.querySelector('.output') as HTMLElement;
        expect(outputDiv).toBeTruthy();
        outputDiv.click();
        await documentView.updateComplete;

        // Step 2: Verify we are in edit mode (textarea should exist)
        const textarea = documentShadow.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();
        expect((documentView as any)._isEditing).toBe(true);

        // Step 3: Click on a tab in bottom-tabs
        const bottomTabsShadow = bottomTabs.shadowRoot!;
        const tabItems = bottomTabsShadow.querySelectorAll('.tab-item');
        expect(tabItems.length).toBeGreaterThan(0);

        // Simulate mousedown on the first tab (Sheet 1) - this should trigger blur
        const firstTab = tabItems[0] as HTMLElement;
        firstTab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));

        // Wait for any async updates
        await new Promise((resolve) => setTimeout(resolve, 50));
        await documentView.updateComplete;

        // Step 4: Verify edit mode is exited
        // The textarea should be gone (view mode should show .output)
        const textareaAfter = documentShadow.querySelector('textarea');
        const outputAfter = documentShadow.querySelector('.output');

        // BUG: Currently this fails because preventDefault() in startPotentialDrag blocks blur
        expect(textareaAfter).toBeNull();
        expect(outputAfter).toBeTruthy();
        expect((documentView as any)._isEditing).toBe(false);
    });

    it('should exit edit mode when clicking on add-sheet tab', async () => {
        // Update tabs to include add-sheet
        bottomTabs.tabs = [
            { title: 'Sheet 1', type: 'sheet', index: 0, sheetIndex: 0 },
            { title: '+', type: 'add-sheet', index: 1 }
        ];
        bottomTabs.activeIndex = 0;
        await bottomTabs.updateComplete;

        const documentShadow = documentView.shadowRoot!;

        // Enter edit mode
        const outputDiv = documentShadow.querySelector('.output') as HTMLElement;
        outputDiv.click();
        await documentView.updateComplete;

        expect((documentView as any)._isEditing).toBe(true);

        // Click on add-sheet tab (this doesn't go through drag controller)
        const bottomTabsShadow = bottomTabs.shadowRoot!;
        const addSheetTab = bottomTabsShadow.querySelector('.add-sheet-tab') as HTMLElement;
        expect(addSheetTab).toBeTruthy();

        addSheetTab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
        addSheetTab.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        await new Promise((resolve) => setTimeout(resolve, 50));
        await documentView.updateComplete;

        // Add-sheet tab should also cause edit mode to exit
        expect((documentView as any)._isEditing).toBe(false);
    });
});
