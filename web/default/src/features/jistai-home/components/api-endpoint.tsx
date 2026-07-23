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
import { Check, Copy, ExternalLink, Terminal } from 'lucide-react'
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
      className='size-9 rounded-[6px] text-white/65 hover:bg-white/10 hover:text-white'
      onClick={handleCopy}
      aria-label={copied ? t('API base URL copied') : t('Copy API base URL')}
    >
      {copied ? (
        <Check className='size-4 text-lime-200' />
      ) : (
        <Copy className='size-4' />
      )}
    </Button>
  )

  return (
    <section
      id='jistai-api-base-url'
      aria-labelledby='jistai-api-base-url-title'
      className='border-b border-[#d7e2df] bg-[#edf3f1] px-4 py-10 sm:px-6 sm:py-14'
    >
      <div className='mx-auto max-w-7xl'>
        <div className='flex flex-col gap-4 border-b border-[#ccd9d5] pb-6 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='font-mono text-[10px] font-semibold tracking-[0.2em] text-[#177f83] uppercase'>
              {t('API base URL')} / 01
            </p>
            <h2
              id='jistai-api-base-url-title'
              className='mt-2 text-2xl font-semibold tracking-normal text-[#0b1718] sm:text-3xl'
            >
              {t('API base URL')}
            </h2>
          </div>
          <div className='inline-flex w-fit items-center gap-2 rounded-[6px] border border-[#b7d8c3] bg-[#e5f5e9] px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#247044] uppercase'>
            <span className='size-1.5 rounded-full bg-[#39a85a]' />
            {t('Environment configuration example')}
          </div>
        </div>

        <div className='mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]'>
          <div className='min-w-0 overflow-hidden rounded-[8px] border border-[#263638] bg-[#0b1314] text-white shadow-[0_18px_40px_-28px_rgba(7,17,18,0.8)]'>
            <div className='flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5'>
              <div className='flex min-w-0 items-center gap-2 font-mono text-xs font-medium text-white/80'>
                <Terminal aria-hidden='true' className='size-4 shrink-0 text-cyan-200' />
                <span className='truncate'>OPENAI_BASE_URL</span>
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

            <div className='px-4 py-5 sm:px-5 sm:py-6'>
              <code className='block min-w-0 font-mono text-base leading-7 break-all text-cyan-200 sm:text-xl sm:leading-8'>
                {props.apiBaseUrl}
              </code>
              <p
                aria-live='polite'
                className='mt-3 min-h-5 text-xs leading-5 text-white/60'
              >
                {feedback}
              </p>
            </div>

            <div className='grid gap-2 border-t border-white/10 px-4 py-4 font-mono text-[11px] leading-5 sm:grid-cols-[auto_1fr] sm:px-5'>
              <span className='text-amber-200'>OPENAI_API_KEY</span>
              <span className='min-w-0 break-all text-white/55'>&lt;your-api-key&gt;</span>
              <span className='text-lime-200'>SDK MODE</span>
              <span className='text-white/55'>OpenAI-compatible / streaming</span>
            </div>
          </div>

          <div className='flex flex-col justify-between rounded-[8px] border border-[#cddbd7] bg-white/70 p-4 sm:p-5'>
            <div>
              <div className='flex size-9 items-center justify-center rounded-[6px] bg-[#dff1ee] text-[#177f83]'>
                <ExternalLink aria-hidden='true' className='size-4' />
              </div>
              <p className='mt-5 font-mono text-[10px] font-semibold tracking-[0.16em] text-[#4d625d] uppercase'>
                {t('OpenAI-compatible endpoint')}
              </p>
              <p className='mt-2 text-sm leading-6 text-[#314542]'>
                {t('Use this URL in your OpenAI-compatible client')}
              </p>
            </div>
            <div className='mt-7 border-t border-[#d7e2df] pt-4 font-mono text-[10px] leading-5 text-[#4d625d]'>
              <span className='text-[#177f83]'>BASE</span>
              <br />
              /v1
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
