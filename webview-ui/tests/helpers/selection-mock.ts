/**
 * Selection/Range API Mock for JSDOM Testing
 *
 * JSDOM does not fully implement the Selection and Range APIs needed for
 * testing contenteditable elements. This module provides mock implementations
 * that can simulate browser behavior for text selection and manipulation.
 *
 * Usage:
 * 1. Call setupSelectionMock() in beforeEach to enable mocking
 * 2. Use createMockSelection() to set up specific selection scenarios
 * 3. Call cleanupSelectionMock() in afterEach to restore original behavior
 *
 * Key Features:
 * - Simulates text selection across multiple nodes (including <br> elements)
 * - Implements deleteContents() for testing Delete/Backspace behavior
 * - Tracks selection state for verification in tests
 */

import { vi, SpyInstance } from 'vitest';

/**
 * Mock Range implementation that works with JSDOM
 */
export class MockRange implements Range {
    startContainer: Node;
    startOffset: number;
    endContainer: Node;
    endOffset: number;
    collapsed: boolean = true;
    commonAncestorContainer: Node;

    constructor(container: Node = document.body) {
        this.startContainer = container;
        this.startOffset = 0;
        this.endContainer = container;
        this.endOffset = 0;
        this.commonAncestorContainer = container;
    }

    setStart(node: Node, offset: number): void {
        this.startContainer = node;
        this.startOffset = offset;
        this._updateCollapsed();
    }

    setEnd(node: Node, offset: number): void {
        this.endContainer = node;
        this.endOffset = offset;
        this._updateCollapsed();
    }

    setStartAfter(node: Node): void {
        if (node.parentNode) {
            const index = Array.from(node.parentNode.childNodes).indexOf(node as ChildNode);
            this.setStart(node.parentNode, index + 1);
        }
    }

    setStartBefore(node: Node): void {
        if (node.parentNode) {
            const index = Array.from(node.parentNode.childNodes).indexOf(node as ChildNode);
            this.setStart(node.parentNode, index);
        }
    }

    setEndAfter(node: Node): void {
        if (node.parentNode) {
            const index = Array.from(node.parentNode.childNodes).indexOf(node as ChildNode);
            this.setEnd(node.parentNode, index + 1);
        }
    }

    setEndBefore(node: Node): void {
        if (node.parentNode) {
            const index = Array.from(node.parentNode.childNodes).indexOf(node as ChildNode);
            this.setEnd(node.parentNode, index);
        }
    }

    collapse(toStart?: boolean): void {
        if (toStart) {
            this.endContainer = this.startContainer;
            this.endOffset = this.startOffset;
        } else {
            this.startContainer = this.endContainer;
            this.startOffset = this.endOffset;
        }
        this.collapsed = true;
    }

    selectNode(node: Node): void {
        if (node.parentNode) {
            const index = Array.from(node.parentNode.childNodes).indexOf(node as ChildNode);
            this.setStart(node.parentNode, index);
            this.setEnd(node.parentNode, index + 1);
        }
    }

    selectNodeContents(node: Node): void {
        this.startContainer = node;
        this.startOffset = 0;
        this.endContainer = node;
        this.endOffset = node.childNodes.length;
        this._updateCollapsed();
    }

    /**
     * Delete the contents within the range - key method for testing Delete behavior
     */
    deleteContents(): void {
        if (this.collapsed) return;

        // Handle same container case
        if (this.startContainer === this.endContainer) {
            if (this.startContainer.nodeType === Node.TEXT_NODE) {
                const textNode = this.startContainer as Text;
                const text = textNode.textContent || '';
                textNode.textContent = text.slice(0, this.startOffset) + text.slice(this.endOffset);
            } else {
                // Element node - remove child nodes in range
                const children = Array.from(this.startContainer.childNodes);
                for (let i = this.endOffset - 1; i >= this.startOffset; i--) {
                    if (children[i]) {
                        this.startContainer.removeChild(children[i]);
                    }
                }
            }
        } else {
            // Cross-container deletion
            this._deleteAcrossContainers();
        }

        // Collapse range after deletion
        this.collapse(true);
    }

    /**
     * Handle deletion across different containers (e.g., text nodes separated by <br>)
     */
    private _deleteAcrossContainers(): void {
        // Find common ancestor and delete all nodes between start and end
        const commonAncestor = this._findCommonAncestor(this.startContainer, this.endContainer);
        if (!commonAncestor) return;

        // Get all nodes between start and end
        const walker = document.createTreeWalker(commonAncestor, NodeFilter.SHOW_ALL);
        const nodesToRemove: Node[] = [];
        let inRange = false;
        let currentNode: Node | null = walker.currentNode;

        while (currentNode) {
            if (currentNode === this.startContainer) {
                inRange = true;
                // Truncate start text node
                if (currentNode.nodeType === Node.TEXT_NODE) {
                    (currentNode as Text).textContent = (currentNode.textContent || '').slice(0, this.startOffset);
                }
            } else if (currentNode === this.endContainer) {
                // Truncate end text node
                if (currentNode.nodeType === Node.TEXT_NODE) {
                    (currentNode as Text).textContent = (currentNode.textContent || '').slice(this.endOffset);
                }
                break;
            } else if (inRange) {
                nodesToRemove.push(currentNode);
            }

            currentNode = walker.nextNode();
        }

        // Remove nodes in reverse order to avoid index issues
        for (const node of nodesToRemove.reverse()) {
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
    }

    private _findCommonAncestor(node1: Node, node2: Node): Node | null {
        const ancestors = new Set<Node>();
        let current: Node | null = node1;
        while (current) {
            ancestors.add(current);
            current = current.parentNode;
        }

        current = node2;
        while (current) {
            if (ancestors.has(current)) {
                return current;
            }
            current = current.parentNode;
        }
        return null;
    }

    private _updateCollapsed(): void {
        this.collapsed = this.startContainer === this.endContainer && this.startOffset === this.endOffset;
    }

    insertNode(node: Node): void {
        if (this.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = this.startContainer as Text;
            const afterText = textNode.splitText(this.startOffset);
            textNode.parentNode?.insertBefore(node, afterText);
        } else {
            const refChild = this.startContainer.childNodes[this.startOffset] || null;
            this.startContainer.insertBefore(node, refChild);
        }
    }

    cloneContents(): DocumentFragment {
        const fragment = document.createDocumentFragment();
        // Simplified implementation for testing
        return fragment;
    }

    extractContents(): DocumentFragment {
        const fragment = this.cloneContents();
        this.deleteContents();
        return fragment;
    }

    cloneRange(): Range {
        const clone = new MockRange();
        clone.setStart(this.startContainer, this.startOffset);
        clone.setEnd(this.endContainer, this.endOffset);
        return clone;
    }

    compareBoundaryPoints(_how: number, _sourceRange: Range): number {
        return 0; // Simplified
    }

    comparePoint(_node: Node, _offset: number): number {
        return 0; // Simplified
    }

    createContextualFragment(fragment: string): DocumentFragment {
        const template = document.createElement('template');
        template.innerHTML = fragment;
        return template.content;
    }

    detach(): void {
        // No-op in modern browsers
    }

    getBoundingClientRect(): DOMRect {
        return new DOMRect(0, 0, 0, 0);
    }

    getClientRects(): DOMRectList {
        return { length: 0, item: () => null } as unknown as DOMRectList;
    }

    intersectsNode(_node: Node): boolean {
        return false; // Simplified
    }

    isPointInRange(_node: Node, _offset: number): boolean {
        return false; // Simplified
    }

    surroundContents(_newParent: Node): void {
        // Simplified
    }

    toString(): string {
        if (this.startContainer.nodeType === Node.TEXT_NODE) {
            return (this.startContainer.textContent || '').slice(this.startOffset, this.endOffset);
        }
        return '';
    }

    // Required by Range interface
    readonly END_TO_END = 2;
    readonly END_TO_START = 3;
    readonly START_TO_END = 1;
    readonly START_TO_START = 0;
}

/**
 * Mock Selection implementation
 */
export class MockSelection implements Selection {
    anchorNode: Node | null = null;
    anchorOffset: number = 0;
    focusNode: Node | null = null;
    focusOffset: number = 0;
    isCollapsed: boolean = true;
    rangeCount: number = 0;
    type: string = 'None';

    private _ranges: Range[] = [];

    getRangeAt(index: number): Range {
        if (index < 0 || index >= this._ranges.length) {
            throw new Error('Index out of range');
        }
        return this._ranges[index];
    }

    addRange(range: Range): void {
        this._ranges.push(range);
        this.rangeCount = this._ranges.length;
        this._updateFromRange(range);
        this.type = range.collapsed ? 'Caret' : 'Range';
    }

    removeRange(_range: Range): void {
        this._ranges = this._ranges.filter((r) => r !== _range);
        this.rangeCount = this._ranges.length;
        if (this.rangeCount === 0) {
            this._clear();
        }
    }

    removeAllRanges(): void {
        this._ranges = [];
        this.rangeCount = 0;
        this._clear();
    }

    empty(): void {
        this.removeAllRanges();
    }

    collapse(node: Node | null, offset?: number): void {
        if (!node) return;
        const range = new MockRange();
        range.setStart(node, offset || 0);
        range.collapse(true);
        this.removeAllRanges();
        this.addRange(range);
    }

    collapseToStart(): void {
        if (this._ranges.length > 0) {
            const range = this._ranges[0];
            this.collapse(range.startContainer, range.startOffset);
        }
    }

    collapseToEnd(): void {
        if (this._ranges.length > 0) {
            const range = this._ranges[0];
            this.collapse(range.endContainer, range.endOffset);
        }
    }

    containsNode(_node: Node, _allowPartialContainment?: boolean): boolean {
        return false; // Simplified
    }

    deleteFromDocument(): void {
        for (const range of this._ranges) {
            range.deleteContents();
        }
        this.collapseToStart();
    }

    extend(node: Node, offset?: number): void {
        if (this._ranges.length > 0) {
            const range = this._ranges[0];
            range.setEnd(node, offset || 0);
            this._updateFromRange(range);
        }
    }

    getComposedRanges(): StaticRange[] {
        return [];
    }

    modify(_alter?: string, _direction?: string, _granularity?: string): void {
        // Simplified
    }

    selectAllChildren(node: Node): void {
        const range = new MockRange();
        range.selectNodeContents(node);
        this.removeAllRanges();
        this.addRange(range);
    }

    setBaseAndExtent(anchorNode: Node, anchorOffset: number, focusNode: Node, focusOffset: number): void {
        const range = new MockRange();
        range.setStart(anchorNode, anchorOffset);
        range.setEnd(focusNode, focusOffset);
        this.removeAllRanges();
        this.addRange(range);
    }

    setPosition(node: Node | null, offset?: number): void {
        this.collapse(node, offset);
    }

    toString(): string {
        return this._ranges.map((r) => r.toString()).join('');
    }

    private _updateFromRange(range: Range): void {
        this.anchorNode = range.startContainer;
        this.anchorOffset = range.startOffset;
        this.focusNode = range.endContainer;
        this.focusOffset = range.endOffset;
        this.isCollapsed = range.collapsed;
    }

    private _clear(): void {
        this.anchorNode = null;
        this.anchorOffset = 0;
        this.focusNode = null;
        this.focusOffset = 0;
        this.isCollapsed = true;
        this.type = 'None';
    }
}

// Store original functions for cleanup
let originalGetSelection: typeof window.getSelection | null = null;
let originalCreateRange: typeof document.createRange | null = null;
let getSelectionSpy: SpyInstance | null = null;
let createRangeSpy: SpyInstance | null = null;

// Global mock selection instance
let mockSelection: MockSelection | null = null;

/**
 * Set up the selection mock - call in beforeEach
 */
export function setupSelectionMock(): MockSelection {
    mockSelection = new MockSelection();

    // Store originals
    originalGetSelection = window.getSelection;
    originalCreateRange = document.createRange;

    // Mock getSelection
    getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as unknown as Selection);

    // Mock createRange
    createRangeSpy = vi.spyOn(document, 'createRange').mockImplementation(() => new MockRange() as unknown as Range);

    return mockSelection;
}

/**
 * Clean up the selection mock - call in afterEach
 */
export function cleanupSelectionMock(): void {
    if (getSelectionSpy) {
        getSelectionSpy.mockRestore();
        getSelectionSpy = null;
    }
    if (createRangeSpy) {
        createRangeSpy.mockRestore();
        createRangeSpy = null;
    }
    mockSelection = null;
}

/**
 * Get the current mock selection instance
 */
export function getMockSelection(): MockSelection | null {
    return mockSelection;
}

/**
 * Helper to create a selection within an element
 * Useful for testing Delete/Backspace behavior
 */
export function selectTextInElement(
    element: HTMLElement,
    startOffset: number,
    endOffset: number
): { range: MockRange; selection: MockSelection } {
    if (!mockSelection) {
        throw new Error('Selection mock not set up. Call setupSelectionMock() first.');
    }

    const range = new MockRange();

    // Find text nodes and set range
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
        textNodes.push(node as Text);
    }

    if (textNodes.length === 0) {
        // No text nodes, select element contents
        range.selectNodeContents(element);
    } else {
        // Find the correct text node for start and end
        let currentOffset = 0;
        let startNode: Text | null = null;
        let startNodeOffset = 0;
        let endNode: Text | null = null;
        let endNodeOffset = 0;

        for (const textNode of textNodes) {
            const length = (textNode.textContent || '').length;

            if (!startNode && currentOffset + length >= startOffset) {
                startNode = textNode;
                startNodeOffset = startOffset - currentOffset;
            }

            if (!endNode && currentOffset + length >= endOffset) {
                endNode = textNode;
                endNodeOffset = endOffset - currentOffset;
                break;
            }

            currentOffset += length;
        }

        if (startNode && endNode) {
            range.setStart(startNode, startNodeOffset);
            range.setEnd(endNode, endNodeOffset);
        } else {
            range.selectNodeContents(element);
        }
    }

    mockSelection.removeAllRanges();
    mockSelection.addRange(range);

    return { range, selection: mockSelection };
}

/**
 * Helper to select all content in an element (simulates Ctrl+A)
 */
export function selectAllInElement(element: HTMLElement): { range: MockRange; selection: MockSelection } {
    if (!mockSelection) {
        throw new Error('Selection mock not set up. Call setupSelectionMock() first.');
    }

    const range = new MockRange();
    range.selectNodeContents(element);
    mockSelection.removeAllRanges();
    mockSelection.addRange(range);

    return { range, selection: mockSelection };
}

/**
 * Helper to set caret position (collapsed selection)
 */
export function setCaretPosition(node: Node, offset: number): { range: MockRange; selection: MockSelection } {
    if (!mockSelection) {
        throw new Error('Selection mock not set up. Call setupSelectionMock() first.');
    }

    const range = new MockRange();
    range.setStart(node, offset);
    range.collapse(true);
    mockSelection.removeAllRanges();
    mockSelection.addRange(range);

    return { range, selection: mockSelection };
}
