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

const AVAILABLE_ICON_FILES = new Set(
  typeof __LOBE_ICON_FILES__ === 'undefined' ? [] : __LOBE_ICON_FILES__,
);
const MASK_ICON_FILES = new Set(
  typeof __LOBE_ICON_MASK_FILES__ === 'undefined'
    ? []
    : __LOBE_ICON_MASK_FILES__,
);
const ICON_ASPECT_RATIOS =
  typeof __LOBE_ICON_ASPECT_RATIOS__ === 'undefined'
    ? {}
    : __LOBE_ICON_ASPECT_RATIOS__;
const ICON_ROOT = '/lobe-icons';

const OPENAI_AVATAR_BACKGROUNDS = {
  gpt3: '#19C37D',
  gpt4: '#AB68FF',
  gpt5: '#F86AA4',
  o1: '#F9C322',
  o3: '#F9C322',
  oss: '#0099FF',
  platform: '#0000FE',
};

function parseValue(raw) {
  if (raw == null) return true;
  let value = String(raw).trim();
  if (value.startsWith('{') && value.endsWith('}')) {
    value = value.slice(1, -1).trim();
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export function parseLobeIconDescriptor(iconName, size = 20) {
  if (typeof iconName !== 'string' || !iconName.trim()) return null;
  const segments = iconName.trim().split('.');
  const baseKey = segments[0]?.trim() || '';
  if (!/^[A-Za-z0-9]+$/.test(baseKey)) return null;

  const variants = {
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
  };
  const requestedVariant = variants[segments[1]?.toLowerCase()];
  const props = {};
  for (let index = requestedVariant ? 2 : 1; index < segments.length; index++) {
    const segment = segments[index];
    if (!segment) continue;
    const equals = segment.indexOf('=');
    if (equals === -1) {
      props[segment.trim()] = true;
    } else {
      props[segment.slice(0, equals).trim()] = parseValue(
        segment.slice(equals + 1).trim(),
      );
    }
  }

  const requestedSize = typeof props.size === 'number' ? props.size : size;
  return {
    baseKey,
    fallbackLetter: baseKey.charAt(0).toUpperCase(),
    shape: props.shape === 'square' ? 'square' : 'circle',
    size: Number.isFinite(requestedSize)
      ? Math.min(512, Math.max(8, requestedSize))
      : 20,
    slug: baseKey.toLowerCase(),
    type: typeof props.type === 'string' ? props.type.toLowerCase() : undefined,
    variant: requestedVariant || 'base',
  };
}

function resolveAsset(descriptor) {
  const baseFile = `${descriptor.slug}.svg`;
  const variants = {
    brand: [`${descriptor.slug}-brand.svg`],
    'brand-color': [`${descriptor.slug}-brand-color.svg`],
    color: [`${descriptor.slug}-color.svg`],
    combine: [`${descriptor.slug}-text.svg`, `${descriptor.slug}-brand.svg`],
    text: [`${descriptor.slug}-text.svg`],
    'text-cn': [`${descriptor.slug}-text-cn.svg`],
    'text-color': [`${descriptor.slug}-text-color.svg`],
  };
  const preferred = variants[descriptor.variant] || [];
  for (const candidate of preferred) {
    if (AVAILABLE_ICON_FILES.has(candidate)) return candidate;
  }
  return AVAILABLE_ICON_FILES.has(baseFile) ? baseFile : null;
}

function resolveCombineAssets(descriptor) {
  if (descriptor.variant !== 'combine') return null;

  const logo = `${descriptor.slug}.svg`;
  const wordmark = `${descriptor.slug}-text.svg`;
  return AVAILABLE_ICON_FILES.has(logo) && AVAILABLE_ICON_FILES.has(wordmark)
    ? { logo, wordmark }
    : null;
}

function shouldMaskAsset(file) {
  return MASK_ICON_FILES.has(file);
}

function renderMode(file) {
  return shouldMaskAsset(file) ? 'mask' : 'image';
}

const WORDMARK_VARIANTS = new Set([
  'brand',
  'brand-color',
  'combine',
  'text',
  'text-cn',
  'text-color',
]);

function assetDimensions(descriptor, file) {
  const ratio = WORDMARK_VARIANTS.has(descriptor.variant)
    ? ICON_ASPECT_RATIOS[file] || 1
    : 1;
  return { height: descriptor.size, width: descriptor.size * ratio };
}

function maskStyle(file, dimensions) {
  const url = `url("${ICON_ROOT}/${file}")`;
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
  };
}

function decorativeAsset(file, dimensions) {
  return renderMode(file) === 'mask' ? (
    <span aria-hidden='true' style={maskStyle(file, dimensions)} />
  ) : (
    <img
      alt=''
      aria-hidden='true'
      draggable={false}
      src={`${ICON_ROOT}/${file}`}
      style={dimensions}
    />
  );
}

function FallbackIcon({ className, descriptor, size, style }) {
  return (
    <span
      aria-label='Unknown icon'
      className={`inline-flex shrink-0 items-center justify-center text-xs font-medium ${className || ''}`}
      role='img'
      style={{
        background: 'var(--semi-color-fill-0)',
        borderRadius: '50%',
        color: 'var(--semi-color-text-2)',
        height: size,
        width: size,
        ...style,
      }}
    >
      {descriptor?.fallbackLetter || '?'}
    </span>
  );
}

export function LobeIcon({ className, name, shape, size = 20, style, type }) {
  const descriptor = parseLobeIconDescriptor(name, size);
  if (!descriptor) {
    return <FallbackIcon className={className} size={size} style={style} />;
  }
  if (shape === 'square') descriptor.shape = 'square';
  if (typeof type === 'string') descriptor.type = type.toLowerCase();

  const combineAssets = resolveCombineAssets(descriptor);
  if (combineAssets) {
    const textHeight = descriptor.size * 0.75;
    const textDimensions = {
      height: textHeight,
      width: textHeight * (ICON_ASPECT_RATIOS[combineAssets.wordmark] || 1),
    };
    return (
      <span
        aria-label={descriptor.baseKey}
        className={`inline-flex shrink-0 items-center ${className || ''}`}
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
    );
  }

  const file = resolveAsset(descriptor);
  if (!file) {
    return (
      <FallbackIcon
        className={className}
        descriptor={descriptor}
        size={descriptor.size}
        style={style}
      />
    );
  }

  if (descriptor.variant === 'avatar') {
    const isOpenAI = descriptor.slug === 'openai';
    const colorFile = `${descriptor.slug}-color.svg`;
    const avatarFile =
      !isOpenAI && AVAILABLE_ICON_FILES.has(colorFile) ? colorFile : file;
    const innerSize = descriptor.size * 0.75;
    return (
      <span
        aria-label={descriptor.baseKey}
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className || ''}`}
        role='img'
        style={{
          background: isOpenAI
            ? OPENAI_AVATAR_BACKGROUNDS[descriptor.type] || '#000'
            : 'var(--semi-color-fill-0)',
          border: '1px solid var(--semi-color-border)',
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
    );
  }

  const dimensions = assetDimensions(descriptor, file);
  if (renderMode(file) === 'image') {
    return (
      <img
        alt={descriptor.baseKey}
        className={`inline-block shrink-0 object-contain ${className || ''}`}
        draggable={false}
        src={`${ICON_ROOT}/${file}`}
        style={{ ...dimensions, ...style }}
      />
    );
  }

  return (
    <span
      aria-label={descriptor.baseKey}
      className={`inline-block shrink-0 ${className || ''}`}
      role='img'
      style={{ ...maskStyle(file, dimensions), ...style }}
    />
  );
}

function createLobeIcon(baseKey) {
  const Base = (props) => <LobeIcon name={baseKey} {...props} />;
  Base.Color = (props) => <LobeIcon name={`${baseKey}.Color`} {...props} />;
  Base.Text = (props) => <LobeIcon name={`${baseKey}.Text`} {...props} />;
  Base.TextCn = (props) => <LobeIcon name={`${baseKey}.TextCn`} {...props} />;
  Base.TextColor = (props) => (
    <LobeIcon name={`${baseKey}.TextColor`} {...props} />
  );
  Base.Brand = (props) => <LobeIcon name={`${baseKey}.Brand`} {...props} />;
  Base.BrandColor = (props) => (
    <LobeIcon name={`${baseKey}.BrandColor`} {...props} />
  );
  Base.Avatar = (props) => <LobeIcon name={`${baseKey}.Avatar`} {...props} />;
  Base.Combine = (props) => <LobeIcon name={`${baseKey}.Combine`} {...props} />;
  Base.Morden = (props) => <LobeIcon name={`${baseKey}.Morden`} {...props} />;
  Base.Simple = (props) => <LobeIcon name={`${baseKey}.Simple`} {...props} />;
  return Base;
}

export const Ai360 = createLobeIcon('Ai360');
export const AzureAI = createLobeIcon('AzureAI');
export const Claude = createLobeIcon('Claude');
export const Cloudflare = createLobeIcon('Cloudflare');
export const Cohere = createLobeIcon('Cohere');
export const Coze = createLobeIcon('Coze');
export const DeepSeek = createLobeIcon('DeepSeek');
export const Dify = createLobeIcon('Dify');
export const Doubao = createLobeIcon('Doubao');
export const FastGPT = createLobeIcon('FastGPT');
export const Gemini = createLobeIcon('Gemini');
export const Grok = createLobeIcon('Grok');
export const Hunyuan = createLobeIcon('Hunyuan');
export const Jimeng = createLobeIcon('Jimeng');
export const Jina = createLobeIcon('Jina');
export const Kling = createLobeIcon('Kling');
export const Midjourney = createLobeIcon('Midjourney');
export const Minimax = createLobeIcon('Minimax');
export const Mistral = createLobeIcon('Mistral');
export const Moonshot = createLobeIcon('Moonshot');
export const Ollama = createLobeIcon('Ollama');
export const OpenAI = createLobeIcon('OpenAI');
export const OpenRouter = createLobeIcon('OpenRouter');
export const Perplexity = createLobeIcon('Perplexity');
export const Qingyan = createLobeIcon('Qingyan');
export const Qwen = createLobeIcon('Qwen');
export const Replicate = createLobeIcon('Replicate');
export const SiliconCloud = createLobeIcon('SiliconCloud');
export const Spark = createLobeIcon('Spark');
export const Suno = createLobeIcon('Suno');
export const Volcengine = createLobeIcon('Volcengine');
export const Wenxin = createLobeIcon('Wenxin');
export const XAI = createLobeIcon('XAI');
export const Xinference = createLobeIcon('Xinference');
export const Yi = createLobeIcon('Yi');
export const Zhipu = createLobeIcon('Zhipu');
