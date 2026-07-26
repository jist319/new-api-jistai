/*
Copyright (C) 2026 JistAI contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { verifyBuildVersion } from './verify-build-version.mjs'

const FIXTURE_CONTRACT = {
  channelTag: 'fixture-channel',
  markerPrefix: 'fixture-build-version:',
  markerSeparator: '@',
}
const BUILD_METADATA_FIXTURE =
  'const revisionPrefix = "rv."; const htmlAttribute = "data-build-rev"; const metaName = "build-id"; const storageKey = "app:rev";'

function versionMarker(
  version,
  channelTag = FIXTURE_CONTRACT.channelTag,
  markerSeparator = FIXTURE_CONTRACT.markerSeparator
) {
  return FIXTURE_CONTRACT.markerPrefix + version + markerSeparator + channelTag
}

async function createFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'build-version-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  return directory
}

test('accepts an exact release version in a compiled asset', async (t) => {
  const directory = await createFixture(t)
  await mkdir(path.join(directory, 'assets'))
  await writeFile(
    path.join(directory, 'assets', 'index.js'),
    `const marker = "${versionMarker('v1.2.3-rc.4')}"; ${BUILD_METADATA_FIXTURE}\n`
  )

  const result = await verifyBuildVersion({
    distPath: directory,
    version: 'v1.2.3-rc.4',
    ...FIXTURE_CONTRACT,
  })

  assert.equal(result.filesScanned, 1)
  assert.deepEqual(result.matchedFiles, ['assets/index.js'])
})

test('rejects a distribution that omits the release version', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    'const channel = "fixture-channel";\n'
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /release version v1\.2\.3 and build channel fixture-channel were not found together/
  )
})

test('rejects version evidence outside executable assets', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    'const channel = "fixture-channel";\n'
  )
  await writeFile(
    path.join(directory, 'NOTICE.txt'),
    `release ${versionMarker('v1.2.3')} ${FIXTURE_CONTRACT.channelTag}\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects a legacy marker plus a standalone build channel', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `const marker = "${FIXTURE_CONTRACT.markerPrefix}v1.2.3"; const channel = "${FIXTURE_CONTRACT.channelTag}"; ${BUILD_METADATA_FIXTURE}\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects an exact composite without clustered runtime metadata', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `const marker = "${versionMarker('v1.2.3')}";\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects a naked version beside otherwise valid metadata', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `const version = "v1.2.3"; const channel = "${FIXTURE_CONTRACT.channelTag}"; ${BUILD_METADATA_FIXTURE}\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects a version embedded in a longer token', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `const markers = ["${versionMarker('v1.2.30')}", "${versionMarker('v1.2.3-rc.1')}", "${versionMarker('v1.2.3.4')}", "${versionMarker('v1.2.3+build.7')}"]; const channel = "${FIXTURE_CONTRACT.channelTag}"; ${BUILD_METADATA_FIXTURE}\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('accepts a hoisted composite marker and clustered runtime metadata', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `const marker = "${versionMarker('v1.2.3')}";${'x'.repeat(9000)}${BUILD_METADATA_FIXTURE}\n`
  )

  const result = await verifyBuildVersion({
    distPath: directory,
    version: 'v1.2.3',
    ...FIXTURE_CONTRACT,
  })

  assert.deepEqual(result.matchedFiles, ['index.js'])
})

test('rejects a wrong composite channel beside the correct standalone channel', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `const marker = "${versionMarker('v1.2.3', 'wrong-channel')}"; const channel = "${FIXTURE_CONTRACT.channelTag}"; ${BUILD_METADATA_FIXTURE}\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects runtime metadata markers that do not form a cluster', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `const marker = "${versionMarker('v1.2.3')}"; const revisionPrefix = "rv.";${'x'.repeat(9000)}const htmlAttribute = "data-build-rev"; const metaName = "build-id"; const storageKey = "app:rev";\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects version and runtime evidence split across assets', async (t) => {
  const directory = await createFixture(t)
  await mkdir(path.join(directory, 'assets'))
  await writeFile(
    path.join(directory, 'assets', 'version.js'),
    `const marker = "${versionMarker('v1.2.3')}";\n`
  )
  await writeFile(
    path.join(directory, 'assets', 'runtime.js'),
    `${BUILD_METADATA_FIXTURE}\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects an unquoted composite marker', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `/* ${versionMarker('v1.2.3')} */ ${BUILD_METADATA_FIXTURE}\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects a composite marker with a longer channel token', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `const marker = "${versionMarker('v1.2.3', `${FIXTURE_CONTRACT.channelTag}-extra`)}"; ${BUILD_METADATA_FIXTURE}\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects a composite marker with the wrong separator', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `const marker = "${versionMarker('v1.2.3', FIXTURE_CONTRACT.channelTag, '#')}"; ${BUILD_METADATA_FIXTURE}\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects a wrong composite marker beside valid metadata', async (t) => {
  const directory = await createFixture(t)
  await writeFile(
    path.join(directory, 'index.js'),
    `const marker = "${versionMarker('v1.2.4')}"; const channel = "${FIXTURE_CONTRACT.channelTag}"; ${BUILD_METADATA_FIXTURE}\n`
  )

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /were not found together/
  )
})

test('rejects invalid or empty release versions before scanning', async (t) => {
  const directory = await createFixture(t)
  await writeFile(path.join(directory, 'index.js'), 'const value = "test";\n')

  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: '',
      ...FIXTURE_CONTRACT,
    }),
    /invalid release version/
  )
  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: '1.2.3',
      ...FIXTURE_CONTRACT,
    }),
    /invalid release version/
  )
  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3-rc.01',
      ...FIXTURE_CONTRACT,
    }),
    /invalid release version/
  )
  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
      channelTag: 'fixture.channel',
    }),
    /invalid build channel tag/
  )
  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
      markerPrefix: 'fixture.build:',
    }),
    /invalid build version marker prefix/
  )
  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      ...FIXTURE_CONTRACT,
      markerSeparator: '@@',
    }),
    /invalid build version marker separator/
  )
  await assert.rejects(
    verifyBuildVersion({
      distPath: directory,
      version: 'v1.2.3',
      channelTag: FIXTURE_CONTRACT.channelTag,
    }),
    /contract overrides must be provided together/
  )
})
