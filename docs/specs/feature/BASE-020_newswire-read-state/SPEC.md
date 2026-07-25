# SPEC — BASE-020 tg 快訊可點擊修復 + 快訊已讀反灰

| 欄位 | 值 |
|---|---|
| 分級 | T1（單檔 SPEC 隨 PR 審） |
| 來源 | 使用者回報（TG3 真收訊後）：tg 快訊點不了；期望點擊後反灰已讀，比照閱讀清單 |
| 前置 | BASE-018 TG 收訊已通（#198/#199/#202） |

## A. Bug：tg 快訊不可點（根因修復）

**症狀**：tg 事件在 sidepanel 出現，但整列不可點（無 `newswire-item--link`）。

**根因**（teleproto source 證據）：
- 事件的 `chatId` getter（`ChatGetter` → `getPeerId`）對頻道回 **marked 形式** `-100<id>`（`Utils.js` PeerChannel 分支）。
- `tgAdapter` 的 `metaById` key 是 `getEntity()` 的**裸 entity.id**。
- → lookup 必 miss → 多頻道 fallback `{ id: chatId }` **無 username** → `parseTgMessage` 組不出 `https://t.me/<username>/<msgId>` → `ev.url` 空 → renderer 不掛 click。

**伴生地雷**：`meta.id` 原為 BigInt（entity.id）。修好 lookup 後 meta 會經 `chrome.runtime.sendMessage`（JSON 序列化）送 SW——BigInt throw、整則事件靜默丟失。必須一併字串化。

**修法**（`modules/newswire/tgAdapter.js`）：
1. `eventChatId` 把 marked 形式 normalize 成裸 id（正則 `^-100([^0]\d*)$`，與 teleproto `resolveId` 一致，排除 `-10000xyz` 普通群組誤判）。
2. `meta.id` 一律 `String()`（JSON-safe）。

## B. Feature：點擊快訊反灰已讀（比照閱讀清單）

- **範圍**：全來源一致（不只 tg）——同一 renderer，點擊任何有 url 的快訊皆標已讀。
- **儲存**：`read: true` 存在 ring buffer 事件本體（`newswireEvents`），隨 buffer 持久化與 FIFO 淘汰，**不需**獨立 read-id 集合。本機狀態，不隨 Drive 漫遊。
- **協定**：sidepanel 點擊 → `newswire:markRead {id}` → SW `buffer.markRead` + **立即 flush**（不等 2s debounce——SW 處理完訊息可能隨即掛起，debounce timer 隨 SW 蒸發 → 標記丟失）→ broadcast `newswire:read {id}` 供其他 sidepanel 同步。
- **UI**：`.newswire-item.is-read`（opacity 0.6 + 標題 secondary 色，比照 `.reading-list-item.is-read`；不用刪除線——快訊語意是「看過」非「完成」）。`renderRow` 依 `ev.read` 回填（重開面板保留）。

## C. 附帶修復：tg:raw 的 MV3 SW 保活

E2E 診斷實錄：SW 在 idle 掛起邊緣被 `tg:raw` 喚醒時，fire-and-forget 處理（`return false`）讓 init 之後的 append/broadcast 無保活保障 → 事件靜默丟失、sidepanel 收不到廣播。**修**：`handleTgOffscreenMessage` 的 tg:raw 改 pending `sendResponse` 模式（`return true`，處理完回應）——pending response 是 MV3 keep-alive 訊號。offscreen 端 post 為 fire-and-forget，response 被丟棄，無需配合。真實產品同樣受益（offscreen 發訊息時 SW 掛起邊緣不再丟事件）。

## Test Impact

- unit：`eventChatId` marked strip ×3、多頻道 marked lookup + meta.id 字串、`eventBuffer.markRead`（標記/冪等/不波及）。
- E2E（`happy_path_newswire.test.js`）：tg:raw 走真管線 → row 可點（url 端到端）→ 點擊反灰 → storage `read:true` 落地。fixture msgId 每 attempt 唯一（固定 id 會被 SW dedupe 吸收使 retry 必死）。
- 已知殘餘：高負載下 page→page 廣播偶發丟失（既有暴露面，非本變更引入）→ 獨立調查 task。

## 明確不做

- 已讀狀態跨裝置同步（本機 ring buffer 語意）。
- 已讀項隱藏/過濾、批次已讀清除（`newswire:clear` 已覆蓋清空需求）。
