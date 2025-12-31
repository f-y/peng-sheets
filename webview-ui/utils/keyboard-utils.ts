/**
 * Keyboard utility functions for handling IME-aware key events.
 */

/**
 * Check if the keyboard event is during IME composition.
 *
 * Safari has a known bug where isComposing returns false during IME input.
 * As a workaround, we also check for keyCode === 229 which indicates
 * an IME is processing input.
 *
 * Note: keyCode is deprecated but is the most reliable cross-browser
 * method for IME detection.
 *
 * @param e - The keyboard event
 * @returns true if IME is currently composing
 */
export function isIMEComposing(e: KeyboardEvent): boolean {
    return e.isComposing || e.keyCode === 229;
}

/**
 * Check if the Enter key was pressed as a real action (not IME composition).
 *
 * On Mac with Japanese/Chinese/Korean IME, pressing Enter to confirm
 * character conversion should NOT trigger form submission or cell commit.
 *
 * @param e - The keyboard event
 * @returns true if this is a real Enter key press (not IME composition)
 */
export function isRealEnterKey(e: KeyboardEvent): boolean {
    return e.key === 'Enter' && !isIMEComposing(e);
}
