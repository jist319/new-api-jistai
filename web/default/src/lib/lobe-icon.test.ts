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
import { describe, test } from 'node:test'

import {
  getLobeIconAssetDimensions,
  getLobeIconAssetRenderMode,
  parseLobeIconDescriptor,
  resolveLobeIconAsset,
  resolveLobeIconCombineAssets,
  shouldMaskLobeIconAsset,
} from './lobe-icon'

describe('static Lobe icon descriptors', () => {
  test('normalizes base and color variants', () => {
    const descriptor = parseLobeIconDescriptor('CherryStudio.Color', 24)
    assert.deepEqual(descriptor, {
      baseKey: 'CherryStudio',
      fallbackLetter: 'C',
      shape: 'circle',
      size: 24,
      slug: 'cherrystudio',
      type: undefined,
      variant: 'color',
    })
    assert.equal(
      resolveLobeIconAsset(
        descriptor!,
        new Set(['cherrystudio.svg', 'cherrystudio-color.svg'])
      ),
      'cherrystudio-color.svg'
    )
  })

  test('preserves Avatar shape, type, and explicit size', () => {
    const descriptor = parseLobeIconDescriptor(
      "OpenAI.Avatar.type={'platform'}.shape={'square'}.size=32",
      20
    )
    assert.equal(descriptor?.variant, 'avatar')
    assert.equal(descriptor?.shape, 'square')
    assert.equal(descriptor?.type, 'platform')
    assert.equal(descriptor?.size, 32)
  })

  test('falls back from a missing color variant to the base asset', () => {
    const descriptor = parseLobeIconDescriptor('OpenAI.Color', 20)
    const file = resolveLobeIconAsset(descriptor!, new Set(['openai.svg']))
    assert.equal(file, 'openai.svg')
    assert.equal(shouldMaskLobeIconAsset(file, new Set(['openai.svg'])), true)
  })

  test('uses masks only when the resolved asset contains currentColor', () => {
    assert.equal(
      shouldMaskLobeIconAsset('yi-color.svg', new Set(['yi-color.svg'])),
      true
    )
    assert.equal(
      shouldMaskLobeIconAsset('claude-color.svg', new Set(['yi-color.svg'])),
      false
    )
    assert.equal(
      getLobeIconAssetRenderMode('lobehub.svg', new Set(['openai.svg'])),
      'image'
    )
    assert.equal(
      getLobeIconAssetRenderMode(
        'crewai-brand.svg',
        new Set(['openai.svg', 'yi-color.svg'])
      ),
      'image'
    )
    assert.equal(
      getLobeIconAssetRenderMode('openai.svg', new Set(['openai.svg'])),
      'mask'
    )
  })

  test('preserves the intrinsic width of wordmark variants', () => {
    const brand = parseLobeIconDescriptor('CrewAI.Brand', 20)
    const file = resolveLobeIconAsset(
      brand!,
      new Set(['crewai.svg', 'crewai-brand.svg'])
    )
    assert.equal(file, 'crewai-brand.svg')
    assert.deepEqual(
      getLobeIconAssetDimensions(brand!, file!, {
        'crewai-brand.svg': 76 / 24,
      }),
      { height: 20, width: 20 * (76 / 24) }
    )

    const base = parseLobeIconDescriptor('LobeHub', 20)
    assert.deepEqual(
      getLobeIconAssetDimensions(base!, 'lobehub.svg', {
        'lobehub.svg': 2,
      }),
      { height: 20, width: 20 }
    )
  })

  test('maps text and combine compatibility variants to static assets', () => {
    const textCn = parseLobeIconDescriptor('Alibaba.TextCn', 20)
    assert.equal(textCn?.variant, 'text-cn')
    assert.equal(
      resolveLobeIconAsset(
        textCn!,
        new Set(['alibaba.svg', 'alibaba-text-cn.svg'])
      ),
      'alibaba-text-cn.svg'
    )

    const textColor = parseLobeIconDescriptor('Civitai.TextColor', 20)
    assert.equal(textColor?.variant, 'text-color')
    assert.equal(
      resolveLobeIconAsset(
        textColor!,
        new Set(['civitai.svg', 'civitai-text-color.svg'])
      ),
      'civitai-text-color.svg'
    )

    const combine = parseLobeIconDescriptor('OpenAI.Combine', 20)
    assert.equal(combine?.variant, 'combine')
    assert.equal(
      resolveLobeIconAsset(
        combine!,
        new Set(['openai.svg', 'openai-text.svg'])
      ),
      'openai-text.svg'
    )
    assert.deepEqual(
      resolveLobeIconCombineAssets(
        combine!,
        new Set(['openai.svg', 'openai-text.svg'])
      ),
      { logo: 'openai.svg', wordmark: 'openai-text.svg' }
    )
  })

  test('rejects keys that could escape the copied asset directory', () => {
    assert.equal(parseLobeIconDescriptor('../OpenAI', 20), null)
    assert.equal(parseLobeIconDescriptor('OpenAI/icon', 20), null)
    assert.equal(parseLobeIconDescriptor('', 20), null)
  })
})
