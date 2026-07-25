import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const semiUiDir = path.resolve(
  path.dirname(require.resolve('@douyinfe/semi-ui')),
  '../..',
);
// date-fns-tz 1.x still imports date-fns v2 private paths. Keep Classic on
// Semi UI's own v2 dependency while Default remains on date-fns v4.
const semiDateFnsDir = path.dirname(
  require.resolve('date-fns/package.json', { paths: [semiUiDir] }),
);
const lobeIconSourceDir = path.join(
  path.dirname(require.resolve('@lobehub/icons-static-svg/package.json')),
  'icons',
);
const lobeIconFiles = readdirSync(lobeIconSourceDir)
  .filter((file) => /^[a-z0-9-]+\.svg$/.test(file))
  .sort();
const lobeIconMaskFiles: string[] = [];
const lobeIconAspectRatios: Record<string, number> = {};
for (const file of lobeIconFiles) {
  const source = readFileSync(path.join(lobeIconSourceDir, file), 'utf8');
  if (source.includes('currentColor')) lobeIconMaskFiles.push(file);

  const viewBox = source.match(/\bviewBox="([^"]+)"/)?.[1];
  if (!viewBox) continue;
  const [, , width, height] = viewBox.split(/\s+/).map(Number);
  const ratio = width / height;
  if (Number.isFinite(ratio) && ratio > 0 && Math.abs(ratio - 1) > 1e-6) {
    lobeIconAspectRatios[file] = ratio;
  }
}

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] });
  const clientServerUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    '';
  const proxyServerUrl = clientServerUrl || 'http://localhost:3000';
  const isProd = envMode === 'production';
  const devProxy = Object.fromEntries(
    (['/api', '/mj', '/pg'] as const).map((key) => [
      key,
      { target: proxyServerUrl, changeOrigin: true },
    ]),
  ) as Record<string, { target: string; changeOrigin: boolean }>;

  return {
    plugins: [pluginReact()],
    source: {
      entry: {
        index: './src/index.jsx',
      },
      define: {
        'import.meta.env.VITE_REACT_APP_SERVER_URL':
          JSON.stringify(clientServerUrl),
        __LOBE_ICON_ASPECT_RATIOS__: JSON.stringify(lobeIconAspectRatios),
        __LOBE_ICON_FILES__: JSON.stringify(lobeIconFiles),
        __LOBE_ICON_MASK_FILES__: JSON.stringify(lobeIconMaskFiles),
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'date-fns': semiDateFnsDir,
        '@douyinfe/semi-ui/dist/css/semi.css': path.resolve(
          semiUiDir,
          'dist/css/semi.css',
        ),
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
    },
    performance: {
      removeConsole: isProd ? ['log'] : false,
      buildCache: {
        cacheDigest: [process.env.VITE_REACT_APP_VERSION],
      },
    },
    tools: {
      rspack: {
        module: {
          rules: [
            {
              test: /src[\\/].*\.js$/,
              type: 'javascript/auto',
              use: [
                {
                  loader: 'builtin:swc-loader',
                  options: {
                    jsc: {
                      parser: {
                        syntax: 'ecmascript',
                        jsx: true,
                      },
                      transform: {
                        react: {
                          runtime: 'automatic',
                          development: !isProd,
                          refresh: !isProd,
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    },
  };
});
