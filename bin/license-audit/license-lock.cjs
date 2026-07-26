/*
Copyright (C) 2026 JistAI contributors
SPDX-License-Identifier: AGPL-3.0-or-later
*/

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PURPOSE =
  'Pins every source and tool input used to audit the tracked third-party license bundle.';
const TOOLCHAIN = Object.freeze({
  bun: '1.3.11',
  go: '1.26.1',
  node: '24.18.0',
  npm: '11.16.0',
});
const REQUIRED_INPUTS = Object.freeze(
  [
    '.gitattributes',
    'VENDORED-SOURCES.json',
    'bin/license-audit/base-overrides.json',
    'bin/license-audit/build-overrides.cjs',
    'bin/license-audit/generate-third-party.cjs',
    'bin/license-audit/license-lock.cjs',
    'bin/license-audit/run.sh',
    'bin/license-audit/scan-go.go',
    'bin/license-audit/scan-node.cjs',
    'bin/license-audit/scan-node.test.cjs',
    'bin/license-audit/scan-vendored-sources.cjs',
    'electron/package-lock.json',
    'electron/package.json',
    'go.mod',
    'go.sum',
    'third_party/licenses/shadcn-ui-MIT.txt',
    'third_party/licenses/vercel-react-best-practices-MIT.txt',
    'web/bun.lock',
    'web/classic/package.json',
    'web/default/package.json',
    'web/package.json',
  ].sort((left, right) => left.localeCompare(right, 'en')),
);
const COUNT_KEYS = Object.freeze([
  'evidenceTexts',
  'inventoryRows',
  'overridesUsed',
  'uniqueCoordinates',
  'vendoredSources',
]);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key?.startsWith('--') || index + 1 >= argv.length) {
      fail(`invalid argument at ${index}: ${key || '(empty)'}`);
    }
    result[key.slice(2)] = argv[index + 1];
  }
  return result;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function digestBytes(bytes) {
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function readJson(file) {
  const bytes = fs.readFileSync(file);
  assert(
    !(bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf),
    `${file} must not contain a UTF-8 BOM`,
  );
  return { bytes, value: JSON.parse(bytes.toString('utf8')) };
}

function exactKeys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, 'en'));
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, 'en'));
  assert(JSON.stringify(actual) === JSON.stringify(wanted), `${label} keys changed`);
}

function resolveRegularFile(root, relativePath) {
  assert(typeof relativePath === 'string' && relativePath.length > 0, 'input path is empty');
  assert(relativePath === relativePath.replace(/\\/g, '/'), `input path is not POSIX: ${relativePath}`);
  assert(!path.posix.isAbsolute(relativePath), `input path is absolute: ${relativePath}`);
  assert(!relativePath.split('/').includes('..'), `input path traverses parents: ${relativePath}`);
  const rootReal = fs.realpathSync(root);
  const candidate = path.resolve(rootReal, ...relativePath.split('/'));
  const prefix = `${rootReal}${path.sep}`;
  assert(candidate.startsWith(prefix), `input path escapes root: ${relativePath}`);
  const info = fs.lstatSync(candidate);
  assert(!info.isSymbolicLink() && info.isFile(), `input must be a regular file: ${relativePath}`);
  const real = fs.realpathSync(candidate);
  assert(real.startsWith(prefix), `input resolves outside root: ${relativePath}`);
  return candidate;
}

function digestInput(root, relativePath) {
  const file = resolveRegularFile(root, relativePath);
  return { path: relativePath, ...digestBytes(fs.readFileSync(file)) };
}

function validateDigest(entry, label) {
  exactKeys(entry, ['bytes', 'sha256'], label);
  assert(Number.isSafeInteger(entry.bytes) && entry.bytes > 0, `${label}.bytes is invalid`);
  assert(/^[0-9a-f]{64}$/.test(entry.sha256), `${label}.sha256 is invalid`);
}

function reportCounts(report) {
  assert(report.ok === true, 'license report is not successful');
  for (const [name, value] of [
    ['issues', report.issues],
    ['warnings', report.warnings],
    ['evidenceGaps', report.evidenceGaps],
  ]) {
    assert(Array.isArray(value) && value.length === 0, `license report ${name} is not empty`);
  }
  exactKeys(
    report.overrideRequirements,
    ['bytes', 'packageCount', 'path', 'sha256'],
    'license report override requirements',
  );
  assert(
    report.overrideRequirements.path === 'license-override-requirements.json',
    'license override requirements path changed',
  );
  assert(
    Number.isSafeInteger(report.overrideRequirements.bytes) &&
      report.overrideRequirements.bytes > 0,
    'license override requirements byte count is invalid',
  );
  assert(
    /^[0-9a-f]{64}$/.test(report.overrideRequirements.sha256),
    'license override requirements SHA-256 is invalid',
  );
  assert(report.overrideRequirements.packageCount === 0, 'license override requirements remain');
  const vendoredSources = Array.isArray(report.vendoredSources)
    ? report.vendoredSources.length
    : report.counts?.vendoredSources;
  const counts = {
    evidenceTexts: report.counts?.evidenceTexts,
    inventoryRows: report.counts?.inventoryRows,
    overridesUsed: report.counts?.overridesUsed,
    uniqueCoordinates: report.counts?.uniqueCoordinates,
    vendoredSources,
  };
  for (const key of COUNT_KEYS) {
    assert(Number.isSafeInteger(counts[key]) && counts[key] > 0, `license report count ${key} is invalid`);
  }
  assert(counts.vendoredSources === 2, 'license report must contain exactly two vendored sources');
  return counts;
}

function verifyNotice(root) {
  const manifest = readJson(resolveRegularFile(root, 'VENDORED-SOURCES.json')).value;
  const notice = fs.readFileSync(resolveRegularFile(root, 'NOTICE'), 'utf8');
  assert(Array.isArray(manifest.sources) && manifest.sources.length > 0, 'vendored source list is empty');
  for (const source of manifest.sources) {
    for (const value of [source.repository, source.revision]) {
      assert(typeof value === 'string' && notice.includes(value), `NOTICE lacks vendored source token ${value}`);
    }
  }
  for (const value of ['THIRD-PARTY-LICENSES.md', 'VENDORED-SOURCES.json']) {
    assert(notice.includes(value), `NOTICE lacks ${value}`);
  }
}

function writeLock(args) {
  for (const required of ['root', 'bundle', 'report', 'output']) {
    if (!args[required]) fail(`missing --${required}`);
  }
  const root = fs.realpathSync(args.root);
  const reportDocument = readJson(args.report);
  const counts = reportCounts(reportDocument.value);
  const bundleBytes = fs.readFileSync(args.bundle);
  assert(bundleBytes.length > 0, 'license bundle is empty');
  verifyNotice(root);
  const document = {
    schemaVersion: 1,
    purpose: PURPOSE,
    toolchain: TOOLCHAIN,
    inputs: REQUIRED_INPUTS.map((entry) => digestInput(root, entry)),
    output: {
      path: 'THIRD-PARTY-LICENSES.md',
      ...digestBytes(bundleBytes),
    },
    audit: {
      report: digestBytes(reportDocument.bytes),
      counts,
      issueCount: 0,
      warningCount: 0,
      evidenceGapCount: 0,
      overrideRequirementCount: 0,
    },
  };
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return document;
}

function checkLock(args) {
  for (const required of ['root', 'lock', 'report']) {
    if (!args[required]) fail(`missing --${required}`);
  }
  const root = fs.realpathSync(args.root);
  const lockDocument = readJson(args.lock);
  const reportDocument = readJson(args.report);
  const reportDigest = digestBytes(reportDocument.bytes);
  const counts = reportCounts(reportDocument.value);
  const lock = lockDocument.value;
  assert(
    lockDocument.bytes.equals(Buffer.from(`${JSON.stringify(lock, null, 2)}\n`, 'utf8')),
    'license lock is not canonical JSON',
  );
  exactKeys(lock, ['audit', 'inputs', 'output', 'purpose', 'schemaVersion', 'toolchain'], 'license lock');
  assert(lock.schemaVersion === 1, 'license lock schema changed');
  assert(lock.purpose === PURPOSE, 'license lock purpose changed');
  exactKeys(lock.toolchain, Object.keys(TOOLCHAIN), 'license lock toolchain');
  assert(JSON.stringify(lock.toolchain) === JSON.stringify(TOOLCHAIN), 'license lock toolchain changed');
  assert(Array.isArray(lock.inputs), 'license lock inputs must be an array');
  const paths = lock.inputs.map((entry) => entry.path);
  assert(JSON.stringify(paths) === JSON.stringify(REQUIRED_INPUTS), 'license lock input set or order changed');
  for (let index = 0; index < lock.inputs.length; index += 1) {
    const expected = digestInput(root, REQUIRED_INPUTS[index]);
    exactKeys(lock.inputs[index], ['bytes', 'path', 'sha256'], `license lock input ${index}`);
    assert(JSON.stringify(lock.inputs[index]) === JSON.stringify(expected), `license input changed: ${expected.path}`);
  }
  exactKeys(lock.output, ['bytes', 'path', 'sha256'], 'license lock output');
  assert(lock.output.path === 'THIRD-PARTY-LICENSES.md', 'license lock output path changed');
  const currentOutput = digestInput(root, lock.output.path);
  assert(
    currentOutput.bytes === lock.output.bytes && currentOutput.sha256 === lock.output.sha256,
    'tracked third-party license bundle is stale',
  );
  exactKeys(
    lock.audit,
    [
      'counts',
      'evidenceGapCount',
      'issueCount',
      'overrideRequirementCount',
      'report',
      'warningCount',
    ],
    'license lock audit',
  );
  validateDigest(lock.audit.report, 'license lock audit report');
  assert(
    JSON.stringify(reportDigest) === JSON.stringify(lock.audit.report),
    'regenerated license report differs from the locked audit report',
  );
  exactKeys(lock.audit.counts, COUNT_KEYS, 'license lock audit counts');
  for (const key of COUNT_KEYS) {
    assert(Number.isSafeInteger(lock.audit.counts[key]) && lock.audit.counts[key] > 0, `invalid audit count ${key}`);
  }
  assert(lock.audit.counts.vendoredSources === 2, 'audit must contain exactly two vendored sources');
  assert(
    JSON.stringify(counts) === JSON.stringify(lock.audit.counts),
    'regenerated license report counts differ from the lock',
  );
  for (const key of ['issueCount', 'warningCount', 'evidenceGapCount', 'overrideRequirementCount']) {
    assert(lock.audit[key] === 0, `license lock ${key} is not zero`);
  }
  verifyNotice(root);
  return lock;
}

try {
  const mode = process.argv[2];
  const args = parseArgs(process.argv.slice(3));
  const result = mode === 'write' ? writeLock(args) : mode === 'check' ? checkLock(args) : fail('mode must be write or check');
  console.log(
    JSON.stringify({
      ok: true,
      mode,
      inputCount: result.inputs.length,
      outputSha256: result.output.sha256,
      counts: result.audit.counts,
    }),
  );
} catch (error) {
  console.error(`license audit lock: ${error.message}`);
  process.exit(1);
}
