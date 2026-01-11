import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LayoutNode, SplitNode, LeafNode, TableJSON, WorkbookJSON } from '../types';
import './pane-view';
import './split-view';
import { nanoid } from 'nanoid';

@customElement('layout-container')
export class LayoutContainer extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
    `;

    @property({ type: Object })
    layout?: LayoutNode;

    @property({ type: Array })
    tables: TableJSON[] = [];

    @property({ type: Number })
    sheetIndex: number = 0;

    @property({ type: String })
    dateFormat: string = 'YYYY-MM-DD';

    @property({ type: Object })
    workbook: WorkbookJSON | null = null;

    // Internal state to handle optimistic updates during drag/drop
    @state()
    private _currentLayout: LayoutNode | null = null;

    private _pendingNewTableTargetPaneId: string | null = null;

    willUpdate(changedProperties: PropertyValues) {
        if (changedProperties.has('layout') || changedProperties.has('tables')) {
            this._initializeLayout();
        }
    }

    private _initializeLayout() {
        if (this.layout) {
            // Collect current activeTableIndex values before reconciliation
            const localActiveIndices = new Map<string, number>();
            if (this._currentLayout) {
                this._traverse(this._currentLayout, (node) => {
                    if (node.type === 'pane') {
                        localActiveIndices.set(node.id, node.activeTableIndex);
                    }
                });
            }

            // Reconcile layout with new data
            let newLayout = this._reconcileLayout(this.layout, this.tables.length);

            // Restore local activeTableIndex values (they take precedence over file values)
            if (localActiveIndices.size > 0) {
                newLayout = this._restoreActiveIndices(newLayout, localActiveIndices);
            }

            this._currentLayout = newLayout;
        } else {
            // Default: All tables in one pane
            this._currentLayout = {
                type: 'pane',
                id: 'root',
                tables: this.tables.map((_, i) => i),
                activeTableIndex: 0
            };
        }
    }

    /**
     * Restore local activeTableIndex values after reconciliation.
     * This ensures tab selection is preserved across parent updates.
     */
    private _restoreActiveIndices(node: LayoutNode, localIndices: Map<string, number>): LayoutNode {
        if (node.type === 'pane') {
            const localIndex = localIndices.get(node.id);
            if (localIndex !== undefined && localIndex !== node.activeTableIndex) {
                // Ensure index is still valid
                const validIndex = Math.min(localIndex, Math.max(0, node.tables.length - 1));
                return { ...node, activeTableIndex: validIndex };
            }
            return node;
        } else {
            const newChildren = node.children.map((c) => this._restoreActiveIndices(c, localIndices));
            // Check if any child actually changed
            const changed = newChildren.some((c, i) => c !== node.children[i]);
            return changed ? { ...node, children: newChildren as LayoutNode[] } : node;
        }
    }

    private _reconcileLayout(root: LayoutNode, totalTables: number): LayoutNode {
        // 1. Collect all referenced table indices
        const referencedIndices = new Set<number>();
        this._traverse(root, (node) => {
            if (node.type === 'pane') {
                node.tables.forEach((idx) => referencedIndices.add(idx));
            }
        });

        // 2. Identify missing and invalid indices
        const missingIndices: number[] = [];
        for (let i = 0; i < totalTables; i++) {
            if (!referencedIndices.has(i)) {
                missingIndices.push(i);
            }
        }

        // 3. Prune invalid indices (if table was deleted from Markdown)
        let newRoot = this._pruneInvalidIndices(root, totalTables);

        if (missingIndices.length > 0) {
            // 4. Add missing indices
            if (this._pendingNewTableTargetPaneId) {
                newRoot = this._addToSpecificPane(newRoot, this._pendingNewTableTargetPaneId, missingIndices);
                this._pendingNewTableTargetPaneId = null; // Reset after handling
            } else {
                newRoot = this._addToLastPane(newRoot, missingIndices);
            }
        }

        return newRoot;
    }

    private _traverse(node: LayoutNode, callback: (n: LayoutNode) => void) {
        callback(node);
        if (node.type === 'split') {
            node.children.forEach((c) => this._traverse(c, callback));
        }
    }

    private _pruneInvalidIndices(node: LayoutNode, totalTables: number): LayoutNode {
        if (node.type === 'pane') {
            const validTables = node.tables.filter((idx) => idx < totalTables);
            let activeIndex = node.activeTableIndex;
            if (activeIndex >= validTables.length) activeIndex = validTables.length > 0 ? validTables.length - 1 : 0;

            // If tables changed, return new object
            if (validTables.length !== node.tables.length || activeIndex !== node.activeTableIndex) {
                return { ...node, tables: validTables, activeTableIndex: activeIndex };
            }
            return node;
        } else {
            const newChildren = node.children.map((c) => this._pruneInvalidIndices(c, totalTables));
            return { ...node, children: newChildren as LayoutNode[] }; // simple map
        }
    }

    private _addToLastPane(root: LayoutNode, indicesToAdd: number[]): LayoutNode {
        // Find the last pane (DFS right-most)
        // Since we need to update the immutable tree, we need to trace the path or use a finder.
        // Easier: Use a recursive "add to last" that returns the updated node when it finds the target.

        // Helper to find ID of last pane
        let lastPaneId: string | null = null;
        this._traverse(root, (n) => {
            if (n.type === 'pane') lastPaneId = n.id;
        });

        if (!lastPaneId) return root; // Should not happen unless empty?

        return this._updateNode(root, lastPaneId, (node) => {
            return {
                ...node,
                tables: [...node.tables, ...indicesToAdd],
                // Keep active index same unless it was empty?
                activeTableIndex: node.tables.length === 0 ? 0 : node.activeTableIndex
            };
        })!;
    }

    private _addToSpecificPane(root: LayoutNode, targetPaneId: string, indicesToAdd: number[]): LayoutNode {
        const result = this._updateNode(root, targetPaneId, (node) => {
            const newTables = [...node.tables, ...indicesToAdd];
            // Set active index to the last added table (newly created one)
            return {
                ...node,
                tables: newTables,
                activeTableIndex: newTables.length - 1
            };
        });

        // Fallback to last pane if target not found
        return result || this._addToLastPane(root, indicesToAdd);
    }

    render() {
        if (!this._currentLayout) return html``;
        return html`
            <div @pane-action="${this._handlePaneAction}" style="width:100%;height:100%">
                ${this._renderNode(this._currentLayout)}
            </div>
        `;
    }

    private _renderNode(node: LayoutNode) {
        if (node.type === 'split') {
            return html`<split-view
                .node="${node}"
                .tables="${this.tables}"
                .sheetIndex="${this.sheetIndex}"
                .dateFormat="${this.dateFormat}"
                .workbook="${this.workbook}"
            ></split-view>`;
        } else {
            return html`<pane-view
                .node="${node}"
                .tables="${this.tables}"
                .sheetIndex="${this.sheetIndex}"
                .dateFormat="${this.dateFormat}"
                .workbook="${this.workbook}"
            ></pane-view>`;
        }
    }

    private _handlePaneAction(e: CustomEvent) {
        e.stopPropagation();
        const { type, paneId, index, targetPaneId, sourcePaneId, tableIndex, direction, placement, nodeId, newSizes } =
            e.detail;

        let newLayout = this._currentLayout;

        if (type === 'switch-tab') {
            newLayout = this._updateNode(this._currentLayout!, paneId, (node: LeafNode) => {
                return { ...node, activeTableIndex: index };
            });
        } else if (type === 'move-tab') {
            newLayout = this._moveTab(this._currentLayout!, sourcePaneId, targetPaneId, tableIndex, index);
        } else if (type === 'split-pane') {
            newLayout = this._splitPane(
                this._currentLayout!,
                sourcePaneId,
                targetPaneId,
                tableIndex,
                direction,
                placement
            );
        } else if (type === 'resize-split') {
            newLayout = this._resizeSplit(this._currentLayout!, nodeId, newSizes);
        } else if (type === 'add-table') {
            // Store the pane ID where the user clicked "+"
            this._pendingNewTableTargetPaneId = paneId;

            // Dispatch request to backend
            this.dispatchEvent(
                new CustomEvent('request-add-table', {
                    detail: {
                        sheetIndex: this.sheetIndex
                    },
                    bubbles: true,
                    composed: true
                })
            );
            // No layout change yet; wait for backend update -> reconcile
        } else if (type === 'rename-table') {
            this.dispatchEvent(
                new CustomEvent('request-rename-table', {
                    detail: {
                        sheetIndex: this.sheetIndex,
                        tableIndex: tableIndex,
                        newName: e.detail.newName
                    },
                    bubbles: true,
                    composed: true
                })
            );
        } else if (type === 'delete-table') {
            this.dispatchEvent(
                new CustomEvent('request-delete-table', {
                    detail: {
                        sheetIndex: this.sheetIndex,
                        tableIndex: tableIndex
                    },
                    bubbles: true,
                    composed: true
                })
            );
        } else if (type === 'delete-pane') {
            // Delete an empty pane from the layout
            newLayout = this._deletePaneFromLayout(this._currentLayout!, paneId);
        }

        if (newLayout && newLayout !== this._currentLayout) {
            this._currentLayout = newLayout;
            if (type === 'switch-tab') {
                // Dispatch deferred persistence - will be saved with next actual file edit
                this._dispatchDeferredPersistence();
            } else {
                this._dispatchPersistence();
            }
        }
    }

    /**
     * Dispatch deferred persistence event for non-undo operations like tab switching.
     * The update will be saved to file when the next actual edit occurs.
     */
    private _dispatchDeferredPersistence() {
        this.dispatchEvent(
            new CustomEvent('sheet-metadata-deferred', {
                detail: {
                    sheetIndex: this.sheetIndex,
                    metadata: { layout: this._currentLayout }
                },
                bubbles: true,
                composed: true
            })
        );
    }

    private _addTableToLayout(
        root: LayoutNode,
        targetPaneId: string,
        tableIndex: number,
        targetIndex?: number
    ): LayoutNode {
        return this._updateNode(root, targetPaneId, (node: LeafNode) => {
            if (node.tables.includes(tableIndex)) return node;

            const newTables = [...node.tables];
            if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= newTables.length) {
                newTables.splice(targetIndex, 0, tableIndex);
            } else {
                newTables.push(tableIndex);
            }

            return {
                ...node,
                tables: newTables,
                activeTableIndex: newTables.indexOf(tableIndex)
            };
        })!;
    }

    private _resizeSplit(root: LayoutNode, splitNodeId: string, newSizes: number[]): LayoutNode {
        if (root.type === 'split') {
            if (root.id === splitNodeId) {
                return { ...root, sizes: newSizes };
            }
            return {
                ...root,
                children: root.children.map((child) => this._resizeSplit(child, splitNodeId, newSizes))
            };
        }
        return root;
    }

    private _moveTab(
        root: LayoutNode,
        sourcePaneId: string,
        targetPaneId: string,
        tableIndex: number,
        targetIndex?: number
    ): LayoutNode | null {
        // 1. Remove from source
        const { layout: layoutAfterRemove, removedTable: _removedTable } = this._removeTableFromLayout(
            root,
            sourcePaneId,
            tableIndex
        );

        if (!layoutAfterRemove) return null; // Failed to remove

        // 2. Add to target at specific index
        return this._addTableToLayout(layoutAfterRemove, targetPaneId, tableIndex, targetIndex);
    }

    private _splitPane(
        root: LayoutNode,
        sourcePaneId: string,
        targetPaneId: string,
        tableIndex: number,
        direction: 'horizontal' | 'vertical',
        placement: 'before' | 'after'
    ): LayoutNode | null {
        // Guard: If source == target, ensure we are not removing the LAST table to split it contextually (which causes pane removal)
        if (sourcePaneId === targetPaneId) {
            // Find the pane to check table count
            // Simple traversal check or use existing helper?
            let paneHasMoreTables = false;
            this._updateNode(root, sourcePaneId, (node) => {
                if (node.tables.length > 1) paneHasMoreTables = true;
                return node;
            });

            if (!paneHasMoreTables) {
                // Determine implicit behavior:
                // If it's the only table, and we split it... we just move it?
                // Since it's already there, it's a no-op.
                return root;
            }
        }

        // 1. Remove from source
        const { layout: layoutAfterRemove, removedTable: _removedTable } = this._removeTableFromLayout(
            root,
            sourcePaneId,
            tableIndex
        );
        if (!layoutAfterRemove) return null;

        // 2. Create New Pane
        const newPane: LeafNode = {
            type: 'pane',
            id: this._generateId(),
            tables: [tableIndex],
            activeTableIndex: 0
        };

        // 3. Find target and replace with SplitNode
        // If target was removed (e.g. source==target and it became empty), this will return layoutAfterRemove unmodified,
        // which means the table is LOST (removed but not re-added).
        // The guard above prevents this for the single-tab case.
        // For multi-tab case where source==target, the pane stays (with remaining tabs), so target IS found.
        return this._replaceNodeWithSplit(layoutAfterRemove, targetPaneId, newPane, direction, placement);
    }

    private _generateId(): string {
        return nanoid();
    }

    private _removeTableFromLayout(
        root: LayoutNode,
        paneId: string,
        tableIndex: number
    ): { layout: LayoutNode | null; removedTable: number | null } {
        // Recursive removal
        // Returns modified layout and whether table was found/removed.

        if (root.type === 'pane') {
            if (root.id === paneId) {
                if (root.tables.includes(tableIndex)) {
                    const newTables = root.tables.filter((t) => t !== tableIndex);
                    // If pane becomes empty, we should ideally signal to parent to remove this pane.
                    // But here we return the modified node.
                    // We need a separate pass or structured return to cleanup empty panes?
                    // Let's return the node with empty tables, and let a cleanup pass handle it?
                    // Or return 'null' to signal removal?

                    if (newTables.length === 0) {
                        return { layout: null, removedTable: tableIndex }; // Signal deletion
                    }

                    // Adjust active index
                    let newActive = root.activeTableIndex;
                    if (newActive >= newTables.length) newActive = newTables.length - 1;
                    if (newActive < 0) newActive = 0;

                    return {
                        layout: { ...root, tables: newTables, activeTableIndex: newActive },
                        removedTable: tableIndex
                    };
                }
            }
            return { layout: root, removedTable: null };
        } else {
            // SplitNode
            let removedTableVal: number | null = null;

            const newChildren: LayoutNode[] = [];
            for (const child of root.children) {
                const res = this._removeTableFromLayout(child, paneId, tableIndex);
                if (res.removedTable !== null) {
                    removedTableVal = res.removedTable;
                }

                if (res.layout) {
                    newChildren.push(res.layout);
                }
                // If res.layout is null, it means the child pane became empty and was removed.
            }

            if (newChildren.length === 0) return { layout: null, removedTable: removedTableVal };
            if (newChildren.length === 1) {
                // Collapse split?
                // Yes, if only one child remains, return that child (lift up).
                return { layout: newChildren[0], removedTable: removedTableVal };
            }

            return {
                layout: { ...root, children: newChildren },
                removedTable: removedTableVal
            };
        }
    }

    /**
     * Delete a pane by ID from the layout.
     * Used to remove empty panes (panes with no tables).
     */
    private _deletePaneFromLayout(root: LayoutNode, paneId: string): LayoutNode | null {
        if (root.type === 'pane') {
            // If this is the pane to delete, return null
            if (root.id === paneId) {
                return null;
            }
            return root;
        } else {
            // SplitNode: process children
            const newChildren: LayoutNode[] = [];
            for (const child of root.children) {
                const result = this._deletePaneFromLayout(child, paneId);
                if (result !== null) {
                    newChildren.push(result);
                }
            }

            // If no children left, remove this split node
            if (newChildren.length === 0) {
                return null;
            }

            // If only one child remains, collapse (lift up)
            if (newChildren.length === 1) {
                return newChildren[0];
            }

            return { ...root, children: newChildren };
        }
    }

    private _replaceNodeWithSplit(
        root: LayoutNode,
        targetId: string,
        newPane: LeafNode,
        direction: 'horizontal' | 'vertical',
        placement: 'before' | 'after'
    ): LayoutNode {
        if (root.type === 'pane') {
            if (root.id === targetId) {
                // Replace this pane with a SplitNode containing [New, Old] or [Old, New]
                const split: SplitNode = {
                    type: 'split',
                    id: this._generateId(),
                    direction: direction,
                    sizes: [50, 50],
                    children: placement === 'before' ? [newPane, root] : [root, newPane]
                };
                return split;
            }
            return root;
        } else {
            return {
                ...root,
                children: root.children.map((c) =>
                    this._replaceNodeWithSplit(c, targetId, newPane, direction, placement)
                )
            };
        }
    }

    private _updateNode(root: LayoutNode, targetId: string, updateFn: (n: LeafNode) => LeafNode): LayoutNode | null {
        if (root.type === 'pane') {
            if (root.id === targetId) {
                return updateFn(root);
            }
            return root;
        } else {
            const newChildren = root.children.map((child) => this._updateNode(child, targetId, updateFn));
            // Optimization: if no children changed, return root? (Ref equality)
            // For now, mapping always creates new array, so simplistic approach.
            // But we need to check if ANY child actually changed to handle null returns?
            // My helper returns LayoutNode, not null on no-change.
            // If I want to be efficient, I check identity.

            return {
                ...root,
                children: newChildren as LayoutNode[]
            };
        }
    }

    private _dispatchPersistence() {
        this.dispatchEvent(
            new CustomEvent('sheet-metadata-update', {
                detail: {
                    sheetIndex: this.sheetIndex,
                    metadata: { layout: this._currentLayout }
                },
                bubbles: true,
                composed: true
            })
        );
    }
}
