/*
Copyright (C) 2026 JistAI contributors
SPDX-License-Identifier: AGPL-3.0-or-later
*/

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const LOCK_PATH = "third_party/license-audit-lock.json";
const PURPOSE =
  "Pins every source and tool input used to audit the tracked third-party license bundle.";
const TOOLCHAIN = Object.freeze({
  bun: "1.3.11",
  go: "1.26.1",
  node: "24.18.0",
  npm: "11.16.0",
});
const REQUIRED_INPUTS = Object.freeze(
  [
    ".gitattributes",
    "VENDORED-SOURCES.json",
    "bin/license-audit/base-overrides.json",
    "bin/license-audit/build-overrides.cjs",
    "bin/license-audit/generate-third-party.cjs",
    "bin/license-audit/license-lock.cjs",
    "bin/license-audit/run.sh",
    "bin/license-audit/scan-go.go",
    "bin/license-audit/scan-node.cjs",
    "bin/license-audit/scan-node.test.cjs",
    "bin/license-audit/scan-vendored-sources.cjs",
    "electron/package-lock.json",
    "electron/package.json",
    "go.mod",
    "go.sum",
    "third_party/licenses/shadcn-ui-MIT.txt",
    "third_party/licenses/vercel-react-best-practices-MIT.txt",
    "web/bun.lock",
    "web/classic/package.json",
    "web/default/package.json",
    "web/package.json",
  ].sort((left, right) => left.localeCompare(right, "en")),
);
const COUNT_KEYS = Object.freeze([
  "evidenceTexts",
  "inventoryRows",
  "overridesUsed",
  "uniqueCoordinates",
  "vendoredSources",
]);
const AUDIT_ZERO_KEYS = Object.freeze([
  "evidenceGapCount",
  "issueCount",
  "overrideRequirementCount",
  "warningCount",
]);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function exactKeys(value, expected, label) {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  const actual = Object.keys(value).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  const wanted = [...expected].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  assert(
    JSON.stringify(actual) === JSON.stringify(wanted),
    `${label} keys changed`,
  );
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key?.startsWith("--") || index + 1 >= argv.length) {
      fail(`invalid argument at ${index}: ${key || "(empty)"}`);
    }
    const name = key.slice(2);
    assert(!(name in result), `duplicate argument: --${name}`);
    result[name] = argv[index + 1];
  }
  exactKeys(result, ["lock", "root"], "arguments");
  return result;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function validateRepositoryPath(value, label) {
  assert(
    typeof value === "string" && value.length > 0,
    `${label} path is empty`,
  );
  assert(!value.includes("\\"), `${label} path contains a backslash`);
  assert(!path.posix.isAbsolute(value), `${label} path is absolute`);
  const segments = value.split("/");
  assert(
    segments.every(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    ),
    `${label} path escapes the repository`,
  );
  assert(
    path.posix.normalize(value) === value,
    `${label} path is not normalized`,
  );
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function readRegularFile(root, repositoryPath, label) {
  validateRepositoryPath(repositoryPath, label);
  const absolutePath = path.resolve(root, ...repositoryPath.split("/"));
  assert(isWithin(root, absolutePath), `${label} path escapes the repository`);

  let metadata;
  try {
    metadata = fs.lstatSync(absolutePath);
  } catch (error) {
    fail(`${label} is missing: ${error.code || error.message}`);
  }
  assert(
    metadata.isFile() && !metadata.isSymbolicLink(),
    `${label} must be a regular file`,
  );

  const realPath = fs.realpathSync(absolutePath);
  assert(isWithin(root, realPath), `${label} resolves outside the repository`);
  return fs.readFileSync(absolutePath);
}

function validateDigest(entry, label) {
  exactKeys(entry, ["bytes", "sha256"], label);
  assert(
    Number.isSafeInteger(entry.bytes) && entry.bytes > 0,
    `${label}.bytes is invalid`,
  );
  assert(/^[0-9a-f]{64}$/.test(entry.sha256), `${label}.sha256 is invalid`);
}

function normalizeCrlf(bytes) {
  const output = Buffer.allocUnsafe(bytes.length);
  let writeOffset = 0;
  let changed = false;
  for (let readOffset = 0; readOffset < bytes.length; readOffset += 1) {
    if (bytes[readOffset] === 0x0d) {
      if (readOffset + 1 >= bytes.length || bytes[readOffset + 1] !== 0x0a)
        return null;
      changed = true;
      continue;
    }
    output[writeOffset] = bytes[readOffset];
    writeOffset += 1;
  }
  return changed ? output.subarray(0, writeOffset) : null;
}

function validateFileDigest(
  root,
  repositoryPath,
  expected,
  label,
  allowCrlfNormalization = false,
) {
  validateDigest(expected, label);
  const bytes = readRegularFile(root, repositoryPath, label);
  if (bytes.length === expected.bytes && sha256(bytes) === expected.sha256)
    return;

  // The audit is generated from canonical Git archive bytes. Windows may
  // materialize these fixed text inputs with CRLF, but no other transformation
  // is equivalent. The generated legal bundle never uses this allowance.
  const normalized = allowCrlfNormalization ? normalizeCrlf(bytes) : null;
  assert(
    normalized &&
      normalized.length === expected.bytes &&
      sha256(normalized) === expected.sha256,
    `${label} changed: ${repositoryPath}`,
  );
}

function verifyLock(rootArgument, lockArgument) {
  const root = fs.realpathSync(path.resolve(rootArgument));
  assert(fs.statSync(root).isDirectory(), "root must be a directory");
  assert(lockArgument === LOCK_PATH, `lock path must be ${LOCK_PATH}`);

  const lockBytes = readRegularFile(root, lockArgument, "license lock");
  assert(lockBytes.length > 0, "license lock is empty");
  assert(
    lockBytes[0] !== 0xef || lockBytes[1] !== 0xbb || lockBytes[2] !== 0xbf,
    "license lock has a BOM",
  );

  const lock = JSON.parse(lockBytes.toString("utf8"));
  const canonical = Buffer.from(`${JSON.stringify(lock, null, 2)}\n`, "utf8");
  assert(lockBytes.equals(canonical), "license lock is not canonical JSON");
  exactKeys(
    lock,
    ["audit", "inputs", "output", "purpose", "schemaVersion", "toolchain"],
    "license lock",
  );
  assert(lock.schemaVersion === 1, "license lock schema changed");
  assert(lock.purpose === PURPOSE, "license lock purpose changed");
  exactKeys(lock.toolchain, Object.keys(TOOLCHAIN), "license lock toolchain");
  assert(
    JSON.stringify(lock.toolchain) === JSON.stringify(TOOLCHAIN),
    "license lock toolchain changed",
  );

  assert(Array.isArray(lock.inputs), "license lock inputs must be an array");
  const paths = lock.inputs.map((entry, index) => {
    exactKeys(
      entry,
      ["bytes", "path", "sha256"],
      `license lock input ${index}`,
    );
    validateRepositoryPath(entry.path, `license lock input ${index}`);
    validateDigest(
      { bytes: entry.bytes, sha256: entry.sha256 },
      `license lock input ${index}`,
    );
    return entry.path;
  });
  assert(
    JSON.stringify(paths) === JSON.stringify(REQUIRED_INPUTS),
    "license lock input set or order changed",
  );
  for (let index = 0; index < lock.inputs.length; index += 1) {
    const entry = lock.inputs[index];
    validateFileDigest(
      root,
      entry.path,
      { bytes: entry.bytes, sha256: entry.sha256 },
      `license lock input ${index}`,
      true,
    );
  }

  exactKeys(lock.output, ["bytes", "path", "sha256"], "license lock output");
  assert(
    lock.output.path === "THIRD-PARTY-LICENSES.md",
    "license lock output path changed",
  );
  validateRepositoryPath(lock.output.path, "license lock output");
  validateFileDigest(
    root,
    lock.output.path,
    { bytes: lock.output.bytes, sha256: lock.output.sha256 },
    "license lock output",
  );

  exactKeys(
    lock.audit,
    [
      "counts",
      "evidenceGapCount",
      "issueCount",
      "overrideRequirementCount",
      "report",
      "warningCount",
    ],
    "license lock audit",
  );
  validateDigest(lock.audit.report, "license lock audit report");
  exactKeys(lock.audit.counts, COUNT_KEYS, "license lock audit counts");
  for (const key of COUNT_KEYS) {
    assert(
      Number.isSafeInteger(lock.audit.counts[key]) &&
        lock.audit.counts[key] > 0,
      `license lock audit count ${key} is invalid`,
    );
  }
  assert(
    lock.audit.counts.vendoredSources === 2,
    "license lock audit must contain two vendored sources",
  );
  for (const key of AUDIT_ZERO_KEYS) {
    assert(lock.audit[key] === 0, `license lock audit ${key} is not zero`);
  }

  return {
    inputCount: lock.inputs.length,
    outputBytes: lock.output.bytes,
    outputSha256: lock.output.sha256,
    counts: lock.audit.counts,
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const result = verifyLock(args.root, args.lock);
  console.log(JSON.stringify({ ok: true, ...result }));
} catch (error) {
  console.error(`license lock verification: ${error.message}`);
  process.exit(1);
}
