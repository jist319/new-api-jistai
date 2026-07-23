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
import type { SystemStatus } from '@/features/auth/types'

export const JISTAI_LOGO_FALLBACK = '/logo.png'

const API_BASE_FALLBACK = 'https://api.jistai.net'
const DOCS_FALLBACK = 'https://docs.newapi.pro'
const INTERNAL_URL_BASE = 'https://jistai.invalid'

export interface JistAIPublicConfig {
  systemName: string
  logoUrl: string
  apiBaseUrl: string
  docsUrl: string
  docsExternal: boolean
}

export type JistAIPrimaryDestination = '/dashboard' | '/sign-up'

function getStatusString(
  status: SystemStatus | null,
  key: string
): string | undefined {
  const directValue = status?.[key]
  if (typeof directValue === 'string' && directValue.trim()) {
    return directValue.trim()
  }

  const nestedValue = status?.data?.[key]
  if (typeof nestedValue === 'string' && nestedValue.trim()) {
    return nestedValue.trim()
  }

  return undefined
}

function resolveHttpUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback

  try {
    const isRelative = value.startsWith('/')
    const url = isRelative ? new URL(value, INTERNAL_URL_BASE) : new URL(value)

    if (isRelative && url.origin !== INTERNAL_URL_BASE) return fallback
    if (url.protocol === 'http:' || url.protocol === 'https:') return value
  } catch {
    return fallback
  }

  return fallback
}

export function resolveJistAIApiBaseUrl(status: SystemStatus | null): string {
  const serverAddress = resolveHttpUrl(
    getStatusString(status, 'server_address'),
    API_BASE_FALLBACK
  )
  const isRelative = serverAddress.startsWith('/')
  const url = isRelative
    ? new URL(serverAddress, INTERNAL_URL_BASE)
    : new URL(serverAddress)
  const pathname = url.pathname.replace(/\/+$/, '')

  url.pathname = /\/v1$/i.test(pathname) ? pathname : `${pathname}/v1`

  return isRelative ? `${url.pathname}${url.search}${url.hash}` : url.toString()
}

export function resolveJistAIPrimaryDestination(
  isAuthenticated: boolean
): JistAIPrimaryDestination {
  return isAuthenticated ? '/dashboard' : '/sign-up'
}

export function resolveJistAIPublicConfig(
  status: SystemStatus | null
): JistAIPublicConfig {
  const docsUrl = resolveHttpUrl(
    getStatusString(status, 'docs_link'),
    DOCS_FALLBACK
  )

  return {
    systemName: getStatusString(status, 'system_name') || 'JistAI',
    logoUrl: resolveHttpUrl(
      getStatusString(status, 'logo'),
      JISTAI_LOGO_FALLBACK
    ),
    apiBaseUrl: resolveJistAIApiBaseUrl(status),
    docsUrl,
    docsExternal: /^https?:\/\//i.test(docsUrl),
  }
}
