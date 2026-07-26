/*
Copyright (C) 2026 JistAI contributors
SPDX-License-Identifier: AGPL-3.0-or-later
*/

const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const test = require("node:test");

const REPOSITORY_ROOT = fs.realpathSync(
  path.resolve(
    process.env.LICENSE_AUDIT_TEST_ROOT || path.join(__dirname, "..", ".."),
  ),
);
const VERIFIER = path.join(__dirname, "verify-license-lock.cjs");
const SCANNER = path.join(
  REPOSITORY_ROOT,
  "bin",
  "license-audit",
  "scan-vendored-sources.cjs",
);
const LOCK_PATH = "third_party/license-audit-lock.json";

function repositoryPath(root, relativePath) {
  return path.join(root, ...relativePath.split("/"));
}

function copyRepositoryPath(sourceRoot, targetRoot, relativePath) {
  const source = repositoryPath(sourceRoot, relativePath);
  const target = repositoryPath(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.lstatSync(source).isDirectory()) {
    fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true });
  } else {
    fs.copyFileSync(source, target);
  }
}

function temporaryRoot(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function populateLockFixture(root) {
  const lock = JSON.parse(
    fs.readFileSync(repositoryPath(REPOSITORY_ROOT, LOCK_PATH), "utf8"),
  );
  for (const relativePath of [
    LOCK_PATH,
    lock.output.path,
    ...lock.inputs.map((entry) => entry.path),
  ]) {
    copyRepositoryPath(REPOSITORY_ROOT, root, relativePath);
  }
  return { root, lockPath: repositoryPath(root, LOCK_PATH) };
}

function createLockFixture(t) {
  return populateLockFixture(temporaryRoot(t, "jistai-license-lock-"));
}

function writeCanonicalLock(lockPath, mutate) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  mutate(lock);
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
}

function runVerifier(root) {
  return spawnSync(
    process.execPath,
    [VERIFIER, "--root", root, "--lock", LOCK_PATH],
    { encoding: "utf8" },
  );
}

function assertVerifierFails(result, pattern) {
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, pattern);
}

function runGit(root, ...arguments) {
  const result = spawnSync("git", ["-C", root, ...arguments], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
}

function createVendoredFixture(t) {
  const root = temporaryRoot(t, "jistai-vendored-source-");
  for (const relativePath of [
    "VENDORED-SOURCES.json",
    "THIRD-PARTY-LICENSES.md",
    "third_party/licenses/shadcn-ui-MIT.txt",
    "third_party/licenses/vercel-react-best-practices-MIT.txt",
    ".agents/skills/shadcn-ui",
    ".agents/skills/vercel-react-best-practices",
  ]) {
    copyRepositoryPath(REPOSITORY_ROOT, root, relativePath);
  }
  return root;
}

function runVendoredScanner(root) {
  return spawnSync(
    process.execPath,
    [
      SCANNER,
      "--root",
      root,
      "--manifest",
      repositoryPath(root, "VENDORED-SOURCES.json"),
      "--bundle",
      repositoryPath(root, "THIRD-PARTY-LICENSES.md"),
    ],
    { encoding: "utf8" },
  );
}

test("accepts the tracked canonical lock and bundle", () => {
  const result = runVerifier(REPOSITORY_ROOT);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, true);
});

test("rejects non-canonical lock JSON", (t) => {
  const fixture = createLockFixture(t);
  const lock = JSON.parse(fs.readFileSync(fixture.lockPath, "utf8"));
  fs.writeFileSync(fixture.lockPath, JSON.stringify(lock), "utf8");
  assertVerifierFails(runVerifier(fixture.root), /not canonical JSON/);
});

test("rejects a lock with a UTF-8 BOM", (t) => {
  const fixture = createLockFixture(t);
  const bytes = fs.readFileSync(fixture.lockPath);
  fs.writeFileSync(
    fixture.lockPath,
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]),
  );
  assertVerifierFails(runVerifier(fixture.root), /has a BOM/);
});

test("rejects a changed, missing, or symbolic-link input", async (t) => {
  await t.test("changed input", (child) => {
    const fixture = createLockFixture(child);
    fs.appendFileSync(
      repositoryPath(fixture.root, ".gitattributes"),
      "\nchanged\n",
      "utf8",
    );
    assertVerifierFails(
      runVerifier(fixture.root),
      /license lock input .* changed/,
    );
  });
  await t.test("missing input", (child) => {
    const fixture = createLockFixture(child);
    fs.rmSync(repositoryPath(fixture.root, ".gitattributes"));
    assertVerifierFails(
      runVerifier(fixture.root),
      /license lock input .* is missing/,
    );
  });
  await t.test("symbolic-link input", (child) => {
    const fixture = createLockFixture(child);
    const input = repositoryPath(fixture.root, ".gitattributes");
    const outside = temporaryRoot(child, "jistai-license-outside-");
    fs.rmSync(input);
    fs.symlinkSync(
      outside,
      input,
      process.platform === "win32" ? "junction" : "dir",
    );
    assertVerifierFails(runVerifier(fixture.root), /must be a regular file/);
  });
});

test("rejects a changed bundle", (t) => {
  const fixture = createLockFixture(t);
  fs.appendFileSync(
    repositoryPath(fixture.root, "THIRD-PARTY-LICENSES.md"),
    "\nchanged\n",
    "utf8",
  );
  assertVerifierFails(runVerifier(fixture.root), /license lock output changed/);
});

test("accepts strict CRLF checkout normalization for generation inputs", (t) => {
  const fixture = createLockFixture(t);
  const input = repositoryPath(fixture.root, ".gitattributes");
  const canonical = fs.readFileSync(input, "utf8");
  assert.doesNotMatch(canonical, /\r/);
  fs.writeFileSync(input, canonical.replace(/\n/g, "\r\n"), "utf8");
  const result = runVerifier(fixture.root);
  assert.equal(result.status, 0, result.stderr);
});

test("accepts mixed LF and CRLF only when canonical bytes are unchanged", (t) => {
  const fixture = createLockFixture(t);
  const input = repositoryPath(fixture.root, ".gitattributes");
  const canonical = fs.readFileSync(input, "utf8");
  let newline = 0;
  const mixed = canonical.replace(/\n/g, () => {
    newline += 1;
    return newline % 2 === 0 ? "\r\n" : "\n";
  });
  assert.match(mixed, /\r\n/);
  fs.writeFileSync(input, mixed, "utf8");
  const result = runVerifier(fixture.root);
  assert.equal(result.status, 0, result.stderr);
});

test("rejects a lone carriage return in a generation input", (t) => {
  const fixture = createLockFixture(t);
  fs.appendFileSync(repositoryPath(fixture.root, ".gitattributes"), "\r");
  assertVerifierFails(
    runVerifier(fixture.root),
    /license lock input .* changed/,
  );
});

test("rejects CRLF conversion of the byte-exact generated bundle", (t) => {
  const fixture = createLockFixture(t);
  const bundlePath = repositoryPath(fixture.root, "THIRD-PARTY-LICENSES.md");
  const bytes = fs.readFileSync(bundlePath);
  const newline = bytes.indexOf(0x0a);
  assert.notEqual(newline, -1);
  fs.writeFileSync(
    bundlePath,
    Buffer.concat([
      bytes.subarray(0, newline),
      Buffer.from("\r\n"),
      bytes.subarray(newline + 1),
    ]),
  );
  assertVerifierFails(runVerifier(fixture.root), /license lock output changed/);
});

test("rejects changed input even when Git reports the path clean", (t) => {
  const fixture = createLockFixture(t);
  runGit(fixture.root, "init");
  runGit(fixture.root, "config", "user.name", "License Gate Test");
  runGit(fixture.root, "config", "user.email", "license-gate@example.invalid");
  runGit(fixture.root, "add", "--", ".");
  runGit(fixture.root, "commit", "-m", "fixture");
  runGit(fixture.root, "update-index", "--assume-unchanged", ".gitattributes");
  fs.appendFileSync(
    repositoryPath(fixture.root, ".gitattributes"),
    "\nchanged\n",
    "utf8",
  );
  runGit(fixture.root, "diff", "--quiet", "HEAD", "--", ".gitattributes");
  assertVerifierFails(
    runVerifier(fixture.root),
    /license lock input .* changed/,
  );
});

const lockMutationCases = [
  [
    "extra top-level key",
    (lock) => {
      lock.extra = true;
    },
    /license lock keys changed/,
  ],
  [
    "schema change",
    (lock) => {
      lock.schemaVersion = 2;
    },
    /schema changed/,
  ],
  [
    "purpose change",
    (lock) => {
      lock.purpose = "changed";
    },
    /purpose changed/,
  ],
  [
    "toolchain change",
    (lock) => {
      lock.toolchain.node = "0.0.0";
    },
    /toolchain changed/,
  ],
  [
    "removed input",
    (lock) => {
      lock.inputs.pop();
    },
    /input set or order changed/,
  ],
  [
    "reordered inputs",
    (lock) => {
      [lock.inputs[0], lock.inputs[1]] = [lock.inputs[1], lock.inputs[0]];
    },
    /input set or order changed/,
  ],
  [
    "duplicate input",
    (lock) => {
      lock.inputs[1] = { ...lock.inputs[0] };
    },
    /input set or order changed/,
  ],
  [
    "escaping input path",
    (lock) => {
      lock.inputs[0].path = "../outside";
    },
    /path escapes the repository/,
  ],
  [
    "absolute input path",
    (lock) => {
      lock.inputs[0].path = "/outside";
    },
    /path is absolute/,
  ],
  [
    "backslash input path",
    (lock) => {
      lock.inputs[1].path = "bin\\outside";
    },
    /path contains a backslash/,
  ],
  [
    "missing audit key",
    (lock) => {
      delete lock.audit.report;
    },
    /license lock audit keys changed/,
  ],
  [
    "invalid report digest",
    (lock) => {
      lock.audit.report.sha256 = "invalid";
    },
    /audit report.sha256 is invalid/,
  ],
  [
    "nonzero audit issue",
    (lock) => {
      lock.audit.issueCount = 1;
    },
    /issueCount is not zero/,
  ],
  [
    "nonzero audit warning",
    (lock) => {
      lock.audit.warningCount = 1;
    },
    /warningCount is not zero/,
  ],
  [
    "nonzero evidence gap",
    (lock) => {
      lock.audit.evidenceGapCount = 1;
    },
    /evidenceGapCount is not zero/,
  ],
  [
    "nonzero override requirement",
    (lock) => {
      lock.audit.overrideRequirementCount = 1;
    },
    /overrideRequirementCount is not zero/,
  ],
  [
    "invalid audit count",
    (lock) => {
      lock.audit.counts.inventoryRows = 0;
    },
    /count inventoryRows is invalid/,
  ],
  [
    "wrong vendored count",
    (lock) => {
      lock.audit.counts.vendoredSources = 3;
    },
    /must contain two vendored sources/,
  ],
];

for (const [name, mutate, pattern] of lockMutationCases) {
  test(`rejects ${name}`, (t) => {
    const fixture = createLockFixture(t);
    writeCanonicalLock(fixture.lockPath, mutate);
    assertVerifierFails(runVerifier(fixture.root), pattern);
  });
}

test("accepts the tracked vendored-source bundle contract", () => {
  const result = runVendoredScanner(REPOSITORY_ROOT);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).bundleValidated, true);
});

test("rejects changed vendored source content", (t) => {
  const root = createVendoredFixture(t);
  fs.appendFileSync(
    repositoryPath(
      root,
      ".agents/skills/vercel-react-best-practices/references/full-guide.md",
    ),
    "\nchanged\n",
    "utf8",
  );
  const result = runVendoredScanner(root);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /tree|hash|digest|changed|mismatch/i);
});

test("rejects a changed vendored manifest through the lock", (t) => {
  const fixture = createLockFixture(t);
  fs.appendFileSync(
    repositoryPath(fixture.root, "VENDORED-SOURCES.json"),
    "\n",
    "utf8",
  );
  assertVerifierFails(
    runVerifier(fixture.root),
    /license lock input .* changed/,
  );
});

test("rejects changed vendored license terms", (t) => {
  const root = createVendoredFixture(t);
  fs.appendFileSync(
    repositoryPath(root, "third_party/licenses/shadcn-ui-MIT.txt"),
    "\nchanged\n",
    "utf8",
  );
  const result = runVendoredScanner(root);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /license|hash|digest|changed|mismatch/i);
});
