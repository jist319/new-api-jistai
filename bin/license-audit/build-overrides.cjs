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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hasLicenseFile(dependency) {
  return dependency.evidence.some((entry) =>
    /^(licen[cs]e|unlicense|copying)(\.|$)/i.test(entry.name),
  );
}

function packageKey(dependency) {
  return `${dependency.name}@${dependency.version}`;
}

function exactRegistryUrl(name, version) {
  return `https://registry.npmjs.org/${name.replace('/', '%2f')}/${version}`;
}

function decode(entry) {
  return Buffer.from(entry.contentBase64, 'base64').toString('utf8');
}

function cleanAttributionLine(line) {
  return line
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, (value) => value.replace(/\]\([^)]*\)$/, ']'))
    .replace(/^[#>*_`\s-]+/, '')
    .replace(/[*_`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readmeAttributions(dependency) {
  const results = [];
  for (const file of dependency.provenanceFiles || []) {
    const lines = decode(file).split(/\r?\n/);
    for (const rawLine of lines) {
      if (!/(?:copyright|©|&copy;|\(c\))/i.test(rawLine)) continue;
      const line = cleanAttributionLine(rawLine);
      if (!line || line.length > 500 || /shields\.io|badge/i.test(line)) continue;
      results.push({ file: file.name, sha256: file.sha256, text: line });
    }
  }
  const seen = new Set();
  return results.filter((entry) => {
    const key = `${entry.sha256}:${entry.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

const MIT_BODY = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const ISC_BODY = `Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`;

const BSD_2_BODY = `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.`;

const BSD_3_BODY = `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

3. Neither the name of the attributed project nor the names of its
   contributors may be used to endorse or promote products derived from this
   software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.`;

const WTFPL_BODY = `DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
Version 2, December 2004

Copyright (C) 2004 Sam Hocevar <sam@hocevar.net>

Everyone is permitted to copy and distribute verbatim or modified copies of
this license document, and changing it is allowed as long as the name is
changed.

DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION

0. You just DO WHAT THE FUCK YOU WANT TO.`;

const SPDX_SOURCES = {
  'Apache-2.0': 'https://spdx.org/licenses/Apache-2.0.html',
  'BSD-2-Clause': 'https://spdx.org/licenses/BSD-2-Clause.html',
  'BSD-3-Clause': 'https://spdx.org/licenses/BSD-3-Clause.html',
  ISC: 'https://spdx.org/licenses/ISC.html',
  MIT: 'https://spdx.org/licenses/MIT.html',
  'MPL-2.0': 'https://spdx.org/licenses/MPL-2.0.html',
  WTFPL: 'https://spdx.org/licenses/WTFPL.html',
};

function canonicalFromGo(goReport, classification, startsWith) {
  const candidates = [];
  for (const module of goReport.modules) {
    for (const evidence of module.evidence) {
      if (evidence.kind !== 'license' || evidence.classification !== classification) continue;
      const text = decode(evidence);
      if (startsWith && !text.trimStart().startsWith(startsWith)) continue;
      candidates.push({ text, bytes: evidence.bytes, sha256: evidence.sha256 });
    }
  }
  candidates.sort((left, right) => left.bytes - right.bytes || left.sha256.localeCompare(right.sha256, 'en'));
  if (!candidates.length) throw new Error(`no canonical ${classification} evidence found`);
  return candidates[0].text.trim();
}

function canonicalTerms(expression, goReport) {
  const bodies = {
    MIT: `MIT License\n\n${MIT_BODY}`,
    ISC: `ISC License\n\n${ISC_BODY}`,
    'BSD-2-Clause': `BSD 2-Clause License\n\n${BSD_2_BODY}`,
    'BSD-3-Clause': `BSD 3-Clause License\n\n${BSD_3_BODY}`,
    WTFPL: WTFPL_BODY,
    'Apache-2.0': canonicalFromGo(goReport, 'Apache-2.0'),
    'MPL-2.0': canonicalFromGo(goReport, 'MPL-2.0', 'Mozilla Public License'),
  };
  const ids = expression.split(/\s+AND\s+/);
  for (const id of ids) {
    if (!bodies[id] || !SPDX_SOURCES[id]) throw new Error(`unsupported override expression ${expression}`);
  }
  return {
    sources: ids.map((id) => SPDX_SOURCES[id]),
    text: ids.map((id) => bodies[id]).join('\n\n---\n\n'),
  };
}

function selectAttribution(dependency) {
  const readme = readmeAttributions(dependency);
  if (readme.length) {
    return {
      attribution: readme.map((entry) => entry.text).join(' | '),
      provenance: `Attribution copied from bundled ${readme
        .map((entry) => `${entry.file} SHA-256 ${entry.sha256}`)
        .join(', ')}.`,
    };
  }
  if (dependency.author) {
    return {
      attribution: `Package author metadata: ${dependency.author}`,
      provenance: `Attribution is the author field in installed package.json SHA-256 ${dependency.packageJson.sha256}; no standalone copyright notice was bundled.`,
    };
  }
  if (dependency.maintainers?.length) {
    return {
      attribution: `Package maintainer metadata: ${dependency.maintainers.join(' | ')}`,
      provenance: `Attribution is the maintainers field in installed package.json SHA-256 ${dependency.packageJson.sha256}; no standalone copyright notice was bundled.`,
    };
  }
  if (dependency.contributors?.length) {
    return {
      attribution: `Package contributor metadata: ${dependency.contributors.join(' | ')}`,
      provenance: `Attribution is the contributors field in installed package.json SHA-256 ${dependency.packageJson.sha256}; no standalone copyright notice was bundled.`,
    };
  }
  const project = dependency.repository || dependency.homepage;
  if (!project) throw new Error(`${packageKey(dependency)} has no attribution metadata`);
  return {
    attribution: `Package project metadata: ${project}`,
    provenance: `Attribution is the repository/homepage field in installed package.json SHA-256 ${dependency.packageJson.sha256}; no standalone copyright notice was bundled.`,
  };
}

const args = parseArgs(process.argv.slice(2));
for (const required of ['go', 'default', 'classic', 'electron', 'base', 'output']) {
  if (!args[required]) throw new Error(`missing --${required}`);
}
const goReport = readJson(args.go);
const nodeReports = [readJson(args.default), readJson(args.classic), readJson(args.electron)];
const base = readJson(args.base);
const coordinates = new Map();

for (const report of nodeReports) {
  for (const dependency of report.inventory) {
    if (hasLicenseFile(dependency)) continue;
    const key = packageKey(dependency);
    const existing = coordinates.get(key);
    if (existing) {
      if (
        existing.licenseExpression !== dependency.licenseExpression ||
        JSON.stringify(existing.integrities) !== JSON.stringify(dependency.integrities) ||
        existing.packageJson.sha256 !== dependency.packageJson.sha256
      ) {
        throw new Error(`inconsistent installed metadata for ${key}`);
      }
      continue;
    }
    coordinates.set(key, dependency);
  }
}

const packages = { ...(base.packages || {}) };
for (const key of [...coordinates.keys()].sort()) {
  if (packages[key]) continue;
  const dependency = coordinates.get(key);
  const expression = dependency.licenseExpression;
  if (!expression) throw new Error(`${key} lacks a declared license expression`);
  if (dependency.integrities.length !== 1) {
    throw new Error(`${key} requires exactly one lock integrity, found ${dependency.integrities.length}`);
  }
  const attribution = selectAttribution(dependency);
  const canonical = canonicalTerms(expression, goReport);
  const licenseText = [
    `Package coordinate: ${key}`,
    attribution.attribution,
    '',
    `The installed package declares ${expression}. The canonical terms follow.`,
    '',
    canonical.text,
    '',
  ].join('\n');
  packages[key] = {
    licenseExpression: expression,
    source: exactRegistryUrl(dependency.name, dependency.version),
    canonicalLicenseSources: canonical.sources,
    attribution: attribution.attribution,
    provenance: `No top-level license file was bundled. ${attribution.provenance} The license expression is from the same installed package.json; package bytes are anchored by the lock integrity.`,
    packageIntegrity: dependency.integrities[0],
    packageJsonSha256: dependency.packageJson.sha256,
    bundledReadmes: (dependency.provenanceFiles || []).map(({ contentBase64, ...entry }) => entry),
    licenseTextSha256: sha256(Buffer.from(licenseText, 'utf8')),
    licenseText,
  };
}

const sortedPackages = {};
for (const key of Object.keys(packages).sort()) sortedPackages[key] = packages[key];
const output = {
  schemaVersion: 1,
  policy: {
    scope: 'Exact installed npm coordinates without a top-level license file.',
    attribution: 'Use bundled README copyright notices when present; otherwise label author, maintainer, contributor, or repository values explicitly as package metadata, never as inferred copyright.',
    canonicalTerms: 'License terms are the canonical SPDX text identified by the installed package license expression.',
  },
  packages: sortedPackages,
};
fs.mkdirSync(path.dirname(args.output), { recursive: true });
fs.writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
const bytes = fs.readFileSync(args.output);
console.log(
  JSON.stringify({
    output: args.output,
    outputSha256: sha256(bytes),
    packageCount: Object.keys(sortedPackages).length,
    generatedPackageCount: Object.keys(sortedPackages).length - Object.keys(base.packages || {}).length,
  }),
);
