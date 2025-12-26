export class SimpleDateFormatter {
    /**
     * Parse a date string according to the given format.
     * Returns a Date object or null if parsing fails.
     *
     * Supported format parts: YYYY, MM, DD
     * Delimiters can be any character.
     */
    static parseDate(value: string, format: string): Date | null {
        if (!value || !format) return null;

        const parts = format.split(/(YYYY|MM|DD)/);
        let regexStr = '^';
        const groupIndices: { [key: string]: number } = {};
        let groupIndex = 1;

        for (const part of parts) {
            if (part === 'YYYY') {
                regexStr += '(\\d{4})';
                groupIndices['year'] = groupIndex++;
            } else if (part === 'MM') {
                regexStr += '(\\d{1,2})';
                groupIndices['month'] = groupIndex++;
            } else if (part === 'DD') {
                regexStr += '(\\d{1,2})';
                groupIndices['day'] = groupIndex++;
            } else if (part) {
                // Escape special regex characters
                regexStr += part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }
        }
        regexStr += '$';

        const regex = new RegExp(regexStr);
        const match = value.match(regex);

        if (!match) return null;

        const year = parseInt(match[groupIndices['year']], 10);
        const month = parseInt(match[groupIndices['month']], 10) - 1; // 0-indexed
        const day = parseInt(match[groupIndices['day']], 10);

        const date = new Date(year, month, day);

        // Validate date validity (e.g. 2021-02-31 is invalid, it rolls over)
        if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
            return null;
        }

        return date;
    }

    /**
     * Format a Date object into a string according to the given format.
     */
    static formatDate(date: Date | null, format: string): string {
        if (!date || isNaN(date.getTime()) || !format) return '';

        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        const yearStr = year.toString();
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');

        return format.replace('YYYY', yearStr).replace('MM', monthStr).replace('DD', dayStr);
    }

    private static _splitIntoParts(text: string): string[] {
        // Deprecated helper, but kept if needed for other logic (not used in new parseDate)
        // We can remove it or fix it if we want to keep API shape, but private so remove.
        return [];
    }
}
