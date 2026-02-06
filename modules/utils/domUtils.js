/**
 * Reconciles the children of a container to match a new list of elements.
 * Moves existing elements to the correct position, inserts new ones, and removes extra ones.
 * This minimizes DOM reflows compared to clearing and re-appending.
 *
 * @param {HTMLElement} container - The container element.
 * @param {HTMLElement[]} newChildren - The array of elements that should be in the container.
 * @example
 * // Initial render - uses DocumentFragment for batch insertion
 * const items = [createElement('a'), createElement('b'), createElement('c')];
 * reconcileDOM(container, items);
 *
 * // Update render - moves/inserts only changed elements
 * const updatedItems = [createElement('b'), createElement('a'), createElement('d')];
 * reconcileDOM(container, updatedItems); // 'b' moves to front, 'c' removed, 'd' added
 */
export function reconcileDOM(container, newChildren) {
    // Optimization: If container is empty, use DocumentFragment for batch insertion
    // This significantly improves performance for initial renders
    if (container.children.length === 0 && newChildren.length > 0) {
        const fragment = document.createDocumentFragment();
        for (const child of newChildren) {
            fragment.appendChild(child);
        }
        container.appendChild(fragment);
        return;
    }

    // Iterate through the desired children
    for (let i = 0; i < newChildren.length; i++) {
        const newChild = newChildren[i];
        const currentChild = container.children[i];

        if (currentChild !== newChild) {
            // Mismatch detected.
            // Insert newChild at this position.
            // If newChild is already in the DOM (at a later index), insertBefore moves it.
            // If newChild is not in DOM, it inserts it.
            // We use insertBefore. If currentChild is undefined (end of list), it appends.
            container.insertBefore(newChild, currentChild || null);
        }
    }

    // Remove any remaining children in the container that are not in the new list
    while (container.children.length > newChildren.length) {
        container.removeChild(container.lastChild);
    }
}
