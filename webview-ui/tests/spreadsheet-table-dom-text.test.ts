import { describe, it, expect } from 'vitest';
import { getDOMText } from '../utils/spreadsheet-helpers';

// We test the utility function directly now, simplified.

describe('SpreadsheetTable getDOMText Logic', () => {
    it('should extract text with newlines from BR tags', () => {
        const div = document.createElement('div');
        div.innerHTML = 'A<br>B';

        const result = getDOMText(div);
        expect(result).toBe('A\nB');
    });

    it('should reflect deletion of BR tag', () => {
        const div = document.createElement('div');
        div.innerHTML = 'AB'; // Simulate state after backspace

        const result = getDOMText(div);
        expect(result).toBe('AB');
        expect(result).not.toContain('\n');
    });

    it('should preserve newlines in text nodes', () => {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode('A\nB'));

        const result = getDOMText(div);
        expect(result).toBe('A\nB');
    });

    it('should handle complex mixed content', () => {
        const div = document.createElement('div');
        div.innerHTML = 'Line1<br>Line2\n<br>Line3';

        // innerText might normalize or ignore \n in text nodes depending on CSS.
        // Our extractor should be explicit.
        // Line1 (text) + \n (br) + Line2\n (text) + \n (br) + Line3 (text)
        // -> Line1\nLine2\n\nLine3

        const result = getDOMText(div);
        expect(result).toBe('Line1\nLine2\n\nLine3');
    });

    it('should ignore non-text non-br nodes if they have no text content', () => {
        const div = document.createElement('div');
        // e.g. a resize handle or marker
        const span = document.createElement('span');
        span.className = 'marker';
        div.appendChild(document.createTextNode('A'));
        div.appendChild(span);
        div.appendChild(document.createTextNode('B'));

        const result = getDOMText(div);
        expect(result).toBe('AB');
    });
});
