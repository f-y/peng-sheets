/**
 * Document service - Document section operations.
 * Converted from python-modules/src/md_spreadsheet_editor/services/document.py
 *
 * Handles hybrid notebooks with mixed documents and workbook sections.
 */

import { Workbook } from 'md-spreadsheet-parser';
import type { EditorContext } from '../context';
import type { UpdateResult, EditorConfig, TabOrderItem } from '../types';
import { generateAndGetRange, getWorkbookRange, initializeTabOrderFromStructure, reorderTabMetadata } from './workbook';

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

            // If we were tracking a document and hit ANY level-1 header, end it here
            if (currentDocStart !== null) {
                return { startLine: currentDocStart, endLine: i };
            }

            if (stripped === rootMarker) {
                // Workbook section - not a document, skip
                continue;
            }

            // Found a document section
            if (docIdx === sectionIndex) {
                currentDocStart = i;
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
    // Python uses insertLine = 0 by default (insert at beginning)
    // Only set to len(lines) if afterDocIndex >= 0 and doc not found
    let insertLine = afterDocIndex >= 0 || afterWorkbook ? lines.length : 0;
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
            tabOrder = initializeTabOrderFromStructure(mdText, context.config, (workbook.sheets ?? []).length);
        }

        // Calculate new document index (matching Python logic)
        let newDocIndex: number;
        if (afterDocIndex >= 0) {
            newDocIndex = afterDocIndex + 1;
        } else {
            // Count existing documents in tab_order
            newDocIndex = tabOrder.filter((item) => item.type === 'document').length;
        }

        // Shift document indices >= newDocIndex
        for (const item of tabOrder) {
            if (item.type === 'document' && item.index >= newDocIndex) {
                item.index++;
            }
        }

        // Add new document
        const newDocItem: TabOrderItem = { type: 'document', index: newDocIndex };
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
        file_changed: true
    };
}

// =============================================================================
// Rename Document
// =============================================================================

/**
 * Rename a document section.
 */
export function renameDocument(context: EditorContext, docIndex: number, newTitle: string): UpdateResult {
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
        file_changed: true
    };
}

// =============================================================================
// Delete Document
// =============================================================================

/**
 * Delete a document section.
 */
export function deleteDocument(context: EditorContext, docIndex: number): UpdateResult {
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
        file_changed: true
    };
}

/**
 * Delete document and return full update.
 * Matches Python's delete_document_and_get_full_update behavior:
 * 1. Delete document from md_text
 * 2. Regenerate workbook content
 * 3. Embed regenerated workbook back into md_text
 * 4. Return full md_text with workbook and structure
 */
export function deleteDocumentAndGetFullUpdate(context: EditorContext, docIndex: number): UpdateResult {
    // 1. Get original line count
    const originalMd = context.mdText;
    const originalLineCount = originalMd.split('\n').length;

    // 2. Delete the document (updates md_text in context)
    const deleteResult = deleteDocument(context, docIndex);
    if (deleteResult.error) {
        return deleteResult;
    }

    // 3. Regenerate workbook content
    const wbUpdate = generateAndGetRange(context);

    // 4. Embed the regenerated workbook content into the md_text
    let currentMd = context.mdText;
    let currentLines = currentMd.split('\n');

    if (wbUpdate && !wbUpdate.error && wbUpdate.content !== undefined) {
        const wbStart = wbUpdate.startLine!;
        const wbEnd = wbUpdate.endLine!;
        const wbContent = wbUpdate.content;
        const wbContentLines = wbContent.trimEnd().split('\n');
        if (wbContent) {
            wbContentLines.push('');
        }

        currentLines = [...currentLines.slice(0, wbStart), ...wbContentLines, ...currentLines.slice(wbEnd + 1)];
        currentMd = currentLines.join('\n');
        context.mdText = currentMd;
    }

    // 5. Get full state
    const fullStateJson = context.getFullStateDict();
    const fullState = JSON.parse(fullStateJson);

    return {
        content: currentMd,
        startLine: 0,
        endLine: originalLineCount - 1,
        endCol: 0,
        workbook: fullState.workbook,
        structure: fullState.structure,
        file_changed: true
    };
}

/**
 * Add document and return full update.
 * Matches Python's add_document_and_get_full_update behavior:
 * 1. Add document to md_text
 * 2. Regenerate workbook content
 * 3. Embed regenerated workbook back into md_text
 * 4. Return full md_text with workbook and structure
 */
export function addDocumentAndGetFullUpdate(
    context: EditorContext,
    title: string,
    afterDocIndex = -1,
    afterWorkbook = false,
    insertAfterTabOrderIndex = -1
): UpdateResult {
    // 1. Add the document (updates md_text in context)
    const addResult = addDocument(context, title, afterDocIndex, afterWorkbook, insertAfterTabOrderIndex);
    if (addResult.error) {
        return addResult;
    }

    // 2. Get current md_text from context
    let currentMd = context.mdText;
    let lines = currentMd.split('\n');
    const originalLineCount = lines.length;

    // 3. Regenerate workbook content
    const wbUpdate = generateAndGetRange(context);

    // 4. Embed the regenerated workbook content into the md_text
    if (wbUpdate && !wbUpdate.error && wbUpdate.content !== undefined) {
        const wbStart = wbUpdate.startLine!;
        const wbEnd = wbUpdate.endLine!;
        const wbContent = wbUpdate.content;
        const wbContentLines = wbContent.trimEnd().split('\n');
        if (wbContent) {
            wbContentLines.push('');
        }

        lines = [...lines.slice(0, wbStart), ...wbContentLines, ...lines.slice(wbEnd + 1)];
        currentMd = lines.join('\n');
        context.mdText = currentMd;
    }

    // 5. Get full state
    const fullStateJson = context.getFullStateDict();
    const fullState = JSON.parse(fullStateJson);

    return {
        content: currentMd,
        startLine: 0,
        endLine: originalLineCount - 1,
        endCol: 0,
        workbook: fullState.workbook,
        structure: fullState.structure,
        file_changed: true
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
    let newMdText = linesWithoutDoc.join('\n');
    context.mdText = newMdText;

    // Update tab_order (matching Python's effective_to_index calculation)
    const workbook = context.workbook;
    if (workbook && targetTabOrderIndex !== null) {
        let effectiveToIndex: number;

        if (toDocIndex !== null) {
            effectiveToIndex = toDocIndex;
        } else {
            // Count documents before target position (excluding the moved doc)
            const tabOrder = workbook.metadata?.tab_order || [];
            let docsBeforeTarget = 0;
            for (let i = 0; i < Math.min(targetTabOrderIndex, tabOrder.length); i++) {
                const item = tabOrder[i];
                if (item.type === 'document' && item.index !== fromDocIndex) {
                    docsBeforeTarget++;
                }
            }
            effectiveToIndex = docsBeforeTarget;
        }

        const updatedWb = reorderTabMetadata(workbook, 'document', fromDocIndex, effectiveToIndex, targetTabOrderIndex);
        if (updatedWb) {
            context.updateWorkbook(updatedWb);

            // Update metadata comment in markdown (matching Python behavior)
            const newMetadata = JSON.stringify(updatedWb.metadata);
            const metadataComment = `<!-- md-spreadsheet-workbook-metadata: ${newMetadata} -->`;

            // Replace existing metadata comment or append
            const metadataPattern = /<!-- md-spreadsheet-workbook-metadata: \{.*?\} -->/;
            if (metadataPattern.test(newMdText)) {
                newMdText = newMdText.replace(metadataPattern, metadataComment);
                context.mdText = newMdText;
            }
        }
    }

    return {
        content: context.mdText,
        startLine: 0,
        endLine: lines.length,
        file_changed: true
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
                    if (docIdx === toDocIndex && toBeforeDoc) {
                        // For toBeforeDoc, insert before this document
                        targetLine = i;
                        break;
                    }
                    docIdx++;
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

                    // If we found the target doc and hit ANY level-1 header, end here
                    if (foundDoc) {
                        targetLine = i;
                        break;
                    }

                    if (stripped !== rootMarker) {
                        if (docIdx === toDocIndex) {
                            foundDoc = true;
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
        file_changed: true
    };
}
