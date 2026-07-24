// tgLoginController.js — Telegram 登入控制（BASE-018 TG2c）。
//
// 在 **options 頁**（DOM context）執行:client.start 需互動 prompt（手機驗證碼、2FA
// 密碼),只能在有 UI 的 context。登入拿 session 後由 caller 存 storage.local,SW/offscreen
// (TG2b)用它連線收訊。GramJS 以 dynamic import 載入(只在登入時,DOM context 合法)。
// 邏輯抽此以可單元測(UI 在 options.js)。
//
// 安全紀律:phone/驗證碼/2FA 密碼一律由 caller(UI)透過 callback 提供——使用者自己輸入,
// 不經此模組儲存。session ≈ 完整帳號存取權,由 caller 負責風險告示與 storage。

export function createTgLoginController(deps = {}) {
    const loadGramJS = deps.loadGramJS || (() => import('../../lib/telegram.bundle.js'));

    // 建一個短命 client 執行一次性操作後必 disconnect。
    async function withClient(session, apiId, apiHash, fn) {
        const { TelegramClient, StringSession } = await loadGramJS();
        const client = new TelegramClient(new StringSession(session || ''), Number(apiId), String(apiHash), {
            connectionRetries: 3,
            useWSS: true,
        });
        try {
            return await fn(client);
        } finally {
            try { await client.disconnect(); } catch { /* noop */ }
        }
    }

    /**
     * 互動登入。phoneCode/password 為 UI callback(彈 input 等使用者輸入)。
     * @param {{apiId, apiHash, phoneNumber:string,
     *   phoneCode:(isViaApp?:boolean)=>Promise<string>,
     *   password:(hint?:string)=>Promise<string>, onError?:(e:Error)=>void}} p
     * @returns {Promise<{session:string, me:{firstName?:string, username?:string}}>}
     */
    async function login({ apiId, apiHash, phoneNumber, phoneCode, password, onError }) {
        return withClient('', apiId, apiHash, async (client) => {
            await client.start({
                phoneNumber,
                phoneCode,
                password,
                onError: (e) => { onError?.(e); },
            });
            const session = client.session.save();
            let me = {};
            try {
                const u = await client.getMe();
                me = { firstName: u?.firstName, username: u?.username };
            } catch { /* getMe 失敗不阻斷登入,session 已取得 */ }
            return { session, me };
        });
    }

    /** 遠端撤銷 session + 斷線。caller 另清本機 storage(即使遠端失敗也要清)。 */
    async function logout({ apiId, apiHash, session }) {
        if (!session) return;
        await withClient(session, apiId, apiHash, async (client) => {
            await client.connect();
            try { await client.logOut(); } catch { /* 已失效/網路 → 仍讓 caller 清本機 */ }
        });
    }

    /**
     * 解析頻道(防仿冒:加入前確認頻道名/username/訂閱數)。需已登入 session。
     * @returns {Promise<{id?:string, username?:string, title?:string, participantsCount?:number}>}
     */
    async function resolveChannel({ apiId, apiHash, session, username }) {
        return withClient(session, apiId, apiHash, async (client) => {
            await client.connect();
            const entity = await client.getEntity(username);
            return {
                id: entity?.id != null ? String(entity.id) : undefined,
                username: entity?.username,
                title: entity?.title,
                participantsCount: entity?.participantsCount,
            };
        });
    }

    return { login, logout, resolveChannel };
}
