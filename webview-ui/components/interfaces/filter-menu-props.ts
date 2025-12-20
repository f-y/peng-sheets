/**
 * Filter Menu Props Interface
 * 
 * Defines the contract between parent components (Container/View) and FilterMenu.
 * This interface ensures type safety and documents the expected properties.
 */

export interface FilterMenuProps {
    /** X coordinate (left) for positioning the menu */
    x: number;
    /** Y coordinate (top) for positioning the menu */
    y: number;
    /** Unique values to display in the filter list */
    values: string[];
    /** Values that are currently hidden (filtered out) */
    hiddenValues: string[];
    /** Column name (for display/events) */
    columnName?: string;
}

/**
 * Filter Menu State passed from Container to View
 */
export interface FilterMenuState {
    x: number;
    y: number;
    col: number;
    values: string[];
    selectedValues: Set<string>;  // NOTE: This doesn't match FilterMenu's hiddenValues!
}
