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

The exact deployed JistAI source revision is:

`f4b3af1fab385de980f48cd198924df122774c35`

This revision is not an official release of the upstream project. JistAI does
not represent this modified version as an official QuantumNous or New API
distribution.

## License and attribution

The covered work remains under the GNU Affero General Public License, version
3 (AGPLv3). The original `LICENSE`, `NOTICE`, and
`THIRD-PARTY-LICENSES.md` files are preserved. The original project is:

https://github.com/QuantumNous/new-api

Frontend design and development by New API contributors.

JistAI's original additions are provided as part of this modified work under
the terms required by AGPLv3. This repository contains source and build inputs
for the corresponding deployed version. It intentionally does not contain
runtime credentials, database contents, user data, Cloudflare configuration,
TLS private keys, or other private operational data.

