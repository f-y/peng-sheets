/**
 * Document service - Document section operations.
 * Converted from python-modules/src/md_spreadsheet_editor/services/document.py
 *
 * Handles hybrid notebooks with mixed documents and workbook sections.
 */

import { Workbook } from 'md-spreadsheet-parser';
import type { EditorContext } from '../context';
import type { UpdateResult, EditorConfig, TabOrderItem } from '../types';
import {
    generateAndGetRange,
    getWorkbookRange,
    initializeTabOrderFromStructure,
    reorderTabMetadata,
} from './workbook';

// =============================================================================
// Document Section Range
// =============================================================================

/**
 * Get the line range of a document section in markdown.
 */
export function getDocumentSectionRange(
    context: EditorContext,
    sectionIndex: number
): { startLine: number; endLine: number } | { error: string } {
    const mdText = context.mdText;
    const configDict: EditorConfig = context.config ? JSON.parse(context.config) : {};
    const rootMarker = configDict.rootMarker ?? '# Tables';

    const lines = mdText.split('\n');
    let docIdx = 0;
    let currentDocStart: number | null = null;
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
        }

        if (!inCodeBlock && line.startsWith('# ') && !line.startsWith('## ')) {
            const stripped = line.trim();
            if (stripped === rootMarker) {
                // Workbook section - not a document
                continue;
            }

            // Found a document section
            if (docIdx === sectionIndex) {
                currentDocStart = i;
            } else if (currentDocStart !== null) {
                // Found next section, so previous ends here
                return { startLine: currentDocStart, endLine: i };
            }
            docIdx++;
        }
    }

    if (currentDocStart !== null) {
        return { startLine: currentDocStart, endLine: lines.length };
    }

    return { error: `Document section ${sectionIndex} not found` };
}

// =============================================================================
// Add Document
// =============================================================================

/**
 * Add a new document section.
 */
export function addDocument(
    context: EditorContext,
    title: string,
    afterDocIndex = -1,
    afterWorkbook = false,
    insertAfterTabOrderIndex = -1
): UpdateResult {
    const mdText = context.mdText;
    const configDict: EditorConfig = context.config ? JSON.parse(context.config) : {};
    const rootMarker = configDict.rootMarker ?? '# Tables';

    const lines = mdText.split('\n');
    let insertLine = lines.length;
    let docCount = 0;

    let inCodeBlock = false;

    // Parse the structure to find insertion point
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
        }

        if (!inCodeBlock && line.startsWith('# ') && !line.startsWith('## ')) {
            const stripped = line.trim();
            if (stripped === rootMarker) {
                if (afterWorkbook) {
                    // Get workbook range and insert after it
                    const [, wbEnd] = getWorkbookRange(mdText, rootMarker, configDict.sheetHeaderLevel ?? 2);
                    insertLine = wbEnd;
                    break;
                }
                continue;
            }

            // Document found
            if (afterDocIndex >= 0 && docCount === afterDocIndex) {
                // Find end of this document
                let nextI = i + 1;
                while (nextI < lines.length) {
                    const nextLine = lines[nextI];
                    if (nextLine.trim().startsWith('```')) {
                        inCodeBlock = !inCodeBlock;
                    }
                    if (!inCodeBlock && nextLine.startsWith('# ') && !nextLine.startsWith('## ')) {
                        break;
                    }
                    nextI++;
                }
                insertLine = nextI;
                break;
            }
            docCount++;
        }
    }

    // Create the new document content
    const newDocContent = `\n# ${title}\n\n`;

    // Build new text
    const beforeLines = lines.slice(0, insertLine);
    const afterLines = lines.slice(insertLine);

    const newMdText = beforeLines.join('\n') + newDocContent + afterLines.join('\n');
    context.mdText = newMdText;

    // Update tab_order
    const workbook = context.workbook;
    if (workbook) {
        const metadata = { ...(workbook.metadata || {}) };
        let tabOrder: TabOrderItem[] = [...(metadata.tab_order || [])];

        // If tab_order is empty, initialize from structure
        if (!tabOrder.length) {
            tabOrder = initializeTabOrderFromStructure(
                mdText,
                context.config,
                (workbook.sheets ?? []).length
            );
        }

        // Shift document indices after the insertion point
        for (const item of tabOrder) {
            if (item.type === 'document' && item.index >= docCount) {
                item.index++;
            }
        }

        // Add new document
        const newDocItem: TabOrderItem = { type: 'document', index: docCount };
        if (insertAfterTabOrderIndex >= 0 && insertAfterTabOrderIndex < tabOrder.length) {
            tabOrder.splice(insertAfterTabOrderIndex + 1, 0, newDocItem);
        } else {
            tabOrder.push(newDocItem);
        }

        metadata.tab_order = tabOrder;
        const newWorkbook = new Workbook({ ...workbook, metadata });
        context.updateWorkbook(newWorkbook);
    }

    return {
        content: newMdText,
        startLine: 0,
        endLine: lines.length - 1,
        file_changed: true,
    };
}

// =============================================================================
// Rename Document
// =============================================================================

/**
 * Rename a document section.
 */
export function renameDocument(
    context: EditorContext,
    docIndex: number,
    newTitle: string
): UpdateResult {
    const rangeResult = getDocumentSectionRange(context, docIndex);
    if ('error' in rangeResult) {
        return { error: rangeResult.error };
    }

    const { startLine } = rangeResult;
    const lines = context.mdText.split('\n');

    // Replace the header line
    lines[startLine] = `# ${newTitle}`;
    const newMdText = lines.join('\n');
    context.mdText = newMdText;

    return {
        content: newMdText,
        startLine: 0,
        endLine: lines.length - 1,
        file_changed: true,
    };
}

// =============================================================================
// Delete Document
// =============================================================================

/**
 * Delete a document section.
 */
export function deleteDocument(
    context: EditorContext,
    docIndex: number
): UpdateResult {
    const rangeResult = getDocumentSectionRange(context, docIndex);
    if ('error' in rangeResult) {
        return { error: rangeResult.error };
    }

    const { startLine, endLine } = rangeResult;
    const lines = context.mdText.split('\n');

    // Remove the document section
    lines.splice(startLine, endLine - startLine);
    const newMdText = lines.join('\n');
    context.mdText = newMdText;

    // Update tab_order
    const workbook = context.workbook;
    if (workbook) {
        const metadata = { ...(workbook.metadata || {}) };
        let tabOrder: TabOrderItem[] = [...(metadata.tab_order || [])];

        // Remove deleted document and shift indices
        tabOrder = tabOrder.filter((item) => !(item.type === 'document' && item.index === docIndex));

        for (const item of tabOrder) {
            if (item.type === 'document' && item.index > docIndex) {
                item.index--;
            }
        }

        metadata.tab_order = tabOrder;
        const newWorkbook = new Workbook({ ...workbook, metadata });
        context.updateWorkbook(newWorkbook);
    }

    return {
        content: newMdText,
        startLine: 0,
        endLine: lines.length,
        file_changed: true,
    };
}

/**
 * Delete document and return full update.
 */
export function deleteDocumentAndGetFullUpdate(
    context: EditorContext,
    docIndex: number
): UpdateResult {
    const result = deleteDocument(context, docIndex);
    if (result.error) {
        return result;
    }

    return {
        ...result,
        ...generateAndGetRange(context),
    };
}

/**
 * Add document and return full update.
 */
export function addDocumentAndGetFullUpdate(
    context: EditorContext,
    title: string,
    afterDocIndex = -1,
    afterWorkbook = false,
    insertAfterTabOrderIndex = -1
): UpdateResult {
    const result = addDocument(context, title, afterDocIndex, afterWorkbook, insertAfterTabOrderIndex);
    if (result.error) {
        return result;
    }

    return {
        ...result,
        ...generateAndGetRange(context),
    };
}

// =============================================================================
// Move Document Section (Complex)
// =============================================================================

/**
 * Move a document section to a new position.
 * This is one of the most complex operations.
 */
export function moveDocumentSection(
    context: EditorContext,
    fromDocIndex: number,
    toDocIndex: number | null = null,
    toAfterWorkbook = false,
    toBeforeWorkbook = false,
    targetTabOrderIndex: number | null = null
): UpdateResult {
    // Get the document section to move
    const rangeResult = getDocumentSectionRange(context, fromDocIndex);
    if ('error' in rangeResult) {
        return { error: rangeResult.error };
    }

    const { startLine, endLine } = rangeResult;
    const lines = context.mdText.split('\n');

    // Extract the document content
    const docContent = lines.slice(startLine, endLine);

    // Remove from original position
    const linesWithoutDoc = [...lines];
    linesWithoutDoc.splice(startLine, endLine - startLine);

    const configDict: EditorConfig = context.config ? JSON.parse(context.config) : {};
    const rootMarker = configDict.rootMarker ?? '# Tables';
    const sheetHeaderLevel = configDict.sheetHeaderLevel ?? 2;

    // Calculate new insertion point
    let insertLine: number;

    if (toAfterWorkbook) {
        const tempText = linesWithoutDoc.join('\n');
        const [, wbEnd] = getWorkbookRange(tempText, rootMarker, sheetHeaderLevel);
        insertLine = wbEnd;
    } else if (toBeforeWorkbook) {
        const tempText = linesWithoutDoc.join('\n');
        const [wbStart] = getWorkbookRange(tempText, rootMarker, sheetHeaderLevel);
        insertLine = wbStart;
    } else if (toDocIndex !== null) {
        // Find the target document position
        let docIdx = 0;
        let targetLine = linesWithoutDoc.length;
        let inCodeBlock = false;

        for (let i = 0; i < linesWithoutDoc.length; i++) {
            const line = linesWithoutDoc[i];
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
            }

            if (!inCodeBlock && line.startsWith('# ') && !line.startsWith('## ')) {
                const stripped = line.trim();
                if (stripped !== rootMarker) {
                    if (docIdx === toDocIndex) {
                        targetLine = i;
                        break;
                    }
                    docIdx++;
                }
            }
        }
        insertLine = targetLine;
    } else {
        insertLine = linesWithoutDoc.length;
    }

    // Insert at new position
    linesWithoutDoc.splice(insertLine, 0, ...docContent);
    const newMdText = linesWithoutDoc.join('\n');
    context.mdText = newMdText;

    // Update tab_order
    const workbook = context.workbook;
    if (workbook && targetTabOrderIndex !== null) {
        const updatedWb = reorderTabMetadata(
            workbook,
            'document',
            fromDocIndex,
            toDocIndex ?? fromDocIndex,
            targetTabOrderIndex
        );
        if (updatedWb) {
            context.updateWorkbook(updatedWb);
        }
    }

    return {
        content: newMdText,
        startLine: 0,
        endLine: lines.length,
        file_changed: true,
    };
}

// =============================================================================
// Move Workbook Section (Complex)
// =============================================================================

/**
 * Move the workbook section to a new position.
 * This is one of the most complex operations.
 */
export function moveWorkbookSection(
    context: EditorContext,
    toDocIndex: number | null = null,
    toAfterDoc = false,
    toBeforeDoc = false,
    targetTabOrderIndex: number | null = null
): UpdateResult {
    const configDict: EditorConfig = context.config ? JSON.parse(context.config) : {};
    const rootMarker = configDict.rootMarker ?? '# Tables';
    const sheetHeaderLevel = configDict.sheetHeaderLevel ?? 2;

    const mdText = context.mdText;
    const lines = mdText.split('\n');

    // Find workbook range
    const [wbStart, wbEnd] = getWorkbookRange(mdText, rootMarker, sheetHeaderLevel);

    if (wbStart >= lines.length) {
        return { error: 'No workbook section found' };
    }

    // Extract workbook content
    const wbContent = lines.slice(wbStart, wbEnd);

    // Remove workbook from original position
    const linesWithoutWb = [...lines];
    linesWithoutWb.splice(wbStart, wbEnd - wbStart);

    // Calculate new insertion point
    let insertLine: number;

    if (toDocIndex !== null) {
        // Find the target document position
        let docIdx = 0;
        let targetLine = 0;
        let inCodeBlock = false;

        for (let i = 0; i < linesWithoutWb.length; i++) {
            const line = linesWithoutWb[i];
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
            }

            if (!inCodeBlock && line.startsWith('# ') && !line.startsWith('## ')) {
                const stripped = line.trim();
                if (stripped !== rootMarker) {
                    if (docIdx === toDocIndex) {
                        targetLine = toBeforeDoc ? i : i; // Will be adjusted
                        break;
                    }
                    docIdx++;

                    if (toAfterDoc && docIdx > toDocIndex) {
                        targetLine = i;
                        break;
                    }
                }
            }
        }

        if (toAfterDoc) {
            // Find end of target document
            let foundDoc = false;
            docIdx = 0;
            inCodeBlock = false;

            for (let i = 0; i < linesWithoutWb.length; i++) {
                const line = linesWithoutWb[i];
                if (line.trim().startsWith('```')) {
                    inCodeBlock = !inCodeBlock;
                }

                if (!inCodeBlock && line.startsWith('# ') && !line.startsWith('## ')) {
                    const stripped = line.trim();
                    if (stripped !== rootMarker) {
                        if (docIdx === toDocIndex) {
                            foundDoc = true;
                        } else if (foundDoc) {
                            targetLine = i;
                            break;
                        }
                        docIdx++;
                    }
                }
            }

            if (foundDoc && targetLine === 0) {
                targetLine = linesWithoutWb.length;
            }
        }

        insertLine = targetLine;
    } else {
        insertLine = linesWithoutWb.length;
    }

    // Insert at new position
    linesWithoutWb.splice(insertLine, 0, ...wbContent);
    const newMdText = linesWithoutWb.join('\n');
    context.mdText = newMdText;

    // Update workbook reference
    if (context.workbook && targetTabOrderIndex !== null) {
        // Tab order update for workbook movement is complex
        // For now, we just regenerate the state
        const metadata = { ...(context.workbook.metadata || {}) };
        const tabOrder = initializeTabOrderFromStructure(
            newMdText,
            context.config,
            (context.workbook.sheets ?? []).length
        );
        metadata.tab_order = tabOrder;
        const newWorkbook = new Workbook({ ...context.workbook, metadata });
        context.updateWorkbook(newWorkbook);
    }

    return {
        content: newMdText,
        startLine: 0,
        endLine: lines.length,
        file_changed: true,
    };
}
