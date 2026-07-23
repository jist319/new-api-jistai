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
export const MAX_CONCURRENCY_LIMIT = 2_147_483_647

export type ConcurrencyLimitMap = Record<string, number>

export function isConcurrencyLimitMap(
  value: unknown
): value is ConcurrencyLimitMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  return Object.entries(value as Record<string, unknown>).every(
    ([groupName, limit]) =>
      groupName.trim().length > 0 &&
      typeof limit === 'number' &&
      Number.isInteger(limit) &&
      limit >= 0 &&
      limit <= MAX_CONCURRENCY_LIMIT
  )
}

export function parseConcurrencyLimitMap(
  value: string | undefined | null
): ConcurrencyLimitMap {
  if (!value || value.trim() === '') return {}

  try {
    const parsed: unknown = JSON.parse(value)
    return isConcurrencyLimitMap(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function isValidConcurrencyLimitJson(
  value: string | undefined
): boolean {
  if (!value || value.trim() === '') return false

  try {
    return isConcurrencyLimitMap(JSON.parse(value))
  } catch {
    return false
  }
}
