import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const lobeIconSourceDir = path.join(
  path.dirname(require.resolve('@lobehub/icons-static-svg/package.json')),
  'icons'
)
const lobeIconFiles = readdirSync(lobeIconSourceDir)
  .filter((file) => /^[a-z0-9-]+\.svg$/.test(file))
  .sort()
const lobeIconMaskFiles: string[] = []
const lobeIconAspectRatios: Record<string, number> = {}
for (const file of lobeIconFiles) {
  const source = readFileSync(path.join(lobeIconSourceDir, file), 'utf8')
  if (source.includes('currentColor')) lobeIconMaskFiles.push(file)

  const viewBox = source.match(/\bviewBox="([^"]+)"/)?.[1]
  if (!viewBox) continue
  const [, , width, height] = viewBox.split(/\s+/).map(Number)
  const ratio = width / height
  if (Number.isFinite(ratio) && ratio > 0 && Math.abs(ratio - 1) > 1e-6) {
    lobeIconAspectRatios[file] = ratio
  }
}

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  const serverUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    'http://localhost:3000'

  const isProd = envMode === 'production'
  const devProxy = Object.fromEntries(
    (['/api', '/mj', '/pg'] as const).map((key) => [
      key,
      { target: serverUrl, changeOrigin: true },
    ])
  ) as Record<string, { target: string; changeOrigin: boolean }>

  return {
    plugins: [pluginReact(), pluginTailwindcss({ optimize: false })],
    // Rsbuild 2: replaces deprecated `performance.chunkSplit` (RSPack 2 aligned)
    splitChunks: {
      preset: 'default',
      cacheGroups: {
        'vendor-react': {
          test: /node_modules[\\/](react|react-dom)[\\/]/,
          name: 'vendor-react',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-ui-primitives': {
          test: /node_modules[\\/](@base-ui|@radix-ui)[\\/]/,
          name: 'vendor-ui-primitives',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-tanstack': {
          test: /node_modules[\\/]@tanstack[\\/]/,
          name: 'vendor-tanstack',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
      },
    },
    source: {
      entry: {
        index: './src/main.tsx',
      },
      define: {
        __LOBE_ICON_ASPECT_RATIOS__: JSON.stringify(lobeIconAspectRatios),
        __LOBE_ICON_FILES__: JSON.stringify(lobeIconFiles),
        __LOBE_ICON_MASK_FILES__: JSON.stringify(lobeIconMaskFiles),
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    html: {
      template: './index.html',
    },
    server: {
      host: '0.0.0.0',
      strictPort: false,
      proxy: devProxy,
    },
    output: {
      // Production optimizations
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
      copy: {
        patterns: [
          {
            from: lobeIconSourceDir,
            to: 'lobe-icons',
            noErrorOnMissing: false,
          },
        ],
      },
      // Rely on Rsbuild default legalComments ("linked" → per-chunk *.LICENSE.txt) in all modes.
      // Do not set "none" in production: that strips minifier-preserved third-party notices and
      // extracted license files, which some distributions require for open-source compliance.
    },
    performance: {
      // Remove console in production
      removeConsole: isProd ? ['log'] : false,
      buildCache: false,
    },
    tools: {
      rspack: {
        plugins: [
          tanstackRouter({
            target: 'react',
            // Dev: avoid per-route async chunks (reduces white flash on navigation + faster HMR feedback).
            // Prod: keep route-based code splitting.
            autoCodeSplitting: isProd,
          }),
        ],
      },
    },
  }
})
