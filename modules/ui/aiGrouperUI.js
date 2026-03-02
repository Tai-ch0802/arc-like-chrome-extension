import * as api from '../apiManager.js';
import * as aiManager from '../aiManager.js';
import * as state from '../stateManager.js';

let toastTimeoutId = null;

export function initAiGrouper() {
    const aiGroupBtn = document.getElementById('ai-group-btn');
    const undoBtn = document.getElementById('toast-undo-btn');
    const closeBtn = document.getElementById('toast-close-btn');

    if (aiGroupBtn) {
        aiGroupBtn.addEventListener('click', handleGroupAction);

        // Apply initial visibility state
        if (!state.isAiGroupingVisible()) {
            aiGroupBtn.style.display = 'none';
        }

        // Listen for visibility toggle from settings
        document.addEventListener('aiGroupingVisibilityChanged', (e) => {
            if (e.detail.visible) {
                aiGroupBtn.style.display = '';
            } else {
                aiGroupBtn.style.display = 'none';
            }
        });
    }
    if (undoBtn) {
        undoBtn.addEventListener('click', handleUndoAction);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', hideToast);
    }
}

async function handleGroupAction() {
    const aiGroupBtn = document.getElementById('ai-group-btn');
    const progressEl = document.getElementById('ai-download-progress');
    const fillEl = progressEl?.querySelector('.ai-progress__fill');
    if (!aiGroupBtn || aiGroupBtn.classList.contains('loading')) return;

    /** Hides and resets the progress bar, restores button text */
    const originalBtnText = aiGroupBtn.textContent;
    function resetProgress() {
        if (progressEl) {
            progressEl.hidden = true;
            progressEl.classList.remove('shimmer');
            if (fillEl) fillEl.style.width = '0%';
        }
        aiGroupBtn.textContent = originalBtnText;
    }

    try {
        // Step 1: Check detailed availability status
        const availability = await aiManager.checkModelAvailability();
        console.info('[AI] Model availability:', availability);
        if (availability === 'unavailable') {
            showToast(api.getMessage('aiModelNotReady'));
            return;
        }

        const allTabs = await api.getTabsInCurrentWindow();

        // Unclassified tabs are those not in a group
        const unclassifiedTabs = allTabs.filter(t => t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE);

        if (unclassifiedTabs.length < 4) {
            showToast(api.getMessage('tooFewTabsToGroup'));
            return;
        }

        // Apply loading state
        aiGroupBtn.classList.add('loading');
        aiGroupBtn.disabled = true;
        hideToast(); // Hide any previous toast

        // Show download progress if model needs to be downloaded
        const needsDownload = availability !== 'available';
        console.info('[AI] Needs download:', needsDownload);
        if (needsDownload) {
            // Update button text to clearly inform the user
            aiGroupBtn.textContent = '⏳ Downloading...';
            if (progressEl) {
                progressEl.hidden = false;
                if (availability === 'downloading') {
                    // Already downloading in background — show shimmer
                    progressEl.classList.add('shimmer');
                } else {
                    // 'downloadable' — show 0% fill and wait for events
                    progressEl.classList.remove('shimmer');
                    if (fillEl) fillEl.style.width = '0%';
                }
            }
        }

        // Step 2: Call AI model with download progress callback
        const mappingResults = await aiManager.generateGroups(unclassifiedTabs, {
            onProgress(loaded) {
                console.info('[AI] Download progress:', Math.round(loaded * 100) + '%');
                if (loaded >= 1) {
                    // Download complete — model is extracting/loading into memory
                    aiGroupBtn.textContent = '⏳ Loading...';
                    if (progressEl) progressEl.classList.add('shimmer');
                } else {
                    aiGroupBtn.textContent = `⏳ ${Math.round(loaded * 100)}%`;
                    if (progressEl) {
                        progressEl.classList.remove('shimmer');
                        if (fillEl) fillEl.style.width = `${Math.round(loaded * 100)}%`;
                    }
                }
            }
        });

        // Hide progress after session is created
        resetProgress();

        // Map results to actual valid tab IDs again (just in case they closed them)
        const validUnclassifiedTabIds = new Set((await api.getTabsInCurrentWindow())
            .filter(t => t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE)
            .map(t => t.id)
        );

        let affectedTabIds = [];
        let createdGroupIds = [];

        // Step 3: Group them
        for (const group of mappingResults) {
            const tabIdsToGroup = group.tabIds.filter(id => validUnclassifiedTabIds.has(id));
            if (tabIdsToGroup.length > 0) {
                // Determine a random color
                const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];

                const newGroupId = await api.addTabToNewGroup(tabIdsToGroup, group.theme, randomColor);
                affectedTabIds.push(...tabIdsToGroup);
                createdGroupIds.push(newGroupId);
            }
        }

        if (affectedTabIds.length > 0) {
            state.setLastAutoGroupState({
                affectedTabs: affectedTabIds,
                createdGroups: createdGroupIds
            });
            showToast(api.getMessage('autoGroupingSuccess'), true);
        } else {
            showToast(api.getMessage('noTabsGrouped'));
        }

    } catch (error) {
        console.error('Smart Auto-Grouping Error:', error);
        showToast(api.getMessage('autoGroupingError') + error.message);
    } finally {
        aiGroupBtn.classList.remove('loading');
        aiGroupBtn.disabled = false;
        resetProgress();
    }
}

async function handleUndoAction() {
    const groupState = state.getLastAutoGroupState();
    if (!groupState.canUndo || !groupState.affectedTabs || groupState.affectedTabs.length === 0) return;

    try {
        await api.ungroupTabs(groupState.affectedTabs);
        state.clearLastAutoGroupState();
        hideToast();
    } catch (error) {
        console.error('Undo auto-grouping error:', error);
    }
}

function showToast(message, allowUndo = false) {
    const toastContainer = document.getElementById('toast-container');
    const msgEl = document.getElementById('toast-message');
    const undoBtn = document.getElementById('toast-undo-btn');

    if (!toastContainer || !msgEl || !undoBtn) return;

    msgEl.textContent = message;

    if (allowUndo) {
        undoBtn.classList.remove('hidden');
    } else {
        undoBtn.classList.add('hidden');
    }

    toastContainer.classList.remove('hidden');

    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
    }

    toastTimeoutId = setTimeout(() => {
        hideToast();
    }, 10000); // 10 seconds limit for Undo
}

function hideToast() {
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        toastContainer.classList.add('hidden');
    }
    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
        toastTimeoutId = null;
    }
}
