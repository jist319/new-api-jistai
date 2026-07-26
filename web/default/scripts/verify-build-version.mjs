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

import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const EXECUTABLE_ASSET_EXTENSIONS = new Set(['.js', '.mjs'])
const VERSION_PATTERN =
  /^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const CHANNEL_PATTERN = /^[0-9A-Za-z-]+$/
const MARKER_PREFIX_PATTERN = /^[0-9A-Za-z][0-9A-Za-z_-]*:$/
const MARKER_SEPARATOR_PATTERN = /^@$/
const BUILD_METADATA_MARKERS = ['rv.', 'data-build-rev', 'build-id', 'app:rev']
const BUILD_METADATA_WINDOW_BYTES = 4096

function isValidReleaseVersion(version) {
  if (!VERSION_PATTERN.test(version)) return false
  const prereleaseIndex = version.indexOf('-')
  if (prereleaseIndex === -1) return true
  return !version
    .slice(prereleaseIndex + 1)
    .split('.')
    .some(
      (identifier) =>
        /^[0-9]+$/.test(identifier) &&
        identifier.length > 1 &&
        identifier.startsWith('0')
    )
}

async function collectExecutableAssets(directory, root, assets = []) {
  const entries = await readdir(directory, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      throw new Error(
        `compiled asset must not be a symbolic link: ${path.relative(root, fullPath)}`
      )
    }
    if (entry.isDirectory()) {
      await collectExecutableAssets(fullPath, root, assets)
      continue
    }
    if (
      entry.isFile() &&
      EXECUTABLE_ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      assets.push(fullPath)
    }
  }

  return assets
}

function isQuotedLiteral(content, offset, length) {
  const previous = offset > 0 ? content[offset - 1] : ''
  const next = content[offset + length] || ''
  return (
    previous === next &&
    (previous === '"' || previous === "'" || previous === '`')
  )
}

function containsQuotedBuildVersionMarker(content, marker) {
  let offset = content.indexOf(marker)
  while (offset !== -1) {
    if (isQuotedLiteral(content, offset, marker.length)) return true
    offset = content.indexOf(marker, offset + marker.length)
  }
  return false
}

function containsBuildMetadataCluster(content) {
  const candidateStarts = []
  for (const marker of BUILD_METADATA_MARKERS) {
    let offset = content.indexOf(marker)
    while (offset !== -1) {
      candidateStarts.push(offset)
      offset = content.indexOf(marker, offset + marker.length)
    }
  }
  candidateStarts.sort((left, right) => left - right)

  return candidateStarts.some((start) => {
    // This checks string substrings, which cannot be represented by Set.has().
    // oxlint-disable-next-line unicorn/prefer-set-has
    const metadataWindow = content.slice(
      start,
      start + BUILD_METADATA_WINDOW_BYTES
    )
    for (const marker of BUILD_METADATA_MARKERS) {
      if (!metadataWindow.includes(marker)) return false
    }
    return true
  })
}

function containsBuildMetadataMarker(content, marker) {
  return (
    containsQuotedBuildVersionMarker(content, marker) &&
    containsBuildMetadataCluster(content)
  )
}

async function readBuildMetadataContract() {
  const contractPath = new URL(
    '../src/lib/build-metadata-contract.json',
    import.meta.url
  )
  return JSON.parse(await readFile(contractPath, 'utf8'))
}

export async function verifyBuildVersion({
  distPath,
  version,
  channelTag,
  markerPrefix,
  markerSeparator,
}) {
  if (!isValidReleaseVersion(version)) {
    throw new Error(`invalid release version: ${version || '<empty>'}`)
  }
  const overrideValues = [channelTag, markerPrefix, markerSeparator]
  const overrideCount = overrideValues.filter(
    (value) => value !== undefined
  ).length
  if (overrideCount !== 0 && overrideCount !== overrideValues.length) {
    throw new Error(
      'build metadata contract overrides must be provided together'
    )
  }
  const contract =
    overrideCount === overrideValues.length
      ? null
      : await readBuildMetadataContract()
  const expectedChannelTag = channelTag ?? contract?.channelTag
  const expectedMarkerPrefix = markerPrefix ?? contract?.versionMarkerPrefix
  const expectedMarkerSeparator =
    markerSeparator ?? contract?.versionMarkerSeparator
  if (!CHANNEL_PATTERN.test(expectedChannelTag)) {
    throw new Error(
      `invalid build channel tag: ${expectedChannelTag || '<empty>'}`
    )
  }
  if (!MARKER_PREFIX_PATTERN.test(expectedMarkerPrefix)) {
    throw new Error(
      `invalid build version marker prefix: ${expectedMarkerPrefix || '<empty>'}`
    )
  }
  if (!MARKER_SEPARATOR_PATTERN.test(expectedMarkerSeparator)) {
    throw new Error(
      `invalid build version marker separator: ${expectedMarkerSeparator || '<empty>'}`
    )
  }
  const expectedMarker =
    expectedMarkerPrefix +
    version +
    expectedMarkerSeparator +
    expectedChannelTag

  const root = path.resolve(distPath)
  const rootInfo = await lstat(root)
  if (!rootInfo.isDirectory()) {
    throw new Error(`compiled distribution is not a directory: ${root}`)
  }

  const assets = await collectExecutableAssets(root, root)
  if (assets.length === 0) {
    throw new Error(`compiled distribution has no executable assets: ${root}`)
  }

  const matchedFiles = []
  for (const asset of assets) {
    const content = await readFile(asset, 'utf8')
    if (containsBuildMetadataMarker(content, expectedMarker)) {
      matchedFiles.push(path.relative(root, asset).replaceAll(path.sep, '/'))
    }
  }

  if (matchedFiles.length === 0) {
    throw new Error(
      `release version ${version} and build channel ${expectedChannelTag} were not found together in ${assets.length} compiled executable assets`
    )
  }

  return { filesScanned: assets.length, matchedFiles }
}

function parseArguments(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument !== '--dist' && argument !== '--version') {
      throw new Error(`unknown argument: ${argument}`)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`missing value for ${argument}`)
    }
    const key = argument === '--dist' ? 'distPath' : 'version'
    if (options[key]) {
      throw new Error(`duplicate argument: ${argument}`)
    }
    options[key] = value
    index += 1
  }

  if (!options.distPath || !options.version) {
    throw new Error(
      'usage: verify-build-version.mjs --dist <directory> --version <version>'
    )
  }
  return options
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const result = await verifyBuildVersion(options)
  console.log(
    `Verified ${options.version} and its build channel in ${result.matchedFiles.length} of ${result.filesScanned} compiled executable assets.`
  )
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error) => {
    console.error(`build-version verification failed: ${error.message}`)
    process.exitCode = 1
  })
}
