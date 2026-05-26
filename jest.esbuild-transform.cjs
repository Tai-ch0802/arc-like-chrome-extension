// Jest transformer: compile ESM (.js / .mjs) to CommonJS via esbuild so that
// Jest can load modules that use `import` / `export` without changing
// package.json type or renaming source files. esbuild is already a devDep.
const esbuild = require('esbuild');

module.exports = {
    process(src, filename) {
        const { code, map } = esbuild.transformSync(src, {
            loader: 'js',
            format: 'cjs',
            target: 'node20',
            sourcemap: 'inline',
            sourcefile: filename,
        });
        return { code, map };
    },
    getCacheKey(src, filename) {
        return `${filename}:${src.length}:${src.slice(0, 64)}`;
    },
};
