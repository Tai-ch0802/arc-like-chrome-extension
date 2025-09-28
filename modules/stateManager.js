// --- UI State Management Module ---

const expandedBookmarkFolders = new Set();

export const isFolderExpanded = (folderId) => expandedBookmarkFolders.has(folderId);

export const addExpandedFolder = (folderId) => expandedBookmarkFolders.add(folderId);

export const removeExpandedFolder = (folderId) => expandedBookmarkFolders.delete(folderId);

export const clearExpandedFolders = () => expandedBookmarkFolders.clear();
