/**
 * @file rssSyncLogic.js
 * PURE merge logic for syncing RSS state across devices via Google Drive
 * appdata. Every function here is a pure function of its arguments — NO chrome,
 * NO fetch, NO Date.now / Math.random, NO module state. All time enters via an
 * explicit `now` argument so the whole thing is unit-testable in plain Node.
 *
 * Sync model (per the approved design — distinct from workspace syncLogic.js):
 *   - RSS state (subscriptions + dedup hashes + tombstones) lives in ONE Drive
 *     file `rss-sync.json`. Keeping subscriptions and hashes in the SAME file
 *     merged in the SAME pass is load-bearing: a device that learns a feed was
 *     already fetched (lastFetched > 0) but does NOT yet have the corresponding
 *     dedup hashes would re-add every item as "new" (see fetchNow's first-fetch
 *     branch). Atomic subs+hashes propagation prevents that. DO NOT split them.
 *   - Merge is set-union / id-merge semantics (NOT the workspace rev/baseRev
 *     model). Convergence relies on the merge being COMMUTATIVE and IDEMPOTENT
 *     for a fixed `now`; the background no-op-write guard depends on it to
 *     settle in <=2 cycles instead of an echo-suppression map.
 *   - Subscription conflicts resolve by a monotonic `updatedAt` (last edit
 *     wins); `lastFetched` always takes the max (bookkeeping, not user intent).
 *   - Deletions are soft tombstones ({id: deletedAtMs}); a tombstone hides a
 *     subscription iff deletedAt >= that sub's updatedAt, and is GC'd after a
 *     grace window (longer than workspace's because RSS carries no baseRev).
 *
 * @module modules/rss/rssSyncLogic
 */

/** Current `rss-sync.json` schema version this client writes/understands. */
export const RSS_SYNC_SCHEMA = 1;

/** Max dedup hashes retained. High on purpose: at a fixed set the cross-device
 *  union never tops out (identical subscriptions → identical feed items →
 *  identical SHA-256), so the cap never fires in steady state and thus never
 *  breaks union idempotency. ~5000 * ~70B ≈ 350KB, well under storage.local's
 *  ~10MB — no `unlimitedStorage` permission needed. */
export const MAX_STORED_HASHES = 5000;

/** Tombstone grace window: 180 days. Longer than workspace sync's 60 days
 *  because RSS has no per-item version vector — a device offline past the window
 *  that still holds a deleted feed will re-inject it once (documented, accepted:
 *  "delete it again"). */
export const TOMBSTONE_GC_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Lamport-lite monotonic timestamp. Guarantees the returned value is strictly
 * greater than any timestamp this device has already observed for the record,
 * so a device whose wall clock runs slow cannot mint an `updatedAt` that looks
 * OLDER than what it last wrote (which would let a stale edit lose forever).
 *
 * @param {number} known - the largest timestamp already seen for this record (0 if none).
 * @param {number} now - Date.now() supplied by the caller.
 * @returns {number}
 */
export function nextTimestamp(known, now) {
    return Math.max(now || 0, (known || 0) + 1);
}

/**
 * Deduplicate + cap a hash list deterministically. Under the cap the input set
 * is returned as-is (deduped) to avoid needless reordering churn on every write;
 * the caller compares canonically so order does not matter. AT the cap the
 * result is order-independent (sorted, keep the lexicographically-largest cap)
 * so two devices merging in opposite orders still converge to the same set.
 *
 * @param {string[]} hashes
 * @param {number} [cap=MAX_STORED_HASHES]
 * @returns {string[]}
 */
export function capHashes(hashes, cap = MAX_STORED_HASHES) {
    const uniq = Array.from(new Set(hashes || []));
    if (uniq.length <= cap) return uniq;
    // Deterministic keep-top-cap: sort ascending, drop the smallest overflow.
    return uniq.sort().slice(uniq.length - cap);
}

/**
 * Union the hashes currently in storage with the in-memory set about to be
 * written, then cap. This is the root-cause fix for the dedup bug: writing the
 * UNION (never a blind overwrite of one context's stale snapshot) means a
 * concurrent write from another JS context can never delete hashes this context
 * did not know about.
 *
 * @param {string[]} fromStorage - hashes freshly re-read from storage.
 * @param {Iterable<string>} inMemory - the in-memory Set being flushed.
 * @param {number} [cap=MAX_STORED_HASHES]
 * @returns {string[]}
 */
export function mergeHashesForWrite(fromStorage, inMemory, cap = MAX_STORED_HASHES) {
    return capHashes([...(fromStorage || []), ...inMemory], cap);
}

/** Normalize a possibly-partial RSS state into the canonical full shape. */
function normalizeState(state) {
    const s = state || {};
    return {
        subscriptions: Array.isArray(s.subscriptions) ? s.subscriptions : [],
        tombstones: (s.tombstones && typeof s.tombstones === 'object') ? s.tombstones : {},
        hashes: Array.isArray(s.hashes) ? s.hashes : [],
    };
}

/**
 * Pick the winning subscription record for one id from two candidates. Larger
 * `updatedAt` wins (last edit). `lastFetched` is merged as the max of both
 * regardless of which record wins — it is fetch bookkeeping, so the most-recent
 * fetch time (and thus the device with the freshest hashes) should stick. Ties
 * on updatedAt resolve deterministically (larger lastFetched, then a stable
 * string compare) so the merge is commutative.
 *
 * @param {object|null} a
 * @param {object|null} b
 * @returns {object}
 */
function pickSubscription(a, b) {
    if (!a) return b;
    if (!b) return a;
    const au = a.updatedAt || 0;
    const bu = b.updatedAt || 0;
    let winner;
    if (au !== bu) {
        winner = au > bu ? a : b;
    } else if ((a.lastFetched || 0) !== (b.lastFetched || 0)) {
        winner = (a.lastFetched || 0) > (b.lastFetched || 0) ? a : b;
    } else {
        // Fully deterministic, order-independent tiebreak.
        winner = JSON.stringify(a) >= JSON.stringify(b) ? a : b;
    }
    return {
        ...winner,
        lastFetched: Math.max(a.lastFetched || 0, b.lastFetched || 0),
        updatedAt: Math.max(au, bu),
    };
}

/**
 * Merge two subscription lists + tombstone maps. Pure; deterministic for a fixed
 * `now`.
 *
 * @param {object[]} localSubs
 * @param {object[]} remoteSubs
 * @param {Object<string,number>} localTombs
 * @param {Object<string,number>} remoteTombs
 * @param {number} now
 * @param {number} gcMs
 * @returns {{subscriptions: object[], tombstones: Object<string,number>}}
 */
export function mergeSubscriptions(localSubs, remoteSubs, localTombs, remoteTombs, now, gcMs) {
    // Union tombstones by id, keeping the latest deletion time, then GC by age.
    const tombstones = {};
    for (const [id, ts] of [...Object.entries(localTombs || {}), ...Object.entries(remoteTombs || {})]) {
        tombstones[id] = Math.max(tombstones[id] || 0, ts || 0);
    }
    for (const id of Object.keys(tombstones)) {
        if (now - tombstones[id] > gcMs) delete tombstones[id];
    }

    // Merge subscriptions by id.
    const byId = new Map();
    for (const sub of [...(localSubs || []), ...(remoteSubs || [])]) {
        if (!sub || !sub.id) continue;
        byId.set(sub.id, pickSubscription(byId.get(sub.id) || null, sub));
    }

    // A tombstone hides a subscription iff it is at least as new as the sub's
    // last edit (deletedAt >= updatedAt). A newer edit (updatedAt > deletedAt)
    // resurrects it intentionally — the user re-added/edited after deleting.
    const subscriptions = [];
    for (const sub of byId.values()) {
        const deletedAt = tombstones[sub.id];
        if (deletedAt !== undefined && deletedAt >= (sub.updatedAt || 0)) continue;
        subscriptions.push(sub);
    }

    // Stable order (by id) so canonical comparison is order-independent.
    subscriptions.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    return { subscriptions, tombstones };
}

/**
 * Merge local and remote RSS state into the converged state. COMMUTATIVE and
 * IDEMPOTENT for a fixed `now` (the property the background no-op guard relies
 * on to settle). subs + hashes are merged in this single pass so they always
 * propagate atomically.
 *
 * @param {object} local  - {subscriptions, tombstones, hashes}
 * @param {object} remote - {subscriptions, tombstones, hashes}
 * @param {{now:number, hashCap?:number, tombstoneGcMs?:number}} opts
 * @returns {{schema:number, subscriptions:object[], tombstones:Object<string,number>, hashes:string[]}}
 */
export function mergeRssState(local, remote, opts) {
    const { now, hashCap = MAX_STORED_HASHES, tombstoneGcMs = TOMBSTONE_GC_MS } = opts || {};
    const l = normalizeState(local);
    const r = normalizeState(remote);
    const { subscriptions, tombstones } = mergeSubscriptions(
        l.subscriptions, r.subscriptions, l.tombstones, r.tombstones, now, tombstoneGcMs,
    );
    return {
        schema: RSS_SYNC_SCHEMA,
        subscriptions,
        tombstones,
        hashes: capHashes([...l.hashes, ...r.hashes], hashCap),
    };
}

/**
 * Canonical, order-independent string form of an RSS state — used by the no-op
 * write guard to decide whether a merged result actually differs from what is
 * already in storage / on Drive (so an unchanged sync writes nothing and stops
 * the convergence loop).
 *
 * @param {object} state
 * @returns {string}
 */
export function canonicalizeRssState(state) {
    const s = normalizeState(state);
    const subs = s.subscriptions
        .map((x) => ({
            id: x.id,
            url: x.url,
            title: x.title,
            interval: x.interval,
            enabled: !!x.enabled,
            lastFetched: x.lastFetched || 0,
            updatedAt: x.updatedAt || 0,
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const tombs = Object.keys(s.tombstones).sort().map((k) => [k, s.tombstones[k]]);
    const hashes = Array.from(new Set(s.hashes)).sort();
    return JSON.stringify({ subs, tombs, hashes });
}

/**
 * True iff two RSS states are equivalent (ignoring order / storage encoding).
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function rssStateEqual(a, b) {
    return canonicalizeRssState(a) === canonicalizeRssState(b);
}
