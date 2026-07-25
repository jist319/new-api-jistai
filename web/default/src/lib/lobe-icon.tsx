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
import type { CSSProperties, ReactNode } from 'react'

declare const __LOBE_ICON_FILES__: readonly string[]
declare const __LOBE_ICON_MASK_FILES__: readonly string[]
declare const __LOBE_ICON_ASPECT_RATIOS__: Readonly<Record<string, number>>

const AVAILABLE_ICON_FILES = new Set(
  typeof __LOBE_ICON_FILES__ === 'undefined' ? [] : __LOBE_ICON_FILES__
)
const MASK_ICON_FILES = new Set(
  typeof __LOBE_ICON_MASK_FILES__ === 'undefined'
    ? []
    : __LOBE_ICON_MASK_FILES__
)
const ICON_ASPECT_RATIOS =
  typeof __LOBE_ICON_ASPECT_RATIOS__ === 'undefined'
    ? {}
    : __LOBE_ICON_ASPECT_RATIOS__
const ICON_ROOT = '/lobe-icons'

const OPENAI_AVATAR_BACKGROUNDS: Record<string, string> = {
  gpt3: '#19C37D',
  gpt4: '#AB68FF',
  gpt5: '#F86AA4',
  o1: '#F9C322',
  o3: '#F9C322',
  oss: '#0099FF',
  platform: '#0000FE',
}

type LobeIconVariant =
  | 'avatar'
  | 'base'
  | 'brand'
  | 'brand-color'
  | 'color'
  | 'combine'
  | 'morden'
  | 'simple'
  | 'text'
  | 'text-cn'
  | 'text-color'

export interface LobeIconDescriptor {
  baseKey: string
  fallbackLetter: string
  shape: 'circle' | 'square'
  size: number
  slug: string
  type?: string
  variant: LobeIconVariant
}

interface LobeIconProps {
  className?: string
  name: string | null | undefined
  size?: number
  style?: CSSProperties
}

/**
 * Parse a property value from string to appropriate type
 * @param raw - Raw string value
 * @returns Parsed value (boolean, number, or string)
 */
function parseValue(raw: string | undefined | null): string | number | boolean {
  if (raw == null) return true

  let v = String(raw).trim()

  // Remove curly braces
  if (v.startsWith('{') && v.endsWith('}')) {
    v = v.slice(1, -1).trim()
  }

  // Remove quotes
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1)
  }

  // Boolean
  if (v === 'true') return true
  if (v === 'false') return false

  // Number
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)

  // Return as string
  return v
}

export function parseLobeIconDescriptor(
  iconName: string | undefined | null,
  size: number = 20
): LobeIconDescriptor | null {
  if (!iconName || typeof iconName !== 'string') return null

  const trimmedName = iconName.trim()
  if (!trimmedName) return null
  const segments = trimmedName.split('.')
  const baseKey = segments[0]?.trim() ?? ''
  if (!/^[A-Za-z0-9]+$/.test(baseKey)) return null

  const variantNames: Record<string, LobeIconVariant> = {
    avatar: 'avatar',
    brand: 'brand',
    brandcolor: 'brand-color',
    color: 'color',
    combine: 'combine',
    morden: 'morden',
    simple: 'simple',
    text: 'text',
    textcn: 'text-cn',
    textcolor: 'text-color',
  }
  const requestedVariant = variantNames[segments[1]?.toLowerCase()]
  const variant = requestedVariant ?? 'base'
  const propStartIndex = requestedVariant ? 2 : 1
  const props: Record<string, string | number | boolean> = {}
  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg) continue

    const eqIdx = seg.indexOf('=')
    if (eqIdx === -1) {
      props[seg.trim()] = true
      continue
    }

    const key = seg.slice(0, eqIdx).trim()
    const valRaw = seg.slice(eqIdx + 1).trim()
    props[key] = parseValue(valRaw)
  }

  const requestedSize = typeof props.size === 'number' ? props.size : size
  const safeSize = Number.isFinite(requestedSize)
    ? Math.min(512, Math.max(8, requestedSize))
    : 20

  return {
    baseKey,
    fallbackLetter: baseKey.charAt(0).toUpperCase(),
    shape: props.shape === 'square' ? 'square' : 'circle',
    size: safeSize,
    slug: baseKey.toLowerCase(),
    type: typeof props.type === 'string' ? props.type.toLowerCase() : undefined,
    variant,
  }
}

export function resolveLobeIconAsset(
  descriptor: LobeIconDescriptor,
  availableFiles: ReadonlySet<string> = AVAILABLE_ICON_FILES
): string | null {
  const baseFile = `${descriptor.slug}.svg`
  const variantFiles: Partial<Record<LobeIconVariant, string[]>> = {
    brand: [`${descriptor.slug}-brand.svg`],
    'brand-color': [`${descriptor.slug}-brand-color.svg`],
    color: [`${descriptor.slug}-color.svg`],
    combine: [`${descriptor.slug}-text.svg`, `${descriptor.slug}-brand.svg`],
    text: [`${descriptor.slug}-text.svg`],
    'text-cn': [`${descriptor.slug}-text-cn.svg`],
    'text-color': [`${descriptor.slug}-text-color.svg`],
  }
  const preferred = variantFiles[descriptor.variant] ?? []
  for (const candidate of preferred) {
    if (availableFiles.has(candidate)) return candidate
  }
  return availableFiles.has(baseFile) ? baseFile : null
}

export function resolveLobeIconCombineAssets(
  descriptor: LobeIconDescriptor,
  availableFiles: ReadonlySet<string> = AVAILABLE_ICON_FILES
): { logo: string; wordmark: string } | null {
  if (descriptor.variant !== 'combine') return null

  const logo = `${descriptor.slug}.svg`
  const wordmark = `${descriptor.slug}-text.svg`
  return availableFiles.has(logo) && availableFiles.has(wordmark)
    ? { logo, wordmark }
    : null
}

export function shouldMaskLobeIconAsset(
  file: string | null,
  maskFiles: ReadonlySet<string> = MASK_ICON_FILES
): boolean {
  return file !== null && maskFiles.has(file)
}

export function getLobeIconAssetRenderMode(
  file: string,
  maskFiles: ReadonlySet<string> = MASK_ICON_FILES
): 'image' | 'mask' {
  return shouldMaskLobeIconAsset(file, maskFiles) ? 'mask' : 'image'
}

const WORDMARK_VARIANTS: ReadonlySet<LobeIconVariant> = new Set([
  'brand',
  'brand-color',
  'combine',
  'text',
  'text-cn',
  'text-color',
])

export function getLobeIconAssetDimensions(
  descriptor: LobeIconDescriptor,
  file: string,
  aspectRatios: Readonly<Record<string, number>> = ICON_ASPECT_RATIOS
): { height: number; width: number } {
  const ratio = WORDMARK_VARIANTS.has(descriptor.variant)
    ? (aspectRatios[file] ?? 1)
    : 1
  return { height: descriptor.size, width: descriptor.size * ratio }
}

function iconMaskStyle(
  file: string,
  dimensions: { height: number; width: number }
): CSSProperties {
  const url = `url("${ICON_ROOT}/${file}")`
  return {
    WebkitMaskImage: url,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    backgroundColor: 'currentColor',
    height: dimensions.height,
    maskImage: url,
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize: 'contain',
    width: dimensions.width,
  }
}

function decorativeAsset(
  file: string,
  dimensions: { height: number; width: number }
) {
  return getLobeIconAssetRenderMode(file) === 'mask' ? (
    <span aria-hidden='true' style={iconMaskStyle(file, dimensions)} />
  ) : (
    <img
      alt=''
      aria-hidden='true'
      draggable={false}
      src={`${ICON_ROOT}/${file}`}
      style={dimensions}
    />
  )
}

function fallbackIcon(
  descriptor: LobeIconDescriptor | null,
  size: number,
  className?: string,
  style?: CSSProperties
) {
  return (
    <span
      aria-label='Unknown icon'
      className={`bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-full text-xs font-medium ${className ?? ''}`}
      role='img'
      style={{ height: size, width: size, ...style }}
    >
      {descriptor?.fallbackLetter || '?'}
    </span>
  )
}

export function LobeIcon({ className, name, size = 20, style }: LobeIconProps) {
  const descriptor = parseLobeIconDescriptor(name, size)
  if (!descriptor) return fallbackIcon(null, size, className, style)

  const combineAssets = resolveLobeIconCombineAssets(descriptor)
  if (combineAssets) {
    const textHeight = descriptor.size * 0.75
    const textDimensions = {
      height: textHeight,
      width: textHeight * (ICON_ASPECT_RATIOS[combineAssets.wordmark] ?? 1),
    }
    return (
      <span
        aria-label={descriptor.baseKey}
        className={`inline-flex shrink-0 items-center ${className ?? ''}`}
        role='img'
        style={{
          gap: descriptor.size * 0.1,
          height: descriptor.size,
          ...style,
        }}
      >
        {decorativeAsset(combineAssets.logo, {
          height: descriptor.size,
          width: descriptor.size,
        })}
        {decorativeAsset(combineAssets.wordmark, textDimensions)}
      </span>
    )
  }

  const file = resolveLobeIconAsset(descriptor)
  if (!file) return fallbackIcon(descriptor, descriptor.size, className, style)

  if (descriptor.variant === 'avatar') {
    const isOpenAI = descriptor.slug === 'openai'
    const background = isOpenAI
      ? OPENAI_AVATAR_BACKGROUNDS[descriptor.type ?? ''] || '#000'
      : undefined
    const innerSize = descriptor.size * 0.75
    const colorFile = `${descriptor.slug}-color.svg`
    const avatarFile =
      !isOpenAI && AVAILABLE_ICON_FILES.has(colorFile) ? colorFile : file
    return (
      <span
        aria-label={descriptor.baseKey}
        className={`border-border/50 bg-muted inline-flex shrink-0 items-center justify-center overflow-hidden border ${className ?? ''}`}
        role='img'
        style={{
          background,
          borderRadius:
            descriptor.shape === 'circle'
              ? '50%'
              : Math.floor(descriptor.size * 0.1),
          color: isOpenAI ? '#fff' : 'currentColor',
          height: descriptor.size,
          width: descriptor.size,
          ...style,
        }}
      >
        {decorativeAsset(avatarFile, {
          height: innerSize,
          width: innerSize,
        })}
      </span>
    )
  }

  const dimensions = getLobeIconAssetDimensions(descriptor, file)
  if (getLobeIconAssetRenderMode(file) === 'image') {
    return (
      <img
        alt={descriptor.baseKey}
        className={`inline-block shrink-0 object-contain ${className ?? ''}`}
        draggable={false}
        src={`${ICON_ROOT}/${file}`}
        style={{ ...dimensions, ...style }}
      />
    )
  }

  return (
    <span
      aria-label={descriptor.baseKey}
      className={`inline-block shrink-0 ${className ?? ''}`}
      role='img'
      style={{ ...iconMaskStyle(file, dimensions), ...style }}
    />
  )
}

export function getLobeIcon(
  iconName: string | undefined | null,
  size: number = 20
): ReactNode {
  return <LobeIcon name={iconName} size={size} />
}
