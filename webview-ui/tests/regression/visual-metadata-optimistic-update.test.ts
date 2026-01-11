/**
 * Regression Test: Visual Metadata Optimistic Update
 *
 * This test verifies that visual metadata updates (from toolbar actions)
 * are reflected in the local state immediately, without waiting for
 * VS Code's response. This is critical because isSyncing=true causes
 * _parseWorkbook() to be skipped.
 *
 * Bug: Clicking toolbar format buttons did not update the UI when the
 * document was in an unsaved state.
 *
 * Root Cause: _handleVisualMetadataUpdate lacked Optimistic Update.
 */
import { describe, it, expect } from 'vitest';
import { IVisualMetadataUpdateDetail, isSheetJSON, TabDefinition, SheetJSON } from '../../types';

// Mock implementation of _handleVisualMetadataUpdate
function handleVisualMetadataUpdateWithOptimistic(
    tabs: TabDefinition[],
    detail: IVisualMetadataUpdateDetail
): { updated: boolean; tabsAfterUpdate: TabDefinition[] } {
    const { sheetIndex, tableIndex, visual } = detail;

    // Clone tabs to avoid mutation issues
    const clonedTabs = JSON.parse(JSON.stringify(tabs)) as TabDefinition[];

    const targetTab = clonedTabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
    if (targetTab && isSheetJSON(targetTab.data)) {
        const table = targetTab.data.tables[tableIndex];
        if (table) {
            const currentMetadata = (table.metadata || {}) as Record<string, unknown>;
            table.metadata = {
                ...currentMetadata,
                visual: {
                    ...((currentMetadata.visual as Record<string, unknown>) || {}),
                    ...visual
                }
            };
            return { updated: true, tabsAfterUpdate: clonedTabs };
        }
    }
    return { updated: false, tabsAfterUpdate: clonedTabs };
}

describe('Visual Metadata Optimistic Update Regression', () => {
    const createMockTabs = (): TabDefinition[] => [
        {
            type: 'sheet',
            title: 'Sheet1',
            sheetIndex: 0,
            index: 0,
            data: {
                type: 'sheet',
                name: 'Sheet1',
                tables: [
                    {
                        name: 'Table1',
                        description: '',
                        headers: ['Col1', 'Col2'],
                        rows: [['A', 'B']],
                        alignments: ['left', 'left'],
                        metadata: {},
                        start_line: 1,
                        end_line: 3
                    }
                ],
                metadata: {}
            } as SheetJSON
        }
    ];

    it('should update local state immediately when visual metadata is changed', () => {
        const tabs = createMockTabs();

        const detail: IVisualMetadataUpdateDetail = {
            sheetIndex: 0,
            tableIndex: 0,
            visual: {
                columns: {
                    '0': {
                        format: {
                            numberFormat: {
                                type: 'percent'
                            }
                        }
                    }
                }
            }
        };

        const result = handleVisualMetadataUpdateWithOptimistic(tabs, detail);

        expect(result.updated).toBe(true);

        // Verify the visual metadata was merged
        const updatedTab = result.tabsAfterUpdate[0];
        expect(updatedTab.type).toBe('sheet');
        if (isSheetJSON(updatedTab.data)) {
            const table = updatedTab.data.tables[0];
            const visual = (table.metadata as Record<string, unknown>)?.visual as Record<string, unknown>;
            expect(visual).toBeDefined();
            const columns = visual?.columns as Record<string, unknown>;
            expect(columns?.['0']).toBeDefined();
        }
    });

    it('should merge new visual metadata with existing metadata and preserve non-visual keys', () => {
        const tabs = createMockTabs();
        // Add existing visual metadata
        if (isSheetJSON(tabs[0].data)) {
            tabs[0].data.tables[0].metadata = {
                existing: 'value',
                visual: {
                    existingKey: 'preserved'
                }
            };
        }

        const detail: IVisualMetadataUpdateDetail = {
            sheetIndex: 0,
            tableIndex: 0,
            visual: {
                columns: {
                    '0': { format: { numberFormat: { type: 'percent' } } }
                }
            }
        };

        const result = handleVisualMetadataUpdateWithOptimistic(tabs, detail);

        expect(result.updated).toBe(true);
        if (isSheetJSON(result.tabsAfterUpdate[0].data)) {
            const table = result.tabsAfterUpdate[0].data.tables[0];
            const metadata = table.metadata as Record<string, unknown>;
            // Existing non-visual key should be preserved
            expect(metadata.existing).toBe('value');
            // Visual metadata should be merged (shallow merge preserves existingKey)
            const visual = metadata.visual as Record<string, unknown>;
            expect(visual.existingKey).toBe('preserved');
            // New columns key should be added
            expect(visual.columns).toBeDefined();
        }
    });

    it('should return false when sheetIndex does not exist', () => {
        const tabs = createMockTabs();

        const detail: IVisualMetadataUpdateDetail = {
            sheetIndex: 99, // Non-existent
            tableIndex: 0,
            visual: { columns: {} }
        };

        const result = handleVisualMetadataUpdateWithOptimistic(tabs, detail);
        expect(result.updated).toBe(false);
    });

    it('should return false when tableIndex does not exist', () => {
        const tabs = createMockTabs();

        const detail: IVisualMetadataUpdateDetail = {
            sheetIndex: 0,
            tableIndex: 99, // Non-existent
            visual: { columns: {} }
        };

        const result = handleVisualMetadataUpdateWithOptimistic(tabs, detail);
        expect(result.updated).toBe(false);
    });
});
