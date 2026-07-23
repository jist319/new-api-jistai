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

import type { SystemStatus } from '@/features/auth/types'

import {
  JISTAI_LOGO_FALLBACK,
  resolveJistAIApiBaseUrl,
  resolveJistAIPrimaryDestination,
  resolveJistAIPublicConfig,
} from '../lib/public-config'

describe('JistAI public homepage configuration', () => {
  test('maps current top-level status values into public homepage config', () => {
    const status: SystemStatus = {
      system_name: 'JistAI Global',
      logo: 'https://assets.example.com/jistai.png',
      server_address: 'https://api.example.com/',
      docs_link: 'https://docs.example.com/start',
    }

    assert.deepEqual(resolveJistAIPublicConfig(status), {
      systemName: 'JistAI Global',
      logoUrl: 'https://assets.example.com/jistai.png',
      apiBaseUrl: 'https://api.example.com/v1',
      docsUrl: 'https://docs.example.com/start',
      docsExternal: true,
    })
  })

  test('supports the nested API response shape and internal docs links', () => {
    const status: SystemStatus = {
      data: {
        system_name: 'JistAI',
        logo: '/branding/logo.png',
        server_address: 'https://gateway.example.com/v1/',
        docs_link: '/about',
      },
    }

    assert.deepEqual(resolveJistAIPublicConfig(status), {
      systemName: 'JistAI',
      logoUrl: '/branding/logo.png',
      apiBaseUrl: 'https://gateway.example.com/v1',
      docsUrl: '/about',
      docsExternal: false,
    })
  })

  test('rejects unsafe public URLs and uses stable JistAI fallbacks', () => {
    const status: SystemStatus = {
      logo: 'javascript:alert(1)',
      server_address: 'file:///tmp/socket',
      docs_link: 'data:text/html,unsafe',
    }
    const config = resolveJistAIPublicConfig(status)

    assert.equal(config.logoUrl, JISTAI_LOGO_FALLBACK)
    assert.equal(config.apiBaseUrl, 'https://api.jistai.net/v1')
    assert.equal(config.docsUrl, 'https://docs.newapi.pro')
    assert.equal(config.docsExternal, true)
  })

  test('rejects protocol-relative and backslash-relative public URLs', () => {
    const unsafeUrls = [
      '//evil.example/path',
      '///evil.example/path',
      '/\\evil.example/path',
      '/\n/evil.example/path',
      '/\t/evil.example/path',
      '/\r/evil.example/path',
    ]

    for (const unsafeUrl of unsafeUrls) {
      const config = resolveJistAIPublicConfig({
        logo: unsafeUrl,
        server_address: unsafeUrl,
        docs_link: unsafeUrl,
      })

      assert.equal(config.logoUrl, JISTAI_LOGO_FALLBACK)
      assert.equal(config.apiBaseUrl, 'https://api.jistai.net/v1')
      assert.equal(config.docsUrl, 'https://docs.newapi.pro')
      assert.equal(config.docsExternal, true)
    }
  })

  test('does not append a second version segment to the API base URL', () => {
    assert.equal(
      resolveJistAIApiBaseUrl({
        server_address: 'https://api.example.com/v1/',
      }),
      'https://api.example.com/v1'
    )
  })

  test('appends the version segment before search parameters and fragments', () => {
    assert.equal(
      resolveJistAIApiBaseUrl({
        server_address: 'https://api.example.com/gateway/?tenant=a#client',
      }),
      'https://api.example.com/gateway/v1?tenant=a#client'
    )
    assert.equal(
      resolveJistAIApiBaseUrl({
        server_address: '/gateway/v1/?tenant=a#client',
      }),
      '/gateway/v1?tenant=a#client'
    )
  })

  test('selects the authenticated and public primary destinations', () => {
    assert.equal(resolveJistAIPrimaryDestination(true), '/dashboard')
    assert.equal(resolveJistAIPrimaryDestination(false), '/sign-up')
  })
})
