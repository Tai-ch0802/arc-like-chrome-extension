// esbuild inject:把 Buffer/process 補進每個模組的作用域(GramJS 假設 Node 全域)。
// 固定檔案(非 build 時動態生成)以利稽核與可重現。
import process from 'process';
import { Buffer } from 'buffer';

// teleproto Helpers.sleep(ms, isUnref=true) 會呼叫 `setTimeout(...).unref()`——Node 的
// setTimeout 回 Timeout 物件(有 unref/ref,讓 timer 不阻止進程退出),但瀏覽器回 number、
// 無此方法 → 真連線時 `TypeError: setTimeout(...).unref is not a function`。build.mjs 以
// esbuild define 把 bundle 內裸 `setTimeout` 全替換為此 shim:還原 Node「回 Timeout 物件」
// 的假設(unref/ref 在瀏覽器 no-op,無「阻止進程退出」概念),valueOf/toPrimitive 回原 id
// 供 clearTimeout 經 ToNumber coerce 正確清除。`globalThis.setTimeout` 為成員存取,不受
// define(只替換裸識別字)影響,故不遞迴。
function __tgSetTimeout(handler, timeout, ...args) {
    const id = globalThis.setTimeout(handler, timeout, ...args);
    return {
        unref() { return this; },
        ref() { return this; },
        hasRef() { return true; },
        refresh() { return this; },
        [Symbol.toPrimitive]() { return id; },
        valueOf() { return id; },
    };
}

export { process, Buffer, __tgSetTimeout };
