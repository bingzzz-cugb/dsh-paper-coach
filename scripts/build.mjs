import { build } from 'esbuild'
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const libDir = join(rootDir, 'lib')
const pkg = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'))

await mkdir(libDir, { recursive: true })

// 1. Server entry (Node ESM)
await build({
  absWorkingDir: rootDir,
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  target: 'node22',
})

// 2. Client entry (DSH __ModuleLoader__ CJS wrapper)
await build({
  absWorkingDir: rootDir,
  entryPoints: ['src/client/index.tsx'],
  outfile: 'lib/client.js',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  jsx: 'transform',
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@deepseek-ai/dsh-client-ui-primitives',
  ],
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: {
    js: `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{const module={exports:{}};const exports=module.exports;`,
  },
  footer: {
    js: 'return module.exports;}});',
  },
})

// 3. Lazy-loaded PDF.js browser runtime (ESM, served via /paper-coach/assets/pdf-runtime.mjs)
await build({
  absWorkingDir: rootDir,
  entryPoints: ['src/client/pdf-runtime-entry.ts'],
  outfile: 'lib/pdf-runtime.mjs',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  minify: true,
})

// 4. Copy PDF.js worker bundle
await copyFile(
  join(rootDir, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
  join(libDir, 'pdf.worker.mjs')
)

for (const name of ['index.js', 'client.js', 'pdf-runtime.mjs', 'pdf.worker.mjs']) {
  const info = await stat(join(libDir, name))
  console.log(`[build] lib/${name}: ${(info.size / 1024).toFixed(1)} KB`)
}
