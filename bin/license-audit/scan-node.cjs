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

function readBytes(file) {
  return fs.readFileSync(file);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function fileDigest(file) {
  const bytes = readBytes(file);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function normalizeRepository(repository) {
  if (typeof repository === 'string') return repository;
  if (repository && typeof repository.url === 'string') return repository.url;
  return '';
}

function normalizePerson(person) {
  if (typeof person === 'string') return person;
  if (!person || typeof person !== 'object') return '';
  return [person.name, person.email, person.url].filter(Boolean).join(' | ');
}

function normalizeLicense(license) {
  if (typeof license === 'string') return license.trim();
  if (!license) return '';
  return JSON.stringify(license);
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

function realPathInside(root, candidate, context) {
  const real = fs.realpathSync(candidate);
  if (!isInside(root, real)) {
    throw new Error(`${context} resolves outside the install root`);
  }
  return real;
}

function regularFileInside(root, candidate, context) {
  const real = realPathInside(root, candidate, context);
  if (!fs.statSync(real).isFile()) {
    throw new Error(`${context} must be a regular file`);
  }
  return real;
}

function resolvePackage(fromDirectory, dependencyName, installRoot) {
  let current = realPathInside(installRoot, fromDirectory, `resolver start for ${dependencyName}`);
  while (true) {
    const candidate = path.join(current, 'node_modules', dependencyName);
    const packageJson = path.join(candidate, 'package.json');
    if (fs.existsSync(packageJson)) {
      const realCandidate = realPathInside(
        installRoot,
        candidate,
        `package ${dependencyName}`,
      );
      if (!fs.statSync(realCandidate).isDirectory()) {
        throw new Error(`package ${dependencyName} is not a directory`);
      }
      regularFileInside(
        realCandidate,
        path.join(realCandidate, 'package.json'),
        `package manifest ${dependencyName}`,
      );
      return realCandidate;
    }
    if (current === installRoot) return null;
    const parent = path.dirname(current);
    if (!isInside(installRoot, parent)) return null;
    current = parent;
  }
}

function evidenceFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((name) =>
      /^(licen[cs]e|unlicense|copying|notice|patents|copyright)(\.|$)/i.test(
        name,
      ),
    )
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((name) => {
      const file = regularFileInside(
        directory,
        path.join(directory, name),
        `license evidence ${name}`,
      );
      const bytes = readBytes(file);
      return {
        name,
        bytes: bytes.length,
        sha256: sha256(bytes),
        contentBase64: bytes.toString('base64'),
      };
    });
}

function readmeFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((name) => /^readme(?:\.|$)/i.test(name))
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((name) => {
      const file = regularFileInside(
        directory,
        path.join(directory, name),
        `README evidence ${name}`,
      );
      const bytes = readBytes(file);
      return {
        name,
        bytes: bytes.length,
        sha256: sha256(bytes),
        contentBase64: bytes.toString('base64'),
      };
    });
}

function distributionEvidence(directory, packageName) {
  if (packageName !== 'electron') return [];
  const candidates = [
    ['dist/LICENSE', true],
    ['dist/LICENSES.chromium.html', false],
  ];
  return candidates
    .filter(([name]) => fs.existsSync(path.join(directory, name)))
    .map(([name, embed]) => {
      const file = regularFileInside(
        directory,
        path.join(directory, name),
        `distribution evidence ${name}`,
      );
      const bytes = readBytes(file);
      return {
        name,
        bytes: bytes.length,
        sha256: sha256(bytes),
        packagedSeparately: !embed,
        ...(embed ? { contentBase64: bytes.toString('base64') } : {}),
      };
    });
}

function loadBunIntegrity(lockPath, json5Root, installRoot) {
  if (!lockPath) return { digest: null, packages: new Map(), sources: [] };
  const json5Directory = realPathInside(
    installRoot,
    path.join(json5Root, 'json5'),
    'json5 package',
  );
  if (!fs.statSync(json5Directory).isDirectory()) {
    throw new Error('json5 package must be a directory');
  }
  const json5Entry = regularFileInside(
    json5Directory,
    require.resolve(path.join(json5Root, 'json5')),
    'json5 entry point',
  );
  const JSON5 = require(json5Entry);
  const bytes = readBytes(lockPath);
  const lock = JSON5.parse(bytes.toString('utf8'));
  const packages = new Map();
  const sources = [];
  for (const [key, value] of Object.entries(lock.packages || {})) {
    const resolution = Array.isArray(value) ? value[0] || '' : '';
    const source = Array.isArray(value) ? value[1] || '' : '';
    const integrity = Array.isArray(value) ? value[3] || '' : '';
    if (resolution && !resolution.includes('@workspace:')) {
      const record = packages.get(resolution) || { integrities: [], keys: [] };
      if (integrity && !record.integrities.includes(integrity)) {
        record.integrities.push(integrity);
      }
      record.keys.push(key);
      packages.set(resolution, record);
    }
    if (source) sources.push({ key, resolution, source });
  }
  for (const record of packages.values()) {
    record.integrities.sort();
    record.keys.sort();
  }
  sources.sort((left, right) => left.key.localeCompare(right.key, 'en'));
  return { digest: fileDigest(lockPath), packages, sources };
}

function loadPackageLockIntegrity(lockPath) {
  if (!lockPath) return { digest: null, packages: new Map(), sources: [] };
  const bytes = readBytes(lockPath);
  const lock = JSON.parse(bytes.toString('utf8'));
  const packages = new Map();
  const sources = [];
  for (const [key, value] of Object.entries(lock.packages || {})) {
    if (!key || !value || !value.version) continue;
    const name = value.name || key.replace(/^.*node_modules\//, '');
    const resolution = `${name}@${value.version}`;
    const record = packages.get(resolution) || { integrities: [], keys: [] };
    if (value.integrity && !record.integrities.includes(value.integrity)) {
      record.integrities.push(value.integrity);
    }
    record.keys.push(key);
    packages.set(resolution, record);
    if (value.resolved && !String(value.resolved).startsWith('https://registry.npmjs.org/')) {
      sources.push({ key, resolution, source: value.resolved });
    }
  }
  for (const record of packages.values()) {
    record.integrities.sort();
    record.keys.sort();
  }
  sources.sort((left, right) => left.key.localeCompare(right.key, 'en'));
  return { digest: fileDigest(lockPath), packages, sources };
}

const args = parseArgs(process.argv.slice(2));
if (!args.manifest || !args.output || !args.area) {
  throw new Error(
    'usage: node scanner --manifest PATH --output PATH --area NAME [--root-groups dependencies,optionalDependencies] [--bun-lock PATH --json5-root PATH] [--package-lock PATH]',
  );
}

const rootGroups = (args['root-groups'] || 'dependencies,optionalDependencies')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const hasBunLock = Boolean(args['bun-lock']);
const hasPackageLock = Boolean(args['package-lock']);
if (hasBunLock === hasPackageLock) {
  throw new Error('exactly one of --bun-lock or --package-lock is required');
}
if (hasBunLock && !args['json5-root']) {
  throw new Error('--json5-root is required with --bun-lock');
}
const requestedLockPath = path.resolve(
  hasBunLock ? args['bun-lock'] : args['package-lock'],
);
const installRoot = fs.realpathSync(path.dirname(requestedLockPath));
const lockPath = regularFileInside(installRoot, requestedLockPath, 'lockfile');
const manifestPath = regularFileInside(
  installRoot,
  path.resolve(args.manifest),
  'root manifest',
);
const json5Root = hasBunLock
  ? realPathInside(installRoot, path.resolve(args['json5-root']), 'json5 root')
  : null;
if (json5Root && !fs.statSync(json5Root).isDirectory()) {
  throw new Error('json5 root must be a directory');
}
const manifestBytes = readBytes(manifestPath);
const rootManifest = JSON.parse(manifestBytes.toString('utf8'));
const lockEvidence = hasBunLock
  ? loadBunIntegrity(lockPath, json5Root, installRoot)
  : loadPackageLockIntegrity(lockPath);
const packages = new Map();
const unresolved = [];
const skippedOptional = [];
const visitingDirectories = new Set();
const visitedDirectories = new Set();

function visit(dependencyName, fromDirectory, relationship, requiredBy, optional) {
  const directory = resolvePackage(fromDirectory, dependencyName, installRoot);
  if (!directory) {
    const record = { dependencyName, relationship, requiredBy };
    if (optional) skippedOptional.push(record);
    else unresolved.push(record);
    return;
  }

  const packageBytes = readBytes(path.join(directory, 'package.json'));
  const manifest = JSON.parse(packageBytes.toString('utf8'));
  if (!manifest.name || !manifest.version) {
    unresolved.push({
      dependencyName,
      relationship,
      requiredBy,
      error: 'resolved package lacks name or version',
    });
    return;
  }
  const key = `${manifest.name}@${manifest.version}`;
  const evidence = evidenceFiles(directory);
  const hasLicenseFile = evidence.some((entry) =>
    /^(licen[cs]e|unlicense|copying)(\.|$)/i.test(entry.name),
  );
  const bundledEvidence = distributionEvidence(directory, manifest.name);
  const lockRecord = lockEvidence.packages.get(key) || {
    integrities: [],
    keys: [],
  };
  const immutable = {
    name: manifest.name,
    version: manifest.version,
    licenseExpression: normalizeLicense(manifest.license),
    packageJson: { bytes: packageBytes.length, sha256: sha256(packageBytes) },
    repository: normalizeRepository(manifest.repository),
    homepage: typeof manifest.homepage === 'string' ? manifest.homepage : '',
    gitHead: typeof manifest.gitHead === 'string' ? manifest.gitHead : '',
    author: normalizePerson(manifest.author),
    maintainers: Array.isArray(manifest.maintainers)
      ? manifest.maintainers.map(normalizePerson).filter(Boolean).sort()
      : [],
    contributors: Array.isArray(manifest.contributors)
      ? manifest.contributors.map(normalizePerson).filter(Boolean).sort()
      : [],
    evidence,
    provenanceFiles: hasLicenseFile ? [] : readmeFiles(directory),
    distributionEvidence: bundledEvidence,
    integrities: lockRecord.integrities,
    lockKeys: lockRecord.keys,
  };

  const existing = packages.get(key);
  if (existing) {
    existing.relationships.add(relationship);
    existing.requiredBy.add(requiredBy);
    const previous = JSON.stringify(existing.immutable);
    const current = JSON.stringify(immutable);
    if (previous !== current) existing.variantMismatch = true;
  } else {
    const record = {
      immutable,
      relationships: new Set([relationship]),
      requiredBy: new Set([requiredBy]),
      variantMismatch: false,
    };
    packages.set(key, record);
  }

  if (visitingDirectories.has(directory) || visitedDirectories.has(directory)) return;
  visitingDirectories.add(directory);

  const childGroups = [
    ['dependency', manifest.dependencies || {}, false],
    ['optionalDependency', manifest.optionalDependencies || {}, true],
    ['peerDependency', manifest.peerDependencies || {}, false],
  ];
  for (const [childRelationship, dependencies, groupOptional] of childGroups) {
    for (const childName of Object.keys(dependencies).sort()) {
      const optionalPeer =
        childRelationship === 'peerDependency' &&
        manifest.peerDependenciesMeta?.[childName]?.optional === true;
      visit(
        childName,
        directory,
        childRelationship,
        key,
        groupOptional || optionalPeer,
      );
    }
  }
  visitingDirectories.delete(directory);
  visitedDirectories.add(directory);
}

for (const group of rootGroups) {
  const dependencies = rootManifest[group] || {};
  const optional = group === 'optionalDependencies';
  for (const dependencyName of Object.keys(dependencies).sort()) {
    visit(
      dependencyName,
      path.dirname(manifestPath),
      `direct:${group}`,
      rootManifest.name || args.area,
      optional,
    );
  }
}

const inventory = [...packages.values()]
  .map((record) => ({
    ...record.immutable,
    relationships: [...record.relationships].sort(),
    requiredBy: [...record.requiredBy].sort(),
    variantMismatch: record.variantMismatch,
  }))
  .sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(
      `${right.name}@${right.version}`,
      'en',
    ),
  );

unresolved.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), 'en'));
skippedOptional.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), 'en'));
const report = {
  schemaVersion: 1,
  area: args.area,
  root: rootManifest.name || '',
  rootGroups,
  manifest: { path: path.basename(manifestPath), ...fileDigest(manifestPath) },
  lock: lockEvidence.digest,
  explicitLockSources: lockEvidence.sources,
  directDependencyCount: inventory.filter((entry) =>
    entry.relationships.some((relationship) => relationship.startsWith('direct:')),
  ).length,
  uniquePackageCount: inventory.length,
  unresolved,
  skippedOptional,
  inventory,
};
fs.mkdirSync(path.dirname(args.output), { recursive: true });
fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(
  JSON.stringify({
    output: args.output,
    outputSha256: fileDigest(args.output).sha256,
    uniquePackageCount: inventory.length,
    unresolvedCount: unresolved.length,
    skippedOptionalCount: skippedOptional.length,
    missingLicenseMetadataCount: inventory.filter((entry) => !entry.licenseExpression).length,
    missingLicenseFileCount: inventory.filter(
      (entry) =>
        !entry.evidence.some((evidence) =>
          /^(licen[cs]e|unlicense|copying)(\.|$)/i.test(evidence.name),
        ),
    ).length,
    variantMismatchCount: inventory.filter((entry) => entry.variantMismatch).length,
  }),
);
