/*
Copyright (C) 2026 JistAI contributors
SPDX-License-Identifier: AGPL-3.0-or-later
*/

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const scanner = path.join(__dirname, 'scan-node.cjs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writePackage(directory, manifest, withLicense = true) {
  writeJson(path.join(directory, 'package.json'), manifest);
  if (withLicense) {
    fs.writeFileSync(
      path.join(directory, 'LICENSE'),
      `${manifest.name} ${manifest.version} fixture license\n`,
      'utf8',
    );
  }
}

function writePackageLock(installRoot, packages = {}) {
  writeJson(path.join(installRoot, 'package-lock.json'), {
    name: 'scan-node-fixture',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { name: 'scan-node-fixture', version: '1.0.0' },
      ...packages,
    },
  });
}

function registryEntry(name, version, suffix) {
  return {
    name,
    version,
    resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
    integrity: `sha512-${suffix}`,
  };
}

function runScanner(installRoot, manifestPath) {
  const output = path.join(installRoot, 'scan-output.json');
  const result = spawnSync(
    process.execPath,
    [
      scanner,
      '--manifest',
      manifestPath,
      '--output',
      output,
      '--area',
      'fixture',
      '--root-groups',
      'dependencies',
      '--package-lock',
      path.join(installRoot, 'package-lock.json'),
    ],
    { encoding: 'utf8' },
  );
  return { output, result };
}

function processDetails(result) {
  return [
    `status=${result.status}`,
    result.error ? `error=${result.error.message}` : '',
    result.stdout ? `stdout=${result.stdout.trim()}` : '',
    result.stderr ? `stderr=${result.stderr.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function expectSuccess(execution) {
  assert.equal(execution.result.status, 0, processDetails(execution.result));
  return JSON.parse(fs.readFileSync(execution.output, 'utf8'));
}

function expectFailure(execution, messageFragment) {
  assert.notEqual(execution.result.status, 0, 'scanner unexpectedly succeeded');
  const details = processDetails(execution.result);
  assert.ok(details.includes(messageFragment), `${details}\nmissing=${messageFragment}`);
}

function withFixture(name, test) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), `scan-node-${name}-`));
  try {
    test(sandbox);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

const tests = [
  [
    'does not resolve dependencies from a parent node_modules directory',
    () =>
      withFixture('parent', (sandbox) => {
        const installRoot = path.join(sandbox, 'install');
        const manifestPath = path.join(installRoot, 'app', 'package.json');
        writeJson(manifestPath, {
          name: 'fixture-app',
          version: '1.0.0',
          dependencies: { 'parent-only': '1.0.0' },
        });
        writePackageLock(installRoot);
        writePackage(path.join(sandbox, 'node_modules', 'parent-only'), {
          name: 'parent-only',
          version: '1.0.0',
          license: 'MIT',
        });

        const report = expectSuccess(runScanner(installRoot, manifestPath));
        assert.equal(report.inventory.length, 0);
        assert.deepEqual(report.unresolved, [
          {
            dependencyName: 'parent-only',
            relationship: 'direct:dependencies',
            requiredBy: 'fixture-app',
          },
        ]);
      }),
  ],
  [
    'rejects a package symlink that escapes the install root',
    () =>
      withFixture('package-link', (sandbox) => {
        const installRoot = path.join(sandbox, 'install');
        const manifestPath = path.join(installRoot, 'package.json');
        writeJson(manifestPath, {
          name: 'fixture-app',
          version: '1.0.0',
          dependencies: { escape: '1.0.0' },
        });
        writePackageLock(installRoot, {
          'node_modules/escape': registryEntry('escape', '1.0.0', 'escape'),
        });
        const external = path.join(sandbox, 'external', 'escape');
        writePackage(external, {
          name: 'escape',
          version: '1.0.0',
          license: 'MIT',
        });
        const link = path.join(installRoot, 'node_modules', 'escape');
        fs.mkdirSync(path.dirname(link), { recursive: true });
        fs.symlinkSync(external, link, process.platform === 'win32' ? 'junction' : 'dir');

        expectFailure(
          runScanner(installRoot, manifestPath),
          'package escape resolves outside the install root',
        );
      }),
  ],
  [
    'rejects license evidence symlinked from a sibling package',
    () =>
      withFixture('evidence-link', (sandbox) => {
        const installRoot = path.join(sandbox, 'install');
        const manifestPath = path.join(installRoot, 'package.json');
        writeJson(manifestPath, {
          name: 'fixture-app',
          version: '1.0.0',
          dependencies: { alpha: '1.0.0' },
        });
        writePackageLock(installRoot, {
          'node_modules/alpha': registryEntry('alpha', '1.0.0', 'alpha'),
        });
        const alpha = path.join(installRoot, 'node_modules', 'alpha');
        const sibling = path.join(installRoot, 'node_modules', 'sibling');
        writePackage(
          alpha,
          { name: 'alpha', version: '1.0.0', license: 'MIT' },
          false,
        );
        writePackage(sibling, {
          name: 'sibling',
          version: '1.0.0',
          license: 'MIT',
        });
        const evidenceLink = path.join(alpha, 'LICENSE');
        if (process.platform === 'win32') {
          fs.symlinkSync(sibling, evidenceLink, 'junction');
        } else {
          fs.symlinkSync(path.join(sibling, 'LICENSE'), evidenceLink, 'file');
        }

        expectFailure(
          runScanner(installRoot, manifestPath),
          'license evidence LICENSE resolves outside the install root',
        );
      }),
  ],
  [
    'traverses distinct physical copies of the same package coordinate',
    () =>
      withFixture('duplicate-coordinate', (sandbox) => {
        const installRoot = path.join(sandbox, 'install');
        const manifestPath = path.join(installRoot, 'package.json');
        writeJson(manifestPath, {
          name: 'fixture-app',
          version: '1.0.0',
          dependencies: { alpha: '1.0.0', beta: '1.0.0' },
        });
        writePackageLock(installRoot, {
          'node_modules/alpha': registryEntry('alpha', '1.0.0', 'alpha'),
          'node_modules/alpha/node_modules/shared': registryEntry(
            'shared',
            '1.0.0',
            'shared-a',
          ),
          'node_modules/alpha/node_modules/shared/node_modules/leaf': registryEntry(
            'leaf',
            '1.0.0',
            'leaf-a',
          ),
          'node_modules/beta': registryEntry('beta', '1.0.0', 'beta'),
          'node_modules/beta/node_modules/shared': registryEntry(
            'shared',
            '1.0.0',
            'shared-b',
          ),
          'node_modules/beta/node_modules/shared/node_modules/leaf': registryEntry(
            'leaf',
            '2.0.0',
            'leaf-b',
          ),
        });

        for (const parent of ['alpha', 'beta']) {
          const parentDirectory = path.join(installRoot, 'node_modules', parent);
          writePackage(parentDirectory, {
            name: parent,
            version: '1.0.0',
            license: 'MIT',
            dependencies: { shared: '1.0.0' },
          });
          const sharedDirectory = path.join(parentDirectory, 'node_modules', 'shared');
          writePackage(sharedDirectory, {
            name: 'shared',
            version: '1.0.0',
            license: 'MIT',
            dependencies: { leaf: '*' },
          });
          writePackage(path.join(sharedDirectory, 'node_modules', 'leaf'), {
            name: 'leaf',
            version: parent === 'alpha' ? '1.0.0' : '2.0.0',
            license: 'MIT',
          });
        }

        const report = expectSuccess(runScanner(installRoot, manifestPath));
        const coordinates = report.inventory.map(
          (entry) => `${entry.name}@${entry.version}`,
        );
        assert.deepEqual(coordinates, [
          'alpha@1.0.0',
          'beta@1.0.0',
          'leaf@1.0.0',
          'leaf@2.0.0',
          'shared@1.0.0',
        ]);
        assert.equal(
          report.inventory.find((entry) => entry.name === 'shared').variantMismatch,
          false,
        );
      }),
  ],
];

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}
console.log(JSON.stringify({ ok: true, testCount: tests.length }));
