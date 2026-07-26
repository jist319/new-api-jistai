/*
Copyright (C) 2026 JistAI contributors
SPDX-License-Identifier: AGPL-3.0-or-later
*/

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function fileHash(file) {
  const bytes = fs.readFileSync(file);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function gitBlobSha1(bytes) {
  return crypto
    .createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function decodeEvidence(entry) {
  return Buffer.from(entry.contentBase64, 'base64');
}

function licenseKind(name) {
  return /^(licen[cs]e|unlicense|copying)(\.|$)/i.test(name)
    ? 'license'
    : /^(notice|patents|copyright)(\.|$)/i.test(name)
      ? 'notice'
      : 'other';
}

function classifyText(bytes) {
  const text = bytes.toString('utf8').toLowerCase();
  if (text.includes('apache license') && text.includes('version 2.0')) return 'Apache-2.0';
  if (text.includes('mozilla public license') && text.includes('version 2.0')) return 'MPL-2.0';
  if (text.includes('permission is hereby granted, free of charge')) return 'MIT';
  if (
    text.includes('redistribution and use in source and binary forms') &&
    text.includes('neither the name')
  ) return 'BSD-3-Clause';
  if (text.includes('redistribution and use in source and binary forms')) return 'BSD-2-Clause';
  if (text.includes('permission to use, copy, modify, and/or distribute this software')) return 'ISC';
  if (text.includes('free and unencumbered software released into the public domain')) return 'Unlicense';
  if (text.includes('sil open font license')) return 'OFL-1.1';
  if (text.includes('creative commons zero')) return 'CC0-1.0';
  if (text.includes('blue oak model license')) return 'BlueOak-1.0.0';
  if (text.includes('gnu lesser general public license')) return 'LGPL';
  if (text.includes('gnu general public license')) return 'GPL';
  if (text.includes('zlib license')) return 'Zlib';
  return '';
}

const knownSpdx = new Set([
  '0BSD',
  'AFL-2.1',
  'Apache-2.0',
  'Artistic-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSD-3-Clause-Clear',
  'BSD-4-Clause',
  'BSL-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'CC0-1.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'ISC',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0-only',
  'MIT',
  'MIT-0',
  'MPL-2.0',
  'OFL-1.1',
  'Python-2.0',
  'Unicode-3.0',
  'Unicode-DFS-2016',
  'Unlicense',
  'WTFPL',
  'Zlib',
]);

const expectedVendoredSources = {
  'shadcn-ui-agent-skill': {
    revision: '56161142f1b83f612462772d18883807b5f0d601',
    localTreeGitSha1: '7b461768b2dc12897a411e49d7d10a6f5e87dafd',
    licenseTermsSha256: '1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f',
    licenseTermsLocalGitBlobSha1: 'fad4d887a681dd49233e5ed01ee2c7a1513089a0',
    licenseTermsOrigin: {
      type: 'upstream-exact',
      sourcePath: 'LICENSE.md',
      sourceGitBlobSha1: 'fad4d887a681dd49233e5ed01ee2c7a1513089a0',
      sourceSha256: '1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f',
    },
  },
  'vercel-react-best-practices': {
    revision: 'e1f1e7b0c43f2065754cdb7a66897f0c3e8278ff',
    localTreeGitSha1: '71600b94d46e8ad1cec42502be000f038d5d514b',
    licenseTermsSha256: 'c3a2d1fcb3468bdfc06f3a8b29d1914e6a0b9e8635b2f60a849ed980aa99146f',
    licenseTermsLocalGitBlobSha1: 'a7dc2993e184dd879dde90e4e387ea8b4b0aa896',
    licenseTermsOrigin: {
      type: 'locally-assembled-standard-text',
      sourcePaths: ['README.md', 'skills/react-best-practices/SKILL.md'],
      note: 'Pinned source declares MIT but provides no standalone terms file; the local file reproduces standard MIT terms and preserves source attribution without inventing a copyright line.',
    },
  },
};

function validateSpdx(expression) {
  if (!expression) return false;
  const normalized = expression
    .replace(/[()]/g, ' ')
    .replace(/\b(?:AND|OR|WITH)\b/g, ' ')
    .trim();
  const ids = normalized.split(/\s+/).filter(Boolean);
  return ids.length > 0 && ids.every((identifier) => knownSpdx.has(identifier));
}

function markdownCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
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
      `License terms origin note: ${markdownCell(origin.note)}`,
    ];
  }
  throw new Error(`unsupported license terms origin ${origin.type || '(missing)'}`);
}

function fencedText(text) {
  const matches = text.match(/`+/g) || [];
  const longest = matches.reduce((max, value) => Math.max(max, value.length), 0);
  const fence = '`'.repeat(Math.max(4, longest + 1));
  const body = text.endsWith('\n') ? text : `${text}\n`;
  return `${fence}text\n${body}${fence}`;
}

const args = parseArgs(process.argv.slice(2));
for (const required of ['go', 'default', 'classic', 'electron', 'vendored', 'vendored-scanner', 'overrides', 'output', 'report', 'requirements']) {
  if (!args[required]) throw new Error(`missing --${required}`);
}

const inputs = {
  go: readJson(args.go),
  default: readJson(args.default),
  classic: readJson(args.classic),
  electron: readJson(args.electron),
  vendored: readJson(args.vendored),
};
const overrideDocument = readJson(args.overrides);
const overrides = overrideDocument.packages || {};
const issues = [];
const warnings = [];
const evidenceGaps = [];
const usedOverrides = new Set();
const exactOverrides = new Map();
const inventory = [];
const evidenceByHash = new Map();
const vendoredSources = [];

function addEvidence(bytes, descriptor) {
  const digest = sha256(bytes);
  const existing = evidenceByHash.get(digest) || {
    sha256: digest,
    bytes: bytes.length,
    contentBase64: bytes.toString('base64'),
    kinds: new Set(),
    sources: new Set(),
  };
  if (existing.bytes !== bytes.length || existing.contentBase64 !== bytes.toString('base64')) {
    issues.push(`SHA-256 collision or inconsistent content for ${digest}`);
  }
  existing.kinds.add(descriptor.kind);
  existing.sources.add(descriptor.source);
  evidenceByHash.set(digest, existing);
  return digest;
}

function validatedOverride(key) {
  const override = overrides[key];
  if (!override) return null;
  const required = [
    'licenseExpression',
    'source',
    'attribution',
    'provenance',
    'packageIntegrity',
    'licenseText',
    'licenseTextSha256',
  ];
  for (const field of required) {
    if (!override[field] || typeof override[field] !== 'string') {
      issues.push(`override ${key} lacks ${field}`);
    }
  }
  if (override.source && !override.source.startsWith('https://')) {
    issues.push(`override ${key} source is not HTTPS`);
  }
  if (
    !Array.isArray(override.canonicalLicenseSources) ||
    !override.canonicalLicenseSources.length ||
    override.canonicalLicenseSources.some(
      (source) => typeof source !== 'string' || !source.startsWith('https://'),
    )
  ) {
    issues.push(`override ${key} lacks canonical HTTPS license sources`);
  }
  if (override.licenseExpression && !validateSpdx(override.licenseExpression)) {
    issues.push(`override ${key} has unknown SPDX expression ${override.licenseExpression}`);
  }
  if (override.licenseText) {
    const actual = sha256(Buffer.from(override.licenseText, 'utf8'));
    if (actual !== override.licenseTextSha256) {
      issues.push(`override ${key} licenseTextSha256 mismatch: expected ${actual}`);
    }
  }
  usedOverrides.add(key);
  return override;
}

function addNodeArea(areaName, report) {
  if (report.schemaVersion !== 1) issues.push(`${areaName} node report schema mismatch`);
  if (report.unresolved.length) issues.push(`${areaName} has ${report.unresolved.length} unresolved dependencies`);
  if (report.explicitLockSources.length) issues.push(`${areaName} has ${report.explicitLockSources.length} non-registry lock sources`);
  for (const dependency of report.inventory) {
    const key = `${dependency.name}@${dependency.version}`;
    if (dependency.variantMismatch) issues.push(`${areaName} ${key} has package-content variants`);
    if (!dependency.integrities.length) {
      issues.push(`${areaName} ${key} lacks lock integrity`);
      evidenceGaps.push({ area: areaName, package: key, type: 'missing-lock-integrity' });
    }
    const licenseFiles = dependency.evidence.filter((entry) => licenseKind(entry.name) === 'license');
    const override = validatedOverride(key);
    let expression = dependency.licenseExpression;
    if (!expression && licenseFiles.length) {
      const inferred = [...new Set(licenseFiles.map((entry) => classifyText(decodeEvidence(entry))).filter(Boolean))];
      if (inferred.length === 1) expression = inferred[0];
    }
    if (override) {
      if (expression && expression !== override.licenseExpression) {
        issues.push(`${areaName} ${key} override expression ${override.licenseExpression} differs from manifest ${expression}`);
      }
      expression = override.licenseExpression;
      if (!dependency.integrities.includes(override.packageIntegrity)) {
        issues.push(`${areaName} ${key} override integrity does not match the lock`);
      }
      const exact = exactOverrides.get(key) || {
        package: key,
        areas: new Set(),
        licenseExpression: override.licenseExpression,
        packageIntegrity: override.packageIntegrity,
        source: override.source,
        canonicalLicenseSources: override.canonicalLicenseSources,
        attribution: override.attribution,
        provenance: override.provenance,
        licenseTextSha256: override.licenseTextSha256,
      };
      exact.areas.add(areaName);
      exactOverrides.set(key, exact);
    }
    if (!expression) {
      issues.push(`${areaName} ${key} lacks license metadata and a classifiable license file`);
      evidenceGaps.push({ area: areaName, package: key, type: 'missing-license-metadata' });
    } else if (!validateSpdx(expression)) {
      issues.push(`${areaName} ${key} has unknown license expression ${expression}`);
      evidenceGaps.push({ area: areaName, package: key, type: 'unknown-license-expression', value: expression });
    }
    if (!licenseFiles.length && !override) {
      issues.push(`${areaName} ${key} has no license file or exact override`);
      evidenceGaps.push({
        area: areaName,
        package: key,
        type: 'missing-license-file-and-override',
        declaredLicense: dependency.licenseExpression,
        author: dependency.author,
        maintainers: dependency.maintainers,
        contributors: dependency.contributors,
        repository: dependency.repository,
        homepage: dependency.homepage,
        gitHead: dependency.gitHead,
        provenanceFiles: (dependency.provenanceFiles || []).map(
          ({ contentBase64, ...entry }) => entry,
        ),
      });
    }

    const evidenceHashes = [];
    for (const evidence of dependency.evidence) {
      const bytes = decodeEvidence(evidence);
      const actual = sha256(bytes);
      if (actual !== evidence.sha256 || bytes.length !== evidence.bytes) {
        issues.push(`${areaName} ${key} evidence mismatch for ${evidence.name}`);
        continue;
      }
      evidenceHashes.push(
        addEvidence(bytes, {
          kind: licenseKind(evidence.name),
          source: `${areaName}:${key}:${evidence.name}`,
        }),
      );
    }
    if (override && override.licenseText) {
      evidenceHashes.push(
        addEvidence(Buffer.from(override.licenseText, 'utf8'), {
          kind: 'license',
          source: `${areaName}:${key}:override:${override.source}`,
        }),
      );
    }
    inventory.push({
      area: areaName,
      ecosystem: 'npm',
      name: dependency.name,
      version: dependency.version,
      relationship: dependency.relationships.some((value) => value.startsWith('direct:')) ? 'direct' : 'transitive',
      license: expression || '(missing)',
      integrity: dependency.integrities.join(', '),
      evidenceHashes: [...new Set(evidenceHashes)].sort(),
      overrideSource: override?.source || '',
    });

    if (dependency.name === 'electron') {
      const dist = new Map((dependency.distributionEvidence || []).map((entry) => [entry.name, entry]));
      for (const requiredName of ['dist/LICENSE', 'dist/LICENSES.chromium.html']) {
        const evidence = dist.get(requiredName);
        if (!evidence) issues.push(`${areaName} ${key} lacks ${requiredName}`);
      }
    }
  }
}

function assertVendored(condition, message) {
  if (!condition) throw new Error(`vendored evidence: ${message}`);
}

function assertEmbeddedFileEvidence(value, context) {
  const expectedKeys = ['bytes', 'contentBase64', 'gitBlobSha1', 'path', 'sha256'];
  assertVendored(value && typeof value === 'object' && !Array.isArray(value), `${context} must be an object`);
  assertVendored(JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expectedKeys), `${context} fields changed`);
  assertVendored(typeof value.path === 'string' && value.path.length > 0, `${context} path is empty`);
  assertVendored(Number.isInteger(value.bytes) && value.bytes > 0, `${context} byte count is invalid`);
  assertVendored(/^[0-9a-f]{64}$/.test(value.sha256), `${context} SHA-256 is invalid`);
  assertVendored(/^[0-9a-f]{40}$/.test(value.gitBlobSha1), `${context} Git blob is invalid`);
  assertVendored(typeof value.contentBase64 === 'string', `${context} contentBase64 is invalid`);
  assertVendored(Buffer.from(value.contentBase64, 'base64').toString('base64') === value.contentBase64, `${context} contentBase64 is not canonical`);
}

function addVendoredSources(report) {
  const expectedReportKeys = ['issues', 'manifest', 'ok', 'schemaVersion', 'sourceCount', 'sources', 'tool'];
  assertVendored(JSON.stringify(Object.keys(report).sort()) === JSON.stringify(expectedReportKeys), 'scanner report fields changed');
  assertVendored(report.schemaVersion === 1, 'schemaVersion must be 1');
  assertVendored(report.ok === true, 'scanner report is not clean');
  assertVendored(Array.isArray(report.issues) && report.issues.length === 0, 'scanner issues are present');
  assertVendored(report.sourceCount === 2, 'sourceCount must be 2');
  assertVendored(Array.isArray(report.sources) && report.sources.length === 2, 'sources must contain exactly two entries');
  const scannerBytes = fs.readFileSync(args['vendored-scanner']);
  const scannerTool = {
    path: path.basename(args['vendored-scanner']),
    bytes: scannerBytes.length,
    sha256: sha256(scannerBytes),
    gitBlobSha1: gitBlobSha1(scannerBytes),
  };
  assertVendored(scannerTool.path === 'scan-vendored-sources.cjs', 'scanner basename changed');
  assertVendored(JSON.stringify(report.tool) === JSON.stringify(scannerTool), 'scanner tool evidence mismatch');
  assertEmbeddedFileEvidence(report.manifest, 'manifest evidence');
  assertVendored(report.manifest?.path === 'VENDORED-SOURCES.json', 'manifest path changed');
  assertVendored(report.manifest?.sha256 === '3e94ffaf425530e7b6928013a41732bcd2720a2e45774f291fc20a77ff8d5bc0', 'manifest SHA-256 changed');
  const manifestBytes = Buffer.from(report.manifest.contentBase64 || '', 'base64');
  assertVendored(manifestBytes.length === report.manifest.bytes, 'manifest byte count mismatch');
  assertVendored(sha256(manifestBytes) === report.manifest.sha256, 'manifest content hash mismatch');
  assertVendored(gitBlobSha1(manifestBytes) === report.manifest.gitBlobSha1, 'manifest Git blob mismatch');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assertVendored(manifest.schemaVersion === 1 && Array.isArray(manifest.sources) && manifest.sources.length === 2, 'manifest content schema mismatch');

  const seen = new Set();
  for (const source of report.sources) {
    const expected = expectedVendoredSources[source.id];
    assertVendored(expected, `unexpected source ${source.id}`);
    assertVendored(!seen.has(source.id), `duplicate source ${source.id}`);
    seen.add(source.id);
    assertVendored(source.revision === expected.revision, `${source.id} revision changed`);
    assertVendored(source.localTreeGitSha1 === expected.localTreeGitSha1, `${source.id} local tree changed`);
    assertVendored(source.licenseExpression === 'MIT' && validateSpdx(source.licenseExpression), `${source.id} license is not MIT`);
    assertVendored(typeof source.repository === 'string' && source.repository.startsWith('https://github.com/'), `${source.id} repository is not GitHub HTTPS`);
    assertVendored(typeof source.attribution === 'string' && source.attribution.length > 0, `${source.id} attribution is empty`);
    assertVendored(Array.isArray(source.licenseEvidence) && source.licenseEvidence.length > 0, `${source.id} lacks upstream license evidence`);
    assertVendored(Array.isArray(source.localModifications) && source.localModifications.length > 0, `${source.id} lacks local modifications`);

    const manifestSource = manifest.sources.find((entry) => entry.id === source.id);
    assertVendored(manifestSource, `${source.id} is absent from manifest content`);
    const expectedManifestSourceKeys = [
      'attribution', 'commitTreeGitSha1', 'id', 'licenseEvidence', 'licenseExpression',
      'licenseTermsFile', 'licenseTermsLocalGitBlobSha1', 'licenseTermsOrigin',
      'licenseTermsSha256', 'localModifications', 'localPath', 'localTreeGitSha1',
      'name', 'repository', 'revision', 'sourcePath', 'sourceTreeGitSha1',
      ...(Object.hasOwn(manifestSource, 'sourceLicenseNote') ? ['sourceLicenseNote'] : []),
      ...(Object.hasOwn(manifestSource, 'copiedContent') ? ['copiedContent'] : []),
    ].sort();
    assertVendored(JSON.stringify(Object.keys(manifestSource).sort()) === JSON.stringify(expectedManifestSourceKeys), `${source.id} manifest fields changed`);
    const expectedSourceKeys = [
      'attribution', 'commitTreeGitSha1', 'id', 'licenseEvidence', 'licenseExpression',
      'licenseTerms', 'licenseTermsOrigin', 'localModifications', 'localPath',
      'localTreeGitSha1', 'name', 'repository', 'revision', 'sourcePath',
      'sourceTreeGitSha1',
      ...(Object.hasOwn(manifestSource, 'sourceLicenseNote') ? ['sourceLicenseNote'] : []),
      ...(Object.hasOwn(manifestSource, 'copiedContent') ? ['copiedContent'] : []),
    ].sort();
    assertVendored(JSON.stringify(Object.keys(source).sort()) === JSON.stringify(expectedSourceKeys), `${source.id} scanner fields changed`);
    for (const field of ['id', 'name', 'repository', 'revision', 'commitTreeGitSha1', 'sourcePath', 'sourceTreeGitSha1', 'localPath', 'localTreeGitSha1', 'licenseExpression', 'attribution']) {
      assertVendored(source[field] === manifestSource[field], `${source.id} ${field} differs from manifest content`);
    }
    assertVendored(JSON.stringify(source.licenseEvidence) === JSON.stringify(manifestSource.licenseEvidence), `${source.id} licenseEvidence differs from manifest content`);
    assertVendored(JSON.stringify(source.licenseTermsOrigin) === JSON.stringify(manifestSource.licenseTermsOrigin), `${source.id} licenseTermsOrigin differs from manifest content`);
    assertVendored(JSON.stringify(source.licenseTermsOrigin) === JSON.stringify(expected.licenseTermsOrigin), `${source.id} licenseTermsOrigin changed`);
    assertVendored(JSON.stringify(source.localModifications) === JSON.stringify(manifestSource.localModifications), `${source.id} localModifications differs from manifest content`);
    assertVendored(source.sourceLicenseNote === manifestSource.sourceLicenseNote, `${source.id} sourceLicenseNote differs from manifest content`);
    if (manifestSource.copiedContent) {
      const { bytes, ...copiedContent } = source.copiedContent || {};
      assertVendored(Number.isInteger(bytes) && bytes > 0, `${source.id} copiedContent byte count is invalid`);
      assertVendored(JSON.stringify(copiedContent) === JSON.stringify(manifestSource.copiedContent), `${source.id} copiedContent differs from manifest content`);
    } else {
      assertVendored(!source.copiedContent, `${source.id} has unexpected copiedContent`);
    }

    const terms = source.licenseTerms;
    assertEmbeddedFileEvidence(terms, `${source.id} license terms evidence`);
    assertVendored(terms?.sha256 === expected.licenseTermsSha256, `${source.id} license terms hash changed`);
    assertVendored(terms.path === manifestSource.licenseTermsFile, `${source.id} license terms path differs from manifest`);
    const termsBytes = Buffer.from(terms.contentBase64 || '', 'base64');
    assertVendored(termsBytes.length === terms.bytes, `${source.id} license terms byte count mismatch`);
    assertVendored(sha256(termsBytes) === terms.sha256, `${source.id} license terms SHA-256 mismatch`);
    assertVendored(gitBlobSha1(termsBytes) === terms.gitBlobSha1, `${source.id} license terms Git blob mismatch`);
    assertVendored(terms.sha256 === manifestSource.licenseTermsSha256, `${source.id} terms hash differs from manifest`);
    assertVendored(terms.gitBlobSha1 === manifestSource.licenseTermsLocalGitBlobSha1, `${source.id} local terms Git blob differs from manifest`);
    assertVendored(terms.gitBlobSha1 === expected.licenseTermsLocalGitBlobSha1, `${source.id} local terms Git blob changed`);

    const evidenceHash = addEvidence(termsBytes, {
      kind: 'license',
      source: `vendored/source:${source.id}:${terms.path}`,
    });
    inventory.push({
      area: 'vendored/source',
      ecosystem: 'source',
      name: manifestSource.id,
      version: manifestSource.revision,
      relationship: 'vendored',
      license: manifestSource.licenseExpression,
      integrity: [
        `commit-tree:${manifestSource.commitTreeGitSha1}`,
        `source-tree:${manifestSource.sourceTreeGitSha1}`,
        `local-tree:${manifestSource.localTreeGitSha1}`,
        `terms:${terms.sha256}`,
      ].join('; '),
      evidenceHashes: [evidenceHash],
      overrideSource: '',
    });
    const { contentBase64, ...licenseTerms } = terms;
    vendoredSources.push({
      id: manifestSource.id,
      name: manifestSource.name,
      repository: manifestSource.repository,
      revision: manifestSource.revision,
      commitTreeGitSha1: manifestSource.commitTreeGitSha1,
      sourcePath: manifestSource.sourcePath,
      sourceTreeGitSha1: manifestSource.sourceTreeGitSha1,
      localPath: manifestSource.localPath,
      localTreeGitSha1: manifestSource.localTreeGitSha1,
      licenseExpression: manifestSource.licenseExpression,
      attribution: manifestSource.attribution,
      ...(manifestSource.sourceLicenseNote ? { sourceLicenseNote: manifestSource.sourceLicenseNote } : {}),
      licenseEvidence: manifestSource.licenseEvidence,
      licenseTerms,
      licenseTermsOrigin: manifestSource.licenseTermsOrigin,
      ...(manifestSource.copiedContent ? { copiedContent: source.copiedContent } : {}),
      localModifications: manifestSource.localModifications,
    });
  }
  assertVendored(Object.keys(expectedVendoredSources).every((id) => seen.has(id)), 'an expected source is missing');
}

if (inputs.go.schemaVersion !== 1) issues.push('Go report schema mismatch');
if (inputs.go.requirementCount !== inputs.go.downloadedCount) {
  issues.push(`Go report count mismatch ${inputs.go.requirementCount}/${inputs.go.downloadedCount}`);
}
if (inputs.go.withoutEvidence.length) issues.push(`Go has ${inputs.go.withoutEvidence.length} modules without classified license evidence`);
for (const module of inputs.go.modules) {
  const key = `${module.path}@${module.version}`;
  if (module.error) issues.push(`Go ${key} download error: ${module.error}`);
  if (!module.sum || !module.goModSum) issues.push(`Go ${key} lacks module integrity`);
  const licenseFiles = module.evidence.filter((entry) => entry.kind === 'license' && entry.classification !== 'unclassified');
  const expression = [...new Set(licenseFiles.map((entry) => entry.classification))].sort().join(' OR ');
  const evidenceHashes = [];
  for (const evidence of module.evidence) {
    const bytes = decodeEvidence(evidence);
    const actual = sha256(bytes);
    if (actual !== evidence.sha256 || bytes.length !== evidence.bytes) {
      issues.push(`Go ${key} evidence mismatch for ${evidence.name}`);
      continue;
    }
    evidenceHashes.push(
      addEvidence(bytes, {
        kind: evidence.kind,
        source: `backend:${key}:${evidence.name}`,
      }),
    );
  }
  inventory.push({
    area: 'backend',
    ecosystem: 'Go',
    name: module.path,
    version: module.version,
    relationship: module.indirect ? 'transitive' : 'direct',
    license: expression || '(missing)',
    integrity: `${module.sum}; ${module.goModSum}`,
    evidenceHashes: [...new Set(evidenceHashes)].sort(),
    overrideSource: '',
  });
}

addNodeArea('web/default', inputs.default);
addNodeArea('web/classic', inputs.classic);
addNodeArea('electron/build', inputs.electron);
addVendoredSources(inputs.vendored);

const prohibited = new Set(['@lobehub/icons', '@lobehub/ui', '@splinetool/runtime']);
for (const dependency of inventory) {
  if (prohibited.has(dependency.name)) issues.push(`prohibited package remains: ${dependency.area}:${dependency.name}@${dependency.version}`);
}
for (const area of ['web/default', 'web/classic']) {
  const staticPackages = inventory.filter(
    (entry) => entry.area === area && entry.name === '@lobehub/icons-static-svg',
  );
  if (staticPackages.length !== 1 || staticPackages[0].version !== '1.94.0') {
    issues.push(`${area} must contain exactly @lobehub/icons-static-svg@1.94.0`);
  }
}
for (const key of Object.keys(overrides).sort()) {
  if (!usedOverrides.has(key)) issues.push(`unused override ${key}`);
}

const areaOrder = new Map([
  ['backend', 0],
  ['web/default', 1],
  ['web/classic', 2],
  ['electron/build', 3],
  ['vendored/source', 4],
]);
inventory.sort((left, right) =>
  (areaOrder.get(left.area) - areaOrder.get(right.area)) ||
  `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`, 'en'),
);

const evidence = [...evidenceByHash.values()]
  .map((entry) => ({
    sha256: entry.sha256,
    bytes: entry.bytes,
    contentBase64: entry.contentBase64,
    kinds: [...entry.kinds].sort(),
    sources: [...entry.sources].sort(),
  }))
  .sort((left, right) => left.sha256.localeCompare(right.sha256, 'en'));
const inputFiles = [
  ...[args.go, args.default, args.classic, args.electron, args.vendored, args['vendored-scanner'], args.overrides, __filename]
    .map((file) => ({ path: path.basename(file), ...fileHash(file) })),
  {
    path: inputs.vendored.manifest.path,
    bytes: inputs.vendored.manifest.bytes,
    sha256: inputs.vendored.manifest.sha256,
  },
  ...inputs.vendored.sources.map((source) => ({
    path: source.licenseTerms.path,
    bytes: source.licenseTerms.bytes,
    sha256: source.licenseTerms.sha256,
  })),
].sort((left, right) => left.path.localeCompare(right.path, 'en'));
const report = {
  schemaVersion: 1,
  ok: issues.length === 0,
  issues: [...new Set(issues)].sort(),
  warnings: [...new Set(warnings)].sort(),
  evidenceGaps: evidenceGaps.sort((left, right) =>
    `${left.area}:${left.package}:${left.type}`.localeCompare(
      `${right.area}:${right.package}:${right.type}`,
      'en',
    ),
  ),
  overrides: {
    configured: Object.keys(overrides).sort(),
    used: [...usedOverrides].sort(),
  },
  exactOverrides: [...exactOverrides.values()]
    .map((entry) => ({ ...entry, areas: [...entry.areas].sort() }))
    .sort((left, right) => left.package.localeCompare(right.package, 'en')),
  inputs: inputFiles,
  counts: {
    inventoryRows: inventory.length,
    uniqueCoordinates: new Set(inventory.map((entry) => `${entry.ecosystem}:${entry.name}@${entry.version}`)).size,
    evidenceTexts: evidence.length,
    overridesUsed: usedOverrides.size,
  },
  inventory,
  evidence: evidence.map(({ contentBase64, ...entry }) => entry),
  vendoredSources,
};
const requirementMap = new Map();
for (const gap of report.evidenceGaps.filter((entry) => entry.type === 'missing-license-file-and-override')) {
  const existing = requirementMap.get(gap.package) || {
    package: gap.package,
    areas: new Set(),
    declaredLicense: gap.declaredLicense,
    authors: new Set(),
    maintainers: new Set(),
    contributors: new Set(),
    repositories: new Set(),
    homepages: new Set(),
    sourceRevisions: new Set(),
    provenanceFiles: new Map(),
  };
  existing.areas.add(gap.area);
  if (gap.author) existing.authors.add(gap.author);
  for (const maintainer of gap.maintainers || []) existing.maintainers.add(maintainer);
  for (const contributor of gap.contributors || []) existing.contributors.add(contributor);
  if (gap.repository) existing.repositories.add(gap.repository);
  if (gap.homepage) existing.homepages.add(gap.homepage);
  if (gap.gitHead) existing.sourceRevisions.add(gap.gitHead);
  for (const provenance of gap.provenanceFiles || []) {
    existing.provenanceFiles.set(`${provenance.name}:${provenance.sha256}`, provenance);
  }
  requirementMap.set(gap.package, existing);
}
const requiredOverrides = [...requirementMap.values()]
  .map((entry) => {
    const splitAt = entry.package.lastIndexOf('@');
    const packageName = entry.package.slice(0, splitAt);
    const version = entry.package.slice(splitAt + 1);
    return {
      package: entry.package,
      areas: [...entry.areas].sort(),
      declaredLicense: entry.declaredLicense,
      authors: [...entry.authors].sort(),
      maintainers: [...entry.maintainers].sort(),
      contributors: [...entry.contributors].sort(),
      repositories: [...entry.repositories].sort(),
      homepages: [...entry.homepages].sort(),
      sourceRevisions: [...entry.sourceRevisions].sort(),
      provenanceFiles: [...entry.provenanceFiles.values()].sort((left, right) =>
        `${left.name}:${left.sha256}`.localeCompare(`${right.name}:${right.sha256}`, 'en'),
      ),
      exactRegistryMetadata: `https://registry.npmjs.org/${packageName.replace('/', '%2f')}/${version}`,
      requiredOverrideFields: [
        'licenseExpression',
        'source',
        'attribution',
        'licenseText',
        'licenseTextSha256',
      ],
    };
  })
  .sort((left, right) => left.package.localeCompare(right.package, 'en'));
const requirementDocument = {
  schemaVersion: 1,
  purpose: 'Exact package overrides required because the installed package contains no top-level license file.',
  packageCount: requiredOverrides.length,
  packages: requiredOverrides,
};
fs.mkdirSync(path.dirname(args.requirements), { recursive: true });
fs.writeFileSync(args.requirements, `${JSON.stringify(requirementDocument, null, 2)}\n`, 'utf8');
report.overrideRequirements = {
  path: path.basename(args.requirements),
  ...fileHash(args.requirements),
  packageCount: requiredOverrides.length,
};
fs.mkdirSync(path.dirname(args.report), { recursive: true });
fs.writeFileSync(args.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (issues.length) {
  if (fs.existsSync(args.output)) fs.rmSync(args.output);
  console.error(JSON.stringify({ ok: false, report: args.report, reportSha256: fileHash(args.report).sha256, issueCount: report.issues.length }, null, 2));
  process.exit(1);
}

const lines = [
  '# Third-Party Licenses',
  '',
  'This file is generated deterministically from the locked Go, web, and Electron dependency closures and the pinned vendored-source manifest.',
  'It must be distributed with Docker images, standalone binaries, frontend bundles, and Electron installers.',
  '',
  '## Generation Inputs',
  '',
  '| Input | Bytes | SHA-256 |',
  '|---|---:|---|',
  ...inputFiles.map((entry) => `| \`${markdownCell(entry.path)}\` | ${entry.bytes} | \`${entry.sha256}\` |`),
  '',
  '## Dependency Inventory',
  '',
  '| Area | Scope | Ecosystem | Dependency | Version | License | Integrity | Evidence |',
  '|---|---|---|---|---|---|---|---|',
  ...inventory.map((entry) =>
    `| ${markdownCell(entry.area)} | ${markdownCell(entry.relationship)} | ${markdownCell(entry.ecosystem)} | \`${markdownCell(entry.name)}\` | \`${markdownCell(entry.version)}\` | ${markdownCell(entry.license)} | \`${markdownCell(entry.integrity)}\` | ${entry.evidenceHashes.map((hash) => `\`${hash}\``).join('<br>')} |`,
  ),
  '',
];

lines.push('## Vendored Source Provenance', '');
for (const source of report.vendoredSources) {
  lines.push(
    `### \`${source.id}\``,
    '',
    `Name: ${markdownCell(source.name)}`,
    '',
    `Repository: ${source.repository}`,
    '',
    `Pinned revision: \`${source.revision}\``,
    '',
    `Commit tree Git SHA-1: \`${source.commitTreeGitSha1}\``,
    '',
    `Upstream source: \`${source.sourcePath}\` at tree \`${source.sourceTreeGitSha1}\``,
    '',
    `Local source: \`${source.localPath}\` at tree \`${source.localTreeGitSha1}\``,
    '',
    `License: \`${source.licenseExpression}\``,
    '',
    `Attribution: ${markdownCell(source.attribution)}`,
    '',
  );
  if (source.sourceLicenseNote) lines.push(`Source license note: ${markdownCell(source.sourceLicenseNote)}`, '');
  lines.push(...licenseTermsOriginLines(source), '');
  lines.push(
    `License terms: \`${source.licenseTerms.path}\` (${source.licenseTerms.bytes} bytes, SHA-256 \`${source.licenseTerms.sha256}\`, Git blob \`${source.licenseTerms.gitBlobSha1}\`)`,
    '',
    'Upstream license evidence:',
    '',
    ...source.licenseEvidence.map((entry) =>
      `- \`${entry.sourcePath}\`: ${entry.sourceUrl}; Git blob \`${entry.gitBlobSha1}\`; SHA-256 \`${entry.sha256}\`${entry.assertion ? `; ${markdownCell(entry.assertion)}` : ''}`,
    ),
    '',
  );
  if (source.copiedContent) {
    lines.push(
      `Copied content: \`${source.copiedContent.localPath}\` from \`${source.copiedContent.sourcePath}\` (${source.copiedContent.bytes} bytes, Git blob \`${source.copiedContent.gitBlobSha1}\`, SHA-256 \`${source.copiedContent.sha256}\`)`,
      '',
    );
  }
  lines.push('Local modifications:', '', ...source.localModifications.map((entry) => `- ${markdownCell(entry)}`), '');
}

lines.push('## Electron Distribution Evidence', '');

for (const dependency of inputs.electron.inventory.filter((entry) => entry.name === 'electron')) {
  for (const entry of dependency.distributionEvidence || []) {
    lines.push(`- \`electron@${dependency.version}/${entry.name}\`: ${entry.bytes} bytes, SHA-256 \`${entry.sha256}\`${entry.packagedSeparately ? ' (distributed as a separate license artifact)' : ''}`);
  }
}
lines.push('', '## Exact Package Overrides', '');
for (const entry of report.exactOverrides) {
  lines.push(
    `### \`${entry.package}\``,
    '',
    `Areas: ${entry.areas.map((area) => `\`${area}\``).join(', ')}`,
    '',
    `Declared license: \`${entry.licenseExpression}\``,
    '',
    `Package integrity: \`${entry.packageIntegrity}\``,
    '',
    `Exact package metadata: ${entry.source}`,
    '',
    `Canonical license source(s): ${entry.canonicalLicenseSources.join(', ')}`,
    '',
    `Attribution: ${entry.attribution}`,
    '',
    `Provenance: ${entry.provenance}`,
    '',
    `Embedded license-text SHA-256: \`${entry.licenseTextSha256}\``,
    '',
  );
}
lines.push('', '## License And Notice Texts', '');
for (const entry of evidence) {
  lines.push(
    `### \`${entry.sha256}\``,
    '',
    `Kinds: ${entry.kinds.join(', ')}`,
    '',
    'Used by:',
    '',
    ...entry.sources.map((source) => `- \`${source}\``),
    '',
    fencedText(Buffer.from(entry.contentBase64, 'base64').toString('utf8')),
    '',
  );
}
const markdown = `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
fs.mkdirSync(path.dirname(args.output), { recursive: true });
fs.writeFileSync(args.output, markdown, 'utf8');
report.output = { path: path.basename(args.output), ...fileHash(args.output) };
fs.writeFileSync(args.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(
  JSON.stringify(
    {
      ok: true,
      output: args.output,
      outputSha256: report.output.sha256,
      report: args.report,
      reportSha256: fileHash(args.report).sha256,
      counts: report.counts,
    },
    null,
    2,
  ),
);
