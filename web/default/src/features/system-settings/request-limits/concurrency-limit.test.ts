/*
Copyright (C) 2023-2026 QuantumNous

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

For commercial licensing, please contact support@quantumnous.com
*/
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  MAX_CONCURRENCY_LIMIT,
  isConcurrencyLimitMap,
  isValidConcurrencyLimitJson,
  parseConcurrencyLimitMap,
} from './concurrency-limit'

describe('concurrency limit group configuration', () => {
  test('accepts integer limits including explicit unlimited and int32 max', () => {
    const limits = {
      default: 5,
      vip: 0,
      enterprise: MAX_CONCURRENCY_LIMIT,
    }

    assert.equal(isConcurrencyLimitMap(limits), true)
    assert.equal(isValidConcurrencyLimitJson(JSON.stringify(limits)), true)
    assert.deepEqual(parseConcurrencyLimitMap(JSON.stringify(limits)), limits)
  })

  test('rejects non-object JSON and non-integer or out-of-range values', () => {
    const invalidValues: unknown[] = [
      null,
      [],
      { '': 1 },
      { '   ': 1 },
      { vip: -1 },
      { vip: 1.5 },
      { vip: MAX_CONCURRENCY_LIMIT + 1 },
      { vip: '5' },
      { vip: true },
    ]

    for (const value of invalidValues) {
      assert.equal(isConcurrencyLimitMap(value), false)
      assert.equal(isValidConcurrencyLimitJson(JSON.stringify(value)), false)
    }
  })

  test('requires an explicit JSON object and safely falls back for invalid input', () => {
    assert.equal(isValidConcurrencyLimitJson(''), false)
    assert.equal(isValidConcurrencyLimitJson('{invalid'), false)
    assert.deepEqual(parseConcurrencyLimitMap(''), {})
    assert.deepEqual(parseConcurrencyLimitMap('{"vip": 2.5}'), {})
    assert.deepEqual(parseConcurrencyLimitMap('{invalid'), {})
  })
})
