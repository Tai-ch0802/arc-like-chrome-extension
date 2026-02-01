/**
 * @fileoverview Common utility functions for function manipulation.
 * @module functionUtils
 */

/**
 * Creates a debounced version of a function that delays execution
 * until after a specified wait time has elapsed since the last call.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @returns {Function} The debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
