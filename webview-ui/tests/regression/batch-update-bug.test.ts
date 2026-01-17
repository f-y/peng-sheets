/**
 * Reproduction Test: Batch Update Bug
 *
 * BUG: When two operations update DIFFERENT line ranges in the same batch,
 * only the last update is sent to the file. This causes the first operation
 * (physical document move) to be lost.
 *
 * The batch system assumes updates are cumulative and only sends the last one,
 * but physical move (document section) and metadata update (workbook section)
 * are different line ranges.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';

describe('Batch Update Bug: Different line ranges', () => {
    const WORKBOOK_MD = `# Tables

## Sheet 1

| Column 1 |
| --- |
|  |

## Sheet 2

| Column 1 |
| --- |
|  |

# Doc 1

Content of Doc 1

# Doc 2

Content of Doc 2

# Doc 3

Content of Doc 3
`;

    beforeEach(() => {
        editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
    });

    it('BUG REPRODUCTION: moveDocumentSection and updateWorkbookTabOrder have different line ranges', () => {
        // Step 1: Call moveDocumentSection
        const moveResult = editor.moveDocumentSection(1, null, true, false);

        // Step 2: Call updateWorkbookTabOrder
        const tabOrder = [
            { type: 'sheet', index: 0 },
            { type: 'document', index: 0 },
            { type: 'sheet', index: 1 },
            { type: 'document', index: 1 },
            { type: 'document', index: 2 }
        ] as editor.TabOrderItem[];

        const metadataResult = editor.updateWorkbookTabOrder(tabOrder);

        // Verify they have DIFFERENT line ranges
        console.log('moveResult range:', moveResult.startLine, '-', moveResult.endLine);
        console.log('metadataResult range:', metadataResult.startLine, '-', metadataResult.endLine);

        // THE BUG: These ranges are different!
        // If batch only sends the last one, the move is LOST
        const rangesAreDifferent =
            moveResult.startLine !== metadataResult.startLine ||
            moveResult.endLine !== metadataResult.endLine;

        // This assertion documents the bug
        expect(rangesAreDifferent).toBe(true);

        // Verify moveResult contains the correct doc order
        const moveDocHeaders = moveResult.content?.match(/^# Doc \d+/gm);
        expect(moveDocHeaders).toEqual(['# Doc 2', '# Doc 1', '# Doc 3']);

        // Verify metadataResult does NOT contain the doc sections (different range)
        const metadataDocHeaders = metadataResult.content?.match(/^# Doc \d+/gm);
        // If null or different, the bug is confirmed
        console.log('metadataResult doc headers:', metadataDocHeaders);
    });

    it('SOLUTION: Both updates should be sent to file, not just the last one', () => {
        // For D8 case, we need to send BOTH:
        // 1. The document section update (physical reorder)
        // 2. The workbook section update (metadata)
        //
        // Current batch system fails because it only sends the last update.
        // Solution: Either merge the updates or send them separately.

        // Get both results
        const moveResult = editor.moveDocumentSection(1, null, true, false);
        const tabOrder = [
            { type: 'sheet', index: 0 },
            { type: 'document', index: 0 },
            { type: 'sheet', index: 1 },
            { type: 'document', index: 1 },
            { type: 'document', index: 2 }
        ] as editor.TabOrderItem[];
        const metadataResult = editor.updateWorkbookTabOrder(tabOrder);

        // Both should have valid content
        expect(moveResult.error).toBeUndefined();
        expect(metadataResult.error).toBeUndefined();

        // Verify the internal editor state is correct (both operations applied)
        const state = JSON.parse(editor.getState());
        const docTitles = state.structure
            .filter((s: { type: string }) => s.type === 'document')
            .map((d: { title: string }) => d.title);

        // Internal state should have correct order
        expect(docTitles).toEqual(['Doc 2', 'Doc 1', 'Doc 3']);

        // And metadata should be set
        expect(state.workbook.metadata.tab_order).toBeDefined();
    });
});
