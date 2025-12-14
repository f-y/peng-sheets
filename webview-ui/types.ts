import { TableJSON } from "./components/spreadsheet-table";

export type LayoutNode = SplitNode | LeafNode;

export interface SplitNode {
    type: 'split';
    id: string; // Unique ID
    direction: 'horizontal' | 'vertical';
    sizes: number[]; // Percentage of available space, e.g. [50, 50]
    children: LayoutNode[];
}

export interface LeafNode {
    type: 'pane';
    id: string; // Unique ID for finding the pane
    tables: number[]; // Array of Table Indices belonging to this pane
    activeTableIndex: number; // The currently selected table index in this pane (relative to the global table list or pane list?)
    // Note: If 'tables' stores GLOBAL table indices, then activeTableIndex should probably be one of those indices.
    // Let's store the index in the `tables` array for safety, i.e., 0 means tables[0].
    // Actually, 'activeTableIndex' in LeafNode usually refers to the index within the 'tables' array of that pane. 
    // e.g. activeTabIndex=0 means the first tab in this pane is active.
}

export interface SheetMetadata {
    layout: LayoutNode;
}

export interface TabData {
    id: string; // "sheet-X"
    type: 'sheet' | 'onboarding' | 'add-sheet';
    name: string;
    description?: string;
    sheetIndex?: number;
    data?: {
        tables: TableJSON[];
    };
    metadata?: SheetMetadata;
}
