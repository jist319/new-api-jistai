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
import { Check, Copy, Terminal } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

interface ApiEndpointProps {
  apiBaseUrl: string
}

export function ApiEndpoint(props: ApiEndpointProps) {
  const { t } = useTranslation()
  const [copyFailed, setCopyFailed] = useState(false)
  const { copiedText, copyToClipboard } = useCopyToClipboard({
    notify: true,
    successMessage: t('API base URL copied'),
    errorMessage: t('Could not copy the API base URL'),
  })
  const copied = copiedText === props.apiBaseUrl

  let feedback = t('Use this URL in your OpenAI-compatible client')
  if (copied) {
    feedback = t('Copied and ready to use')
  } else if (copyFailed) {
    feedback = t('Copy failed. Select the URL and try again.')
  }

  const handleCopy = async (): Promise<void> => {
    const success = await copyToClipboard(props.apiBaseUrl)
    setCopyFailed(!success)
  }

  const copyButton = (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      className='size-9 rounded-[8px] text-white/70 hover:bg-white/10 hover:text-white'
      onClick={handleCopy}
      aria-label={copied ? t('API base URL copied') : t('Copy API base URL')}
    >
      {copied ? (
        <Check className='size-4 text-emerald-300' />
      ) : (
        <Copy className='size-4' />
      )}
    </Button>
  )

  return (
    <section
      aria-labelledby='jistai-api-base-url-title'
      className='border-y border-white/10 bg-[#101412] px-4 py-7 text-white sm:px-6 sm:py-8'
    >
      <div className='mx-auto max-w-6xl'>
        <div className='flex min-h-10 items-center justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2 text-sm font-medium tracking-normal'>
            <Terminal aria-hidden='true' className='size-4 text-cyan-300' />
            <h2 id='jistai-api-base-url-title'>{t('API base URL')}</h2>
          </div>
          <Tooltip>
            <TooltipTrigger render={copyButton} />
            <TooltipContent>
              <p>
                {copied ? t('API base URL copied') : t('Copy API base URL')}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className='mt-3 border-y border-white/10 py-4'>
          <code className='block min-w-0 font-mono text-base leading-7 break-all text-emerald-200 sm:text-lg'>
            {props.apiBaseUrl}
          </code>
        </div>
        <div className='mt-4 grid gap-2 border-t border-white/10 pt-4 font-mono text-xs leading-5 text-white/55 sm:grid-cols-[auto_1fr]'>
          <span className='text-amber-200'>OPENAI_BASE_URL</span>
          <span className='min-w-0 break-all'>{props.apiBaseUrl}</span>
          <span className='text-cyan-200'>OPENAI_API_KEY</span>
          <span>&lt;your-api-key&gt;</span>
        </div>
        <p
          aria-live='polite'
          className='mt-3 min-h-5 text-xs leading-5 text-white/55'
        >
          {feedback}
        </p>
      </div>
    </section>
  )
}
