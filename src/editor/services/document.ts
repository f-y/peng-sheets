/**
 * Document service - Document section operations.
 *
 * Handles hybrid notebooks with mixed documents and workbook sections.
 */

import { Workbook } from 'md-spreadsheet-parser';
import type { EditorContext } from '../context';
import type { UpdateResult, EditorConfig, TabOrderItem } from '../types';
import { generateAndGetRange, getWorkbookRange, initializeTabOrderFromStructure } from './workbook';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get workbook range from context, using parser-detected values when available.
 * Falls back to getWorkbookRange for dynamic/modified text.
 */
function getWorkbookRangeFromContext(context: EditorContext): [number, number] {
    const configDict: EditorConfig = context.config ? JSON.parse(context.config) : {};
    const wbName = context.workbook?.name;
    const rootMarker = wbName ? `# ${wbName}` : (configDict.rootMarker ?? '# Workbook');
    const sheetHeaderLevel = configDict.sheetHeaderLevel ?? 2;

    if (context.workbook?.startLine !== undefined && context.workbook?.endLine !== undefined) {
        return [context.workbook.startLine, context.workbook.endLine];
    }
    return getWorkbookRange(context.mdText, rootMarker, sheetHeaderLevel);
}

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
    // workbook.name is just the name without the # prefix, so we need to add it
    const wbName = context.workbook?.name;
    const rootMarker = wbName ? `# ${wbName}` : (configDict.rootMarker ?? '# Workbook');

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
    const wbName = context.workbook?.name;
    const rootMarker = wbName ? `# ${wbName}` : (configDict.rootMarker ?? '# Workbook');

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
                if (afterWorkbook && afterDocIndex < 0) {
                    // Insert right after workbook (before any docs after WB)
                    // Used for between-sheets insertion per SPECS.md 8.5
                    const [, wbEnd] = getWorkbookRangeFromContext(context);
                    insertLine = wbEnd;
                    break;
                }
                // Either not afterWorkbook, or we have a specific afterDocIndex to find
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

        // Calculate new document index
        // The index should reflect the physical position among documents
        let newDocIndex: number;
        if (afterDocIndex >= 0) {
            // Inserting after a specific document
            newDocIndex = afterDocIndex + 1;
        } else if (insertAfterTabOrderIndex >= 0 && insertAfterTabOrderIndex < tabOrder.length) {
            // Inserting at a specific tab order position
            // Count documents that appear BEFORE this position in tab_order
            // These are the documents that will have lower indices than the new doc
            let docsBeforePosition = 0;
            for (let i = 0; i <= insertAfterTabOrderIndex; i++) {
                if (tabOrder[i].type === 'document') {
                    docsBeforePosition++;
                }
            }
            newDocIndex = docsBeforePosition;
        } else {
            // Default: append at end
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
 * This is a pure physical move - metadata is NOT updated here.
 * The caller is responsible for updating tab_order metadata if needed (SPECS.md 8.6).
 */
export function moveDocumentSection(
    context: EditorContext,
    fromDocIndex: number,
    toDocIndex: number | null = null,
    toAfterWorkbook = false,
    toBeforeWorkbook = false
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
    const wbName = context.workbook?.name;
    const rootMarker = wbName ? `# ${wbName}` : (configDict.rootMarker ?? '# Workbook');
    const sheetHeaderLevel = configDict.sheetHeaderLevel ?? 2;

    // Calculate new insertion point
    let insertLine: number = linesWithoutDoc.length;

    if (toAfterWorkbook) {
        const tempText = linesWithoutDoc.join('\n');
        const [, wbEnd] = getWorkbookRange(tempText, rootMarker, sheetHeaderLevel);
        insertLine = wbEnd;
    } else if (toBeforeWorkbook) {
        // Moving to before workbook section
        // If toDocIndex is specified, insert at that position among docs-before-WB
        // Otherwise, insert just before WB
        if (toDocIndex !== null && toDocIndex === 0) {
            // Insert at the very beginning (before first doc)
            insertLine = 0;
        } else if (toDocIndex !== null) {
            // Find the target doc position
            let docIdx = 0;
            let foundTarget = false;
            let inCodeBlock = false;
            const tempText = linesWithoutDoc.join('\n');
            const [wbStart] = getWorkbookRange(tempText, rootMarker, sheetHeaderLevel);

            for (let i = 0; i < wbStart; i++) {
                const line = linesWithoutDoc[i];
                if (line.trim().startsWith('```')) {
                    inCodeBlock = !inCodeBlock;
                }
                if (!inCodeBlock && line.startsWith('# ') && !line.startsWith('## ')) {
                    const stripped = line.trim();
                    if (stripped !== rootMarker) {
                        if (docIdx === toDocIndex) {
                            insertLine = i;
                            foundTarget = true;
                            break;
                        }
                        docIdx++;
                    }
                }
            }
            if (!foundTarget) {
                insertLine = wbStart;
            }
        } else {
            const tempText = linesWithoutDoc.join('\n');
            const [wbStart] = getWorkbookRange(tempText, rootMarker, sheetHeaderLevel);
            insertLine = wbStart;
        }
    } else if (toDocIndex !== null) {
        // toDocIndex semantics: insert at position toDocIndex
        // This means: insert AFTER the document at position (toDocIndex - 1)
        // When toDocIndex=0, insert at beginning
        // When toDocIndex=numDocs, insert at end

        // Adjust toDocIndex for the case where source doc was before target
        // Since we removed fromDocIndex first, indices shift down
        const adjustedToDocIndex = fromDocIndex < toDocIndex ? toDocIndex - 1 : toDocIndex;

        // Find the target insert position
        let docIdx = 0;
        let targetLine = linesWithoutDoc.length;
        let inCodeBlock = false;
        let foundTarget = false;

        // If adjustedToDocIndex is 0, insert at first doc position
        // This needs to respect the doc zone (before or after WB)
        if (adjustedToDocIndex === 0) {
            // For WB-after-docs case: first doc position is at beginning
            // For WB-before-docs case: first doc position is after WB
            // We need to decide based on where the from-doc was originally
            const tempText = linesWithoutDoc.join('\n');
            const [wbStart, wbEnd] = getWorkbookRange(tempText, rootMarker, sheetHeaderLevel);
            const originalText = context.mdText;
            const [originalWbStart] = getWorkbookRange(originalText, rootMarker, sheetHeaderLevel);
            const fromDocWasBeforeWb = startLine < originalWbStart;

            if (fromDocWasBeforeWb) {
                // Doc was before WB - insert at file beginning
                targetLine = 0;
            } else if (wbStart < linesWithoutDoc.length) {
                // Doc was after WB (or WB exists and we need to respect zones)
                // Insert at beginning of after-WB zone = after WB
                targetLine = wbEnd;
            } else {
                // No WB, insert at beginning
                targetLine = 0;
            }
            foundTarget = true;
        } else {

            // Find the document at position (adjustedToDocIndex - 1) and get its END
            const targetDocIdx = adjustedToDocIndex - 1;

            for (let i = 0; i < linesWithoutDoc.length; i++) {
                const line = linesWithoutDoc[i];
                if (line.trim().startsWith('```')) {
                    inCodeBlock = !inCodeBlock;
                }

                if (!inCodeBlock && line.startsWith('# ') && !line.startsWith('## ')) {
                    const stripped = line.trim();
                    if (stripped !== rootMarker) {
                        if (docIdx === targetDocIdx) {
                            // Found the target doc - now find its END (next H1 or EOF)
                            let endLine = linesWithoutDoc.length;
                            let endCodeBlock = false;
                            for (let j = i + 1; j < linesWithoutDoc.length; j++) {
                                const nextLine = linesWithoutDoc[j];
                                if (nextLine.trim().startsWith('```')) {
                                    endCodeBlock = !endCodeBlock;
                                }
                                if (!endCodeBlock && nextLine.startsWith('# ') && !nextLine.startsWith('## ')) {
                                    endLine = j;
                                    break;
                                }
                            }
                            targetLine = endLine;
                            foundTarget = true;
                            break;
                        }
                        docIdx++;
                    }
                }
            }
        }

        // Check if target is "After Last Document" (Append to doc zone)
        if (!foundTarget && docIdx === adjustedToDocIndex) {
            // For before-WB docs, insert before WB (not at EOF)
            const tempText = linesWithoutDoc.join('\\n');
            const [wbStart] = getWorkbookRange(tempText, rootMarker, sheetHeaderLevel);
            const originalText = context.mdText;
            const [originalWbStart] = getWorkbookRange(originalText, rootMarker, sheetHeaderLevel);
            const fromDocWasBeforeWb = startLine < originalWbStart;

            if (wbStart < linesWithoutDoc.length && fromDocWasBeforeWb) {
                // WB exists and from-doc was before WB - insert just before WB
                targetLine = wbStart;
            } else {
                // No WB or from-doc was after WB - insert at EOF
                targetLine = linesWithoutDoc.length;
            }
            foundTarget = true;
        }

        // If target not found, insert at an appropriate boundary
        if (!foundTarget) {
            // Check if WB exists and determine where from-doc was originally
            const tempText = linesWithoutDoc.join('\n');
            const [wbStart] = getWorkbookRange(tempText, rootMarker, sheetHeaderLevel);

            // Check if from-doc was before or after WB in original text
            const originalText = context.mdText;
            const [originalWbStart] = getWorkbookRange(originalText, rootMarker, sheetHeaderLevel);
            const fromDocWasBeforeWb = startLine < originalWbStart;

            if (wbStart < linesWithoutDoc.length && fromDocWasBeforeWb) {
                // WB exists and from-doc was before WB - insert just before WB
                targetLine = wbStart;
            } else {
                // No WB or from-doc was after WB - insert at EOF
                targetLine = linesWithoutDoc.length;
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
    _targetTabOrderIndex: number | null = null
): UpdateResult {
    const configDict: EditorConfig = context.config ? JSON.parse(context.config) : {};
    const wbName = context.workbook?.name;
    const rootMarker = wbName ? `# ${wbName}` : (configDict.rootMarker ?? '# Workbook');
    const sheetHeaderLevel = configDict.sheetHeaderLevel ?? 2;

    const mdText = context.mdText;
    const lines = mdText.split('\n');

    // Find workbook range - use parser-detected range if available
    const [wbStart, wbEnd] = getWorkbookRangeFromContext(context);

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

    // Only initialize from structure if tab_order is missing AND was not explicitly removed
    if (context.workbook && _targetTabOrderIndex !== null) {
        const existingTabOrder = context.workbook.metadata?.tab_order;

        if (!existingTabOrder || (Array.isArray(existingTabOrder) && existingTabOrder.length === 0)) {
            // Check if tab_order was explicitly removed by updateWorkbookTabOrder(null)
            // If metadata is undefined or empty object, it was explicitly cleared - don't reinit
            // (metadata becomes undefined when tab_order was the only property and was deleted)
            const metadataWasCleared = !context.workbook.metadata ||
                Object.keys(context.workbook.metadata).length === 0;

            if (!metadataWasCleared) {
                // Metadata exists with other properties but no tab_order - initialize from structure
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
            // If metadataWasCleared, respect the explicit deletion by updateWorkbookTabOrder(null)
        }
        // If tab_order already exists (pre-set by caller), keep it as-is
    }

    return {
        content: newMdText,
        startLine: 0,
        endLine: lines.length,
        file_changed: true
    };
}
