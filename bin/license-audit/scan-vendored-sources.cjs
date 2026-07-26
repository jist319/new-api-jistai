/*
Copyright (C) 2026 JistAI contributors
SPDX-License-Identifier: AGPL-3.0-or-later
*/

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_MANIFEST_SHA256 = '3e94ffaf425530e7b6928013a41732bcd2720a2e45774f291fc20a77ff8d5bc0';
const EXPECTED_SOURCES = {
  'shadcn-ui-agent-skill': {
    repository: 'https://github.com/shadcn-ui/ui',
    revision: '56161142f1b83f612462772d18883807b5f0d601',
    commitTreeGitSha1: '7a604981a701bc097e181848a2b0d3ba63435101',
    sourceTreeGitSha1: 'a8404703769866faf15bee897c9ae6e252ac2d35',
    localTreeGitSha1: '7b461768b2dc12897a411e49d7d10a6f5e87dafd',
    licenseTermsFile: 'third_party/licenses/shadcn-ui-MIT.txt',
    licenseTermsLocalGitBlobSha1: 'fad4d887a681dd49233e5ed01ee2c7a1513089a0',
    licenseTermsSha256: '1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f',
    licenseTermsOrigin: {
      type: 'upstream-exact',
      sourcePath: 'LICENSE.md',
      sourceGitBlobSha1: 'fad4d887a681dd49233e5ed01ee2c7a1513089a0',
      sourceSha256: '1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f',
    },
  },
  'vercel-react-best-practices': {
    repository: 'https://github.com/vercel-labs/agent-skills',
    revision: 'e1f1e7b0c43f2065754cdb7a66897f0c3e8278ff',
    commitTreeGitSha1: '70bacf782cbb14439193af23bc870e2118c4f6a0',
    sourceTreeGitSha1: '079b06a135401704ea94ab74c7c9d86c92ba259f',
    localTreeGitSha1: '71600b94d46e8ad1cec42502be000f038d5d514b',
    licenseTermsFile: 'third_party/licenses/vercel-react-best-practices-MIT.txt',
    licenseTermsLocalGitBlobSha1: 'a7dc2993e184dd879dde90e4e387ea8b4b0aa896',
    licenseTermsSha256: 'c3a2d1fcb3468bdfc06f3a8b29d1914e6a0b9e8635b2f60a849ed980aa99146f',
    licenseTermsOrigin: {
      type: 'locally-assembled-standard-text',
      sourcePaths: ['README.md', 'skills/react-best-practices/SKILL.md'],
      note: 'Pinned source declares MIT but provides no standalone terms file; the local file reproduces standard MIT terms and preserves source attribution without inventing a copyright line.',
    },
  },
};

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key.startsWith('--') || index + 1 >= argv.length) {
      throw new Error(`invalid argument at ${index}: ${key || '(empty)'}`);
    }
    result[key.slice(2)] = argv[index + 1];
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExactKeys(value, required, optional, context) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${context} must be an object`);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) assert(allowed.has(key), `${context} has unknown field ${key}`);
  for (const key of required) assert(Object.hasOwn(value, key), `${context} lacks ${key}`);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function gitObjectSha1(type, bytes) {
  const header = Buffer.from(`${type} ${bytes.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
}

function fileEvidence(file, displayPath) {
  const bytes = fs.readFileSync(file);
  return {
    path: displayPath,
    bytes: bytes.length,
    sha256: sha256(bytes),
    gitBlobSha1: gitObjectSha1('blob', bytes),
    contentBase64: bytes.toString('base64'),
  };
}

function safeRelativePath(root, relative, context) {
  assert(typeof relative === 'string' && relative.length > 0, `${context} must be a non-empty path`);
  assert(!relative.includes('\\') && !relative.includes('\0'), `${context} must use canonical slash separators`);
  assert(!path.posix.isAbsolute(relative), `${context} must be relative`);
  assert(path.posix.normalize(relative) === relative && !relative.startsWith('../'), `${context} is not normalized`);
  const rootReal = fs.realpathSync(root);
  const resolved = path.resolve(rootReal, ...relative.split('/'));
  const prefix = `${rootReal}${path.sep}`;
  assert(resolved.startsWith(prefix), `${context} escapes the canonical source root`);
  const info = fs.lstatSync(resolved);
  assert(!info.isSymbolicLink(), `${context} must not be a symbolic link`);
  const real = fs.realpathSync(resolved);
  assert(real.startsWith(prefix), `${context} resolves outside the canonical source root`);
  return resolved;
}

function regularFilePath(file, context) {
  const resolved = path.resolve(file);
  const info = fs.lstatSync(resolved);
  assert(!info.isSymbolicLink() && info.isFile(), `${context} must be a regular file`);
  return resolved;
}

function treeEntrySort(left, right) {
  const leftName = `${left.name}${left.isDirectory() ? '/' : ''}`;
  const rightName = `${right.name}${right.isDirectory() ? '/' : ''}`;
  return Buffer.compare(Buffer.from(leftName, 'utf8'), Buffer.from(rightName, 'utf8'));
}

function gitTreeSha1(directory) {
  const chunks = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort(treeEntrySort);
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    let mode;
    let objectId;
    if (entry.isDirectory()) {
      mode = '40000';
      objectId = gitTreeSha1(entryPath);
    } else if (entry.isSymbolicLink()) {
      mode = '120000';
      objectId = gitObjectSha1('blob', Buffer.from(fs.readlinkSync(entryPath), 'utf8'));
    } else if (entry.isFile()) {
      const bytes = fs.readFileSync(entryPath);
      mode = (fs.statSync(entryPath).mode & 0o111) === 0 ? '100644' : '100755';
      objectId = gitObjectSha1('blob', bytes);
    } else {
      throw new Error(`unsupported filesystem entry ${entryPath}`);
    }
    chunks.push(Buffer.from(`${mode} ${entry.name}\0`, 'utf8'), Buffer.from(objectId, 'hex'));
  }
  return gitObjectSha1('tree', Buffer.concat(chunks));
}

function assertHex(value, length, context) {
  assert(typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`).test(value), `${context} must be ${length} lowercase hex characters`);
}

function markdownSection(text, title) {
  const heading = `## ${title}`;
  const offset = text.indexOf(heading);
  assert(offset >= 0, `bundle lacks ${title} section`);
  assert(text.indexOf(heading, offset + heading.length) < 0, `bundle has duplicate ${title} sections`);
  const nextHeading = text.indexOf('\n## ', offset + heading.length);
  return text.slice(offset, nextHeading >= 0 ? nextHeading : text.length);
}

function markdownSectionToEnd(text, title) {
  const heading = `## ${title}`;
  const offset = text.indexOf(heading);
  assert(offset >= 0, `bundle lacks ${title} section`);
  assert(text.indexOf(heading, offset + heading.length) < 0, `bundle has duplicate ${title} sections`);
  return text.slice(offset);
}

function licenseTermsOriginLines(source) {
  const origin = source.licenseTermsOrigin;
  if (origin.type === 'upstream-exact') {
    return [
      `License terms origin: \`upstream-exact\`; upstream path \`${origin.sourcePath}\`; Git blob \`${origin.sourceGitBlobSha1}\`; SHA-256 \`${origin.sourceSha256}\``,
    ];
  }
  if (origin.type === 'locally-assembled-standard-text') {
    return [
      `License terms origin: \`locally-assembled-standard-text\`; declaration paths ${origin.sourcePaths.map((entry) => `\`${entry}\``).join(', ')}`,
      `License terms origin note: ${origin.note}`,
    ];
  }
  throw new Error(`unsupported license terms origin ${origin.type || '(missing)'}`);
}

const args = parseArgs(process.argv.slice(2));
for (const required of ['root', 'manifest']) {
  if (!args[required]) throw new Error(`missing --${required}`);
}
if (!args.output && !args.bundle) throw new Error('either --output or --bundle is required');
const root = path.resolve(args.root);
const manifestPath = path.resolve(args.manifest);
assert(manifestPath === safeRelativePath(root, 'VENDORED-SOURCES.json', 'manifest path'), 'manifest path must be VENDORED-SOURCES.json');

const manifestFile = fileEvidence(manifestPath, 'VENDORED-SOURCES.json');
assert(manifestFile.sha256 === EXPECTED_MANIFEST_SHA256, 'VENDORED-SOURCES.json SHA-256 mismatch');
const manifest = JSON.parse(Buffer.from(manifestFile.contentBase64, 'base64').toString('utf8'));
assertExactKeys(manifest, ['schemaVersion', 'purpose', 'sources'], [], 'manifest');
assert(manifest.schemaVersion === 1, 'manifest schemaVersion must be 1');
assert(typeof manifest.purpose === 'string' && manifest.purpose.includes('license evidence'), 'manifest purpose is incomplete');
assert(Array.isArray(manifest.sources) && manifest.sources.length === 2, 'manifest must contain exactly two sources');

const seenIds = new Set();
const scannedSources = [];
for (const source of manifest.sources) {
  const requiredFields = [
    'id', 'name', 'repository', 'revision', 'commitTreeGitSha1', 'sourcePath',
    'sourceTreeGitSha1', 'localPath', 'localTreeGitSha1', 'licenseExpression',
    'attribution', 'licenseEvidence', 'licenseTermsFile', 'licenseTermsLocalGitBlobSha1',
    'licenseTermsSha256', 'licenseTermsOrigin', 'localModifications',
  ];
  assertExactKeys(source, requiredFields, ['sourceLicenseNote', 'copiedContent'], `source ${source.id || '(unknown)'}`);
  const expected = EXPECTED_SOURCES[source.id];
  assert(expected, `unexpected vendored source id ${source.id}`);
  assert(!seenIds.has(source.id), `duplicate vendored source id ${source.id}`);
  seenIds.add(source.id);
  for (const [field, value] of Object.entries(expected)) {
    if (field === 'licenseTermsOrigin') continue;
    assert(source[field] === value, `${source.id} ${field} changed`);
  }
  for (const field of ['name', 'sourcePath', 'localPath', 'attribution']) {
    assert(typeof source[field] === 'string' && source[field].trim().length > 0, `${source.id} lacks ${field}`);
  }
  assert(source.licenseExpression === 'MIT', `${source.id} must be MIT`);
  assertHex(source.revision, 40, `${source.id} revision`);
  assertHex(source.commitTreeGitSha1, 40, `${source.id} commitTreeGitSha1`);
  assertHex(source.sourceTreeGitSha1, 40, `${source.id} sourceTreeGitSha1`);
  assertHex(source.localTreeGitSha1, 40, `${source.id} localTreeGitSha1`);
  assertHex(source.licenseTermsLocalGitBlobSha1, 40, `${source.id} licenseTermsLocalGitBlobSha1`);
  assert(source.repository.startsWith('https://github.com/'), `${source.id} repository must be GitHub HTTPS`);

  const localDirectory = safeRelativePath(root, source.localPath, `${source.id} localPath`);
  assert(fs.statSync(localDirectory).isDirectory(), `${source.id} localPath is not a directory`);
  const actualLocalTree = gitTreeSha1(localDirectory);
  assert(actualLocalTree === source.localTreeGitSha1, `${source.id} local tree Git SHA-1 mismatch`);

  assert(Array.isArray(source.licenseEvidence) && source.licenseEvidence.length > 0, `${source.id} lacks licenseEvidence`);
  const licenseEvidence = source.licenseEvidence.map((entry, index) => {
    assertExactKeys(entry, ['sourcePath', 'sourceUrl', 'gitBlobSha1', 'sha256'], ['assertion'], `${source.id} licenseEvidence[${index}]`);
    assert(typeof entry.sourcePath === 'string' && entry.sourcePath.length > 0, `${source.id} license evidence sourcePath is empty`);
    assert(entry.sourceUrl.startsWith(`${source.repository}/blob/${source.revision}/`), `${source.id} license evidence URL is not revision-pinned`);
    assertHex(entry.gitBlobSha1, 40, `${source.id} license evidence Git blob`);
    assertHex(entry.sha256, 64, `${source.id} license evidence SHA-256`);
    if (Object.hasOwn(entry, 'assertion')) assert(typeof entry.assertion === 'string' && entry.assertion.length > 0, `${source.id} has empty license assertion`);
    return { ...entry };
  });

  const termsPath = safeRelativePath(root, source.licenseTermsFile, `${source.id} licenseTermsFile`);
  const terms = fileEvidence(termsPath, source.licenseTermsFile);
  assert(terms.sha256 === source.licenseTermsSha256, `${source.id} license terms SHA-256 mismatch`);
  assert(terms.gitBlobSha1 === source.licenseTermsLocalGitBlobSha1, `${source.id} local license terms Git blob mismatch`);
  const termsText = Buffer.from(terms.contentBase64, 'base64').toString('utf8');
  assert(termsText.startsWith('MIT License\n'), `${source.id} license terms do not start with MIT License`);
  assert(termsText.includes('Permission is hereby granted, free of charge'), `${source.id} license terms are not classifiable as MIT`);

  const origin = source.licenseTermsOrigin;
  assert(origin && typeof origin === 'object' && !Array.isArray(origin), `${source.id} licenseTermsOrigin must be an object`);
  if (origin.type === 'upstream-exact') {
    assertExactKeys(origin, ['type', 'sourcePath', 'sourceGitBlobSha1', 'sourceSha256'], [], `${source.id} licenseTermsOrigin`);
    assert(typeof origin.sourcePath === 'string' && origin.sourcePath.length > 0, `${source.id} upstream origin sourcePath is empty`);
    assertHex(origin.sourceGitBlobSha1, 40, `${source.id} upstream origin Git blob`);
    assertHex(origin.sourceSha256, 64, `${source.id} upstream origin SHA-256`);
    const originEvidence = licenseEvidence.find((entry) => entry.sourcePath === origin.sourcePath);
    assert(originEvidence, `${source.id} upstream-exact origin lacks matching license evidence`);
    assert(originEvidence.gitBlobSha1 === origin.sourceGitBlobSha1, `${source.id} origin Git blob differs from license evidence`);
    assert(originEvidence.sha256 === origin.sourceSha256, `${source.id} origin SHA-256 differs from license evidence`);
    assert(origin.sourceGitBlobSha1 === terms.gitBlobSha1 && origin.sourceSha256 === terms.sha256, `${source.id} local terms are not exact upstream bytes`);
    assert(JSON.stringify(origin) === JSON.stringify(expected.licenseTermsOrigin), `${source.id} upstream-exact origin changed`);
  } else if (origin.type === 'locally-assembled-standard-text') {
    assertExactKeys(origin, ['type', 'sourcePaths', 'note'], [], `${source.id} licenseTermsOrigin`);
    assert(Array.isArray(origin.sourcePaths) && origin.sourcePaths.length > 0, `${source.id} origin sourcePaths must be non-empty`);
    assert(new Set(origin.sourcePaths).size === origin.sourcePaths.length, `${source.id} origin sourcePaths contain duplicates`);
    assert(typeof origin.note === 'string' && origin.note.length > 0, `${source.id} origin note is empty`);
    assert(JSON.stringify(origin.sourcePaths) === JSON.stringify(licenseEvidence.map((entry) => entry.sourcePath)), `${source.id} origin sourcePaths differ from license evidence`);
    assert(licenseEvidence.every((entry) => entry.sha256 !== terms.sha256 && entry.gitBlobSha1 !== terms.gitBlobSha1), `${source.id} locally assembled terms must not claim an exact upstream terms blob`);
    assert(JSON.stringify(origin) === JSON.stringify(expected.licenseTermsOrigin), `${source.id} locally assembled origin changed`);
    assert(typeof source.sourceLicenseNote === 'string' && source.sourceLicenseNote.length > 0, 'Vercel source license note is required');
    assert(termsText.includes('contains no standalone license file or formal copyright line'), 'Vercel synthesized terms lack source notice');
  } else {
    throw new Error(`${source.id} unsupported licenseTermsOrigin type ${origin.type || '(missing)'}`);
  }

  let copiedContent;
  if (source.copiedContent) {
    assertExactKeys(source.copiedContent, ['sourcePath', 'localPath', 'gitBlobSha1', 'sha256'], [], `${source.id} copiedContent`);
    const copiedPath = safeRelativePath(root, source.copiedContent.localPath, `${source.id} copiedContent.localPath`);
    const copied = fileEvidence(copiedPath, source.copiedContent.localPath);
    assert(copied.sha256 === source.copiedContent.sha256, `${source.id} copied content SHA-256 mismatch`);
    assert(copied.gitBlobSha1 === source.copiedContent.gitBlobSha1, `${source.id} copied content Git blob mismatch`);
    copiedContent = { ...source.copiedContent, bytes: copied.bytes };
  }

  assert(Array.isArray(source.localModifications) && source.localModifications.length > 0, `${source.id} lacks local modifications`);
  assert(source.localModifications.every((entry) => typeof entry === 'string' && entry.length > 0), `${source.id} has an invalid local modification`);
  scannedSources.push({
    id: source.id,
    name: source.name,
    repository: source.repository,
    revision: source.revision,
    commitTreeGitSha1: source.commitTreeGitSha1,
    sourcePath: source.sourcePath,
    sourceTreeGitSha1: source.sourceTreeGitSha1,
    localPath: source.localPath,
    localTreeGitSha1: actualLocalTree,
    licenseExpression: source.licenseExpression,
    attribution: source.attribution,
    ...(source.sourceLicenseNote ? { sourceLicenseNote: source.sourceLicenseNote } : {}),
    licenseEvidence,
    licenseTerms: terms,
    licenseTermsOrigin: JSON.parse(JSON.stringify(origin)),
    ...(copiedContent ? { copiedContent } : {}),
    localModifications: [...source.localModifications],
  });
}
assert(Object.keys(EXPECTED_SOURCES).every((id) => seenIds.has(id)), 'one or more expected vendored sources are missing');

let bundle;
if (args.bundle) {
  const bundlePath = regularFilePath(args.bundle, 'bundle path');
  const bundleFile = fileEvidence(bundlePath, 'THIRD-PARTY-LICENSES.md');
  const bundleText = Buffer.from(bundleFile.contentBase64, 'base64').toString('utf8');
  const inputSection = markdownSection(bundleText, 'Generation Inputs');
  const inventorySection = markdownSection(bundleText, 'Dependency Inventory');
  const provenanceSection = markdownSection(bundleText, 'Vendored Source Provenance');
  const evidenceSection = markdownSectionToEnd(bundleText, 'License And Notice Texts');
  assert(inputSection.includes(manifestFile.path) && inputSection.includes(manifestFile.sha256), 'bundle generation inputs lack the vendored manifest');
  for (const source of scannedSources) {
    const sourceHeading = `### \`${source.id}\``;
    assert(provenanceSection.split(sourceHeading).length - 1 === 1, `bundle provenance must contain ${source.id} exactly once`);
    const requiredFragments = [
      source.repository,
      source.revision,
      source.localPath,
      `License: \`${source.licenseExpression}\``,
      source.licenseTerms.sha256,
      ...source.licenseEvidence.map((entry) => entry.sha256),
    ];
    for (const fragment of requiredFragments) {
      assert(provenanceSection.includes(fragment), `bundle provenance for ${source.id} lacks ${fragment}`);
    }
    for (const originLine of licenseTermsOriginLines(source)) {
      assert(provenanceSection.includes(originLine), `bundle provenance for ${source.id} lacks exact origin line ${originLine}`);
    }
    assert(inputSection.includes(source.licenseTerms.path) && inputSection.includes(source.licenseTerms.sha256), `bundle generation inputs lack ${source.id} license terms`);
    assert(inventorySection.includes(`\`${source.id}\``) && inventorySection.includes(`\`${source.revision}\``) && inventorySection.includes(source.licenseTerms.sha256), `bundle inventory lacks ${source.id}`);
    const termsText = Buffer.from(source.licenseTerms.contentBase64, 'base64').toString('utf8');
    assert(evidenceSection.includes(`### \`${source.licenseTerms.sha256}\``), `bundle evidence lacks ${source.id} terms heading`);
    assert(evidenceSection.includes(termsText), `bundle evidence lacks ${source.id} exact license terms`);
  }
  const { contentBase64, ...descriptor } = bundleFile;
  bundle = descriptor;
}

const report = {
  schemaVersion: 1,
  ok: true,
  issues: [],
  tool: (() => {
    const { contentBase64, ...descriptor } = fileEvidence(__filename, path.basename(__filename));
    return descriptor;
  })(),
  manifest: manifestFile,
  sourceCount: scannedSources.length,
  sources: scannedSources,
  ...(bundle ? { bundle } : {}),
};
let outputSha256 = '';
if (args.output) {
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  outputSha256 = sha256(fs.readFileSync(args.output));
}
console.log(JSON.stringify({
  output: args.output || null,
  outputSha256: outputSha256 || null,
  manifestSha256: report.manifest.sha256,
  sourceCount: report.sourceCount,
  bundleValidated: Boolean(bundle),
  bundle: bundle || null,
  licenseTerms: report.sources.map((source) => ({ id: source.id, sha256: source.licenseTerms.sha256 })),
}, null, 2));
