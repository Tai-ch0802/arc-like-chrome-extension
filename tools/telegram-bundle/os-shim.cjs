// GramJS client 建構時讀 os.* 組 system/device 字串;瀏覽器/SW 無 os,給安全值。
module.exports = {
  type: () => 'Browser', release: () => '1.0', platform: () => 'browser',
  arch: () => 'wasm', hostname: () => 'extension', networkInterfaces: () => ({}),
  cpus: () => [], totalmem: () => 0, freemem: () => 0, EOL: '\n',
};
