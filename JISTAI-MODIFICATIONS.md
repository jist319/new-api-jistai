# JistAI New API Modifications

This repository is a modified version of `QuantumNous/new-api` based on the
upstream `v1.0.0-rc.21` release.

## JistAI changes

- Added the JistAI public homepage implementation and its public configuration
  handling.
- Added per-user and per-group concurrent model-request limits, including the
  backend lease handling, admin settings, translations, and tests.
- Added maintenance documentation for the customization and its deployment
  assumptions.
- Added release metadata validation, reproducible source-archive checks, and
  deterministic third-party license-compliance tooling.

Before this history-preserving release-candidate branch was prepared, the
deployed JistAI source revision recorded by the operator was:

`f4b3af1fab385de980f48cd198924df122774c35`

That deployment-side SHA is retained as provenance. It is not an object in
this local Git history and must not be used as the build source for this
candidate.

The public source repository for this corresponding version is:

https://github.com/jist319/new-api-jistai

This branch may contain release-candidate changes that have not been deployed.
Before a new version is deployed, its exact final Git commit must be published
in that repository, and the release tag, application version, and OCI revision
label must identify the same source. JistAI does not represent this modified
version as an official QuantumNous or New API distribution.

## License and attribution

The covered work remains under the GNU Affero General Public License, version
3 (AGPLv3). The original `LICENSE`, `NOTICE`, and
`THIRD-PARTY-LICENSES.md` files are preserved. The original project is:

https://github.com/QuantumNous/new-api

Frontend design and development by New API contributors.

JistAI's original additions are provided as part of this modified work under
the terms required by AGPLv3. This repository contains source and build inputs
for JistAI release candidates. Corresponding source for every deployed version
must remain publicly accessible at its exact commit or tag. The repository
intentionally does not contain runtime credentials, database contents, user
data, Cloudflare configuration, TLS private keys, or other private operational
data.
