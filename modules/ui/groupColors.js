/**
 * Group Colors Module
 * Centralized color constants and utilities for Tab Group rendering.
 */

/**
 * Chrome Tab Group color palette.
 * Maps Chrome's color names to their corresponding HEX values.
 * @type {Object.<string, string>}
 */
export const GROUP_COLORS = {
    grey: '#5f6368',
    blue: '#8ab4f8',
    red: '#f28b82',
    yellow: '#fdd663',
    green: '#81c995',
    pink: '#ff8bcb',
    purple: '#c58af9',
    cyan: '#78d9ec',
    orange: '#ffab70'
};

/**
 * Converts a HEX color to RGBA format.
 * @param {string} hex - HEX color code (e.g., '#8ab4f8')
 * @param {number} alpha - Alpha value between 0 and 1
 * @returns {string} RGBA color string
 */
export function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
