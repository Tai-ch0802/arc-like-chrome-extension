import * as state from '../stateManager.js';

/**
 * Flattens the bookmark tree into a list of visible items.
 * 
 * @param {Array} nodes - The list of bookmark nodes to process.
 * @param {Function} isFolderExpanded - Function that returns true if a folder is expanded.
 * @param {Array} filterKeywords - Array of keywords for filtering. If empty, normal tree traversal is used.
 * @param {number} depth - Current indentation depth.
 * @returns {Array} - Array of flattened items: { node, depth, isExpanded, hasVisibleChildren }
 */
export function flattenBookmarkTree(nodes, isFolderExpanded, filterKeywords = [], depth = 0) {
    let flatList = [];

    for (const node of nodes) {
        // Determine visibility based on search or expansion
        let isVisible = true;
        let hasVisibleChildren = false;
        let shouldExpand = false;

        // Search Mode Logic
        if (filterKeywords.length > 0) {
            const selfMatches = matchesAnyKeyword(node, filterKeywords);

            // Check children for matches (recursive check)
            let visibleChildren = [];
            if (node.children && node.children.length > 0) {
                visibleChildren = flattenBookmarkTree(node.children, isFolderExpanded, filterKeywords, depth + 1);
            }

            hasVisibleChildren = visibleChildren.length > 0;

            // Node is visible if it matches OR has visible children
            isVisible = selfMatches || hasVisibleChildren;

            // In search mode, expand if there are visible children
            shouldExpand = hasVisibleChildren;

            if (isVisible) {
                flatList.push({
                    node: node,
                    depth: depth,
                    isExpanded: shouldExpand,
                    hasVisibleChildren: hasVisibleChildren
                });

                if (shouldExpand) {
                    flatList = flatList.concat(visibleChildren);
                }
            }
        }
        // Normal Mode Logic
        else {
            flatList.push({
                node: node,
                depth: depth,
                isExpanded: isFolderExpanded(node.id),
                hasVisibleChildren: node.children && node.children.length > 0
            });

            if (node.children && isFolderExpanded(node.id)) {
                const children = flattenBookmarkTree(node.children, isFolderExpanded, filterKeywords, depth + 1);
                flatList = flatList.concat(children);
            }
        }
    }

    return flatList;
}

/**
 * Checks if a node matches any of the keywords.
 * 
 * @param {Object} node - The bookmark node.
 * @param {Array} keywords - Array of keywords.
 * @returns {boolean} - True if matches.
 */
function matchesAnyKeyword(node, keywords) {
    const title = node.title || '';
    let url = node.url || '';
    let domain = '';

    if (url) {
        try {
            domain = new URL(url).hostname;
        } catch (e) {
            const match = url.match(/^(?:https?:\/\/)?([^\/:?#]+)/);
            domain = match ? match[1] : '';
        }
    }

    const lowerTitle = title.toLowerCase();
    const lowerDomain = domain.toLowerCase();

    return keywords.some(keyword => {
        const k = keyword.toLowerCase();
        return lowerTitle.includes(k) || lowerDomain.includes(k);
    });
}
