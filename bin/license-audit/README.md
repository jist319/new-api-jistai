# Third-Party License Audit

This directory contains the deterministic audit chain for
`THIRD-PARTY-LICENSES.md`. It scans the exact Go, Bun, npm, and vendored-source
closures from a canonical `git archive` of `HEAD`.

Required tool versions are Go 1.26.1, Bun 1.3.11, Node.js 24.18.0, and npm
11.16.0. Dependency downloads use only the registries and revisions pinned by
the repository lockfiles. The runner clears package-manager authentication
variables and uses an empty npm user configuration.

From a clean committed worktree, verify the tracked bundle with:

```bash
bash bin/license-audit/run.sh --check
```

After committing an intentional dependency, scanner, or vendored-source
change, regenerate from that exact commit with:

```bash
bash bin/license-audit/run.sh --write
```

The write mode updates `THIRD-PARTY-LICENSES.md` and
`third_party/license-audit-lock.json`. Review both outputs, run check mode, and
commit the generated files separately. Audit reports and installed dependency
trees are temporary derived data and are not committed.

`bin/validate-release-metadata.sh` performs the fast release check: it validates
the input hash lock and runs the vendored-source scanner against the tracked
bundle. The full audit runner remains the authoritative stale-bundle gate for
dependency changes and release candidates.
