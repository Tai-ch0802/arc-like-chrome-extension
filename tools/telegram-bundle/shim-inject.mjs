// esbuild inject:把 Buffer/process 補進每個模組的作用域(GramJS 假設 Node 全域)。
// 固定檔案(非 build 時動態生成)以利稽核與可重現。
import process from 'process';
import { Buffer } from 'buffer';
export { process, Buffer };
