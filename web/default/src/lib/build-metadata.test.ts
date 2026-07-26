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
import { test } from 'node:test'

import {
  deriveBuildRevision,
  getBuildRevision,
  installBuildMetadata,
} from './build-metadata'

test('derives the runtime revision from the source-owned composite marker', () => {
  assert.equal(
    deriveBuildRevision('jistai-build-version:v1.0.0-rc.21.jistai.1@2k6e8r7p'),
    'rv.v1.0.0-rc.21.jistai.1.2k6e8r7p'
  )
  assert.equal(
    deriveBuildRevision('untrusted-prefix:v1.0.0-rc.21.jistai.1@2k6e8r7p'),
    'rv.0000.2k6e8r7p'
  )
  assert.equal(
    deriveBuildRevision('jistai-build-version:v1.0.0-rc.21.jistai.12k6e8r7p'),
    'rv.0000.2k6e8r7p'
  )
  assert.equal(
    deriveBuildRevision(
      'jistai-build-version:v1.0.0-rc.21.jistai.1@wrong-channel'
    ),
    'rv.0000.2k6e8r7p'
  )
  assert.equal(
    deriveBuildRevision('jistai-build-version:@2k6e8r7p'),
    'rv.0000.2k6e8r7p'
  )
  assert.equal(
    deriveBuildRevision('jistai-build-version:v1.0.0@unexpected@2k6e8r7p'),
    'rv.0000.2k6e8r7p'
  )
})

test('falls back safely when the compile-time build marker is absent', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document'
  )
  const attributes = new Map<string, string>()
  const styleValues = new Map<string, string>()
  const storedValues = new Map<string, string>()
  const windowStub: {
    __APP_BUILD__?: { rev: string; ch: string; marker: string }
    localStorage: { setItem: (key: string, value: string) => void }
  } = {
    localStorage: {
      setItem: (key, value) => storedValues.set(key, value),
    },
  }
  const documentElement = {
    hasAttribute: (name: string) => attributes.has(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    style: {
      setProperty: (name: string, value: string) =>
        styleValues.set(name, value),
    },
  }
  const documentStub = {
    documentElement,
    head: { appendChild: () => undefined },
    querySelector: () => null,
    createElement: () => ({ setAttribute: () => undefined }),
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: windowStub,
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: documentStub,
  })

  try {
    assert.doesNotThrow(() => installBuildMetadata())
    assert.equal(getBuildRevision(), 'rv.0000.2k6e8r7p')
    assert.equal(windowStub.__APP_BUILD__?.rev, 'rv.0000.2k6e8r7p')
    assert.equal(windowStub.__APP_BUILD__?.ch, '2k6e8r7p')
    assert.equal(windowStub.__APP_BUILD__?.marker, '')
    assert.equal(attributes.get('data-build-rev'), 'rv.0000.2k6e8r7p')
    assert.equal(styleValues.get('--app-build-rev'), "'rv.0000.2k6e8r7p'")
    assert.equal(storedValues.get('app:rev'), 'rv.0000.2k6e8r7p')
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
    if (originalDocument) {
      Object.defineProperty(globalThis, 'document', originalDocument)
    } else {
      Reflect.deleteProperty(globalThis, 'document')
    }
  }
})
