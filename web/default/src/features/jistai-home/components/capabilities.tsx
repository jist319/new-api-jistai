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
import { ChartNoAxesCombined, Radio, Waypoints } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Capabilities() {
  const { t } = useTranslation()

  return (
    <section
      aria-labelledby='jistai-capabilities-title'
      className='border-b border-[#dfe8e5] bg-[#f7faf9] px-4 py-14 sm:px-6 sm:py-20'
    >
      <div className='mx-auto max-w-7xl'>
        <div className='flex flex-col gap-5 border-b border-[#dfe8e5] pb-8 lg:flex-row lg:items-end lg:justify-between'>
          <div className='max-w-2xl'>
            <p className='font-mono text-[10px] font-semibold tracking-[0.2em] text-[#177f83] uppercase'>
              {t('Built for dependable AI workflows')} / 02
            </p>
            <h2
              id='jistai-capabilities-title'
              className='mt-3 text-3xl leading-tight font-semibold tracking-normal text-[#0b1718] sm:text-4xl'
            >
              {t('Built for dependable AI workflows')}
            </h2>
          </div>
          <p className='max-w-md text-sm leading-6 text-[#5c6e6a]'>
            {t(
              'Keep integration, delivery, and account visibility together as your usage grows.'
            )}
          </p>
        </div>

        <div className='mt-6 grid gap-4 lg:grid-cols-12'>
          <article className='group relative overflow-hidden rounded-[8px] border border-[#223436] bg-[#0d1718] p-6 text-white lg:col-span-7 lg:min-h-[286px] sm:p-8'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex size-11 items-center justify-center rounded-[6px] bg-cyan-300 text-[#0b1718]'>
                <Waypoints aria-hidden='true' className='size-5' />
              </div>
              <span className='font-mono text-[10px] tracking-[0.16em] text-cyan-200/70 uppercase'>
                ROUTE / 01
              </span>
            </div>
            <h3 className='mt-8 text-xl font-semibold tracking-normal'>
              {t('OpenAI-compatible endpoint')}
            </h3>
            <p className='mt-3 max-w-lg text-sm leading-6 text-white/55'>
              {t(
                'Connect familiar SDKs and tools through a consistent API base URL.'
              )}
            </p>
            <div className='mt-7 grid gap-2 border-t border-white/10 pt-4 font-mono text-[10px] text-white/60 sm:grid-cols-3'>
              <span className='text-cyan-200/80'>POST /v1</span>
              <span>JSON + SSE</span>
              <span className='sm:text-right'>ONE BASE URL</span>
            </div>
          </article>

          <article className='rounded-[8px] border border-[#d5e1dd] bg-white p-6 lg:col-span-5 lg:min-h-[286px] sm:p-8'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex size-11 items-center justify-center rounded-[6px] bg-[#e4f4ee] text-[#247044]'>
                <Radio aria-hidden='true' className='size-5' />
              </div>
              <span className='font-mono text-[10px] tracking-[0.16em] text-[#4d625d] uppercase'>
                {t('Streaming and tool workflows')} / 02
              </span>
            </div>
            <h3 className='mt-8 text-xl font-semibold tracking-normal text-[#0b1718]'>
              {t('Streaming and tool workflows')}
            </h3>
            <p className='mt-3 text-sm leading-6 text-[#5c6e6a]'>
              {t(
                'Build responsive experiences with streaming responses and tool-enabled request patterns.'
              )}
            </p>
            <div className='mt-7 flex items-center gap-2 border-t border-[#e0e8e5] pt-4 font-mono text-[10px] text-[#4d625d]'>
              <span className='size-1.5 rounded-full bg-[#39a85a]' />
              STREAMING REQUEST PATTERN
            </div>
          </article>

          <article className='rounded-[8px] border border-[#d5e1dd] bg-[#e9f1ef] p-6 lg:col-span-5 lg:min-h-[230px] sm:p-8'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex size-11 items-center justify-center rounded-[6px] bg-[#d3e6e1] text-[#177f83]'>
                <ChartNoAxesCombined aria-hidden='true' className='size-5' />
              </div>
              <span className='font-mono text-[10px] tracking-[0.16em] text-[#4d625d] uppercase'>
                {t('Usage and account control')} / 03
              </span>
            </div>
            <h3 className='mt-7 text-xl font-semibold tracking-normal text-[#0b1718]'>
              {t('Usage and account control')}
            </h3>
            <p className='mt-3 text-sm leading-6 text-[#5c6e6a]'>
              {t(
                'Create keys, review usage, and manage account access from one workspace.'
              )}
            </p>
          </article>

          <div className='flex flex-col justify-between rounded-[8px] border border-[#d5e1dd] bg-white p-6 lg:col-span-7 lg:min-h-[230px] sm:p-8'>
            <div className='flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <p className='font-mono text-[10px] tracking-[0.18em] text-[#4d625d] uppercase'>
                  {t('One practical workspace')}
                </p>
                <p className='mt-3 max-w-md text-lg leading-7 font-medium tracking-normal text-[#0b1718]'>
                  {t('One practical workspace')}
                </p>
              </div>
              <div className='flex items-center gap-1.5 pt-1' aria-hidden='true'>
                <span className='size-2 rounded-full bg-[#177f83]' />
                <span className='size-2 rounded-full bg-[#7ec9bd]' />
                <span className='size-2 rounded-full bg-[#d2e8e1]' />
              </div>
            </div>
            <div className='mt-8 grid gap-3 border-t border-[#e0e8e5] pt-4 font-mono text-[10px] tracking-[0.12em] text-[#4d625d] uppercase sm:grid-cols-3'>
              <span>KEYS / ACCESS</span>
              <span>USAGE / COST</span>
              <span className='sm:text-right'>ACTIVITY / REVIEW</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
