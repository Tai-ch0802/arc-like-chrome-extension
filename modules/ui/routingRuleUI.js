// --- Routing Rule UI flow (sidepanel) ---
// "Always group this site…" from the tab context menu (BASE-022 P2, FR-3.01~3.03):
// group picker → persist rule → apply once to the originating tab → toast+undo.

import * as api from '../apiManager.js';
import * as modal from '../modalManager.js';
import { addRule, deleteRule } from '../routing/rulesStore.js';
import { normalizeHost } from '../routing/routingLogic.js';
import { showToast, hideToast, claimUndo } from './toast.js';

/**
 * Runs the whole create-rule flow for a sidebar tab.
 * @param {{id:number, url:string}} tab
 */
export async function promptCreateRuleForTab(tab) {
    let domain;
    try {
        domain = normalizeHost(new URL(tab.url).hostname);
    } catch {
        return;
    }
    if (!domain) return;

    const groups = await api.getTabGroupsInCurrentWindow();
    const preselectGroupId = (tab.groupId !== undefined && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)
        ? tab.groupId
        : null;
    const pick = await modal.showGroupPickerDialog({ groups, preselectGroupId });
    if (!pick) return;

    const rule = await addRule({
        matchType: 'domain',
        pattern: domain,
        groupTitle: pick.groupTitle,
        groupColor: pick.groupColor,
    });
    if (!rule) {
        showToast(api.getMessage('routingLimitReached')
            || 'Rule limit reached (50). Delete one in Settings to add more.');
        return;
    }

    // FR-3.03: apply once right away — but only when the tab is still routable
    // (same exemptions as the engine: not grouped, not pinned).
    let applied = false;
    try {
        const fresh = await api.getTab(tab.id);
        if (fresh && !fresh.pinned && fresh.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
            if (pick.existingGroupId !== null) {
                await api.groupTabs([tab.id], pick.existingGroupId);
            } else {
                await api.addTabToNewGroup(tab.id, pick.groupTitle, pick.groupColor || undefined);
            }
            applied = true;
        }
    } catch (err) {
        console.warn('[routing] immediate apply failed', err);
    }

    showToast(api.getMessage('routingRuleCreatedToast')
        || 'Rule created — new tabs from this site will join the group automatically.', true);
    claimUndo(async () => {
        try {
            await deleteRule(rule.id);
            if (applied) await api.ungroupTabs([tab.id]);
        } catch (err) {
            console.warn('[routing] undo failed', err);
        }
        hideToast();
    });
}
