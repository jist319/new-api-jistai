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
      className='bg-muted/25 px-4 py-14 sm:px-6 sm:py-18'
    >
      <div className='mx-auto max-w-6xl'>
        <div className='max-w-2xl'>
          <p className='text-sm font-semibold tracking-normal text-cyan-700 dark:text-cyan-300'>
            {t('One practical workspace')}
          </p>
          <h2
            id='jistai-capabilities-title'
            className='mt-2 text-2xl leading-tight font-semibold tracking-normal sm:text-3xl'
          >
            {t('Built for dependable AI workflows')}
          </h2>
          <p className='text-muted-foreground mt-3 text-base leading-7 tracking-normal'>
            {t(
              'Keep integration, delivery, and account visibility together as your usage grows.'
            )}
          </p>
        </div>

        <div className='mt-8 grid gap-4 md:grid-cols-3'>
          <article className='border-border bg-background rounded-[8px] border p-5'>
            <div className='flex size-10 items-center justify-center rounded-[8px] bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'>
              <Waypoints aria-hidden='true' className='size-5' />
            </div>
            <h3 className='mt-5 text-base font-semibold tracking-normal'>
              {t('OpenAI-compatible endpoint')}
            </h3>
            <p className='text-muted-foreground mt-2 text-sm leading-6 tracking-normal'>
              {t(
                'Connect familiar SDKs and tools through a consistent API base URL.'
              )}
            </p>
          </article>

          <article className='border-border bg-background rounded-[8px] border p-5'>
            <div className='flex size-10 items-center justify-center rounded-[8px] bg-cyan-500/12 text-cyan-700 dark:text-cyan-300'>
              <Radio aria-hidden='true' className='size-5' />
            </div>
            <h3 className='mt-5 text-base font-semibold tracking-normal'>
              {t('Streaming and tool workflows')}
            </h3>
            <p className='text-muted-foreground mt-2 text-sm leading-6 tracking-normal'>
              {t(
                'Build responsive experiences with streaming responses and tool-enabled request patterns.'
              )}
            </p>
          </article>

          <article className='border-border bg-background rounded-[8px] border p-5'>
            <div className='flex size-10 items-center justify-center rounded-[8px] bg-amber-500/14 text-amber-700 dark:text-amber-300'>
              <ChartNoAxesCombined aria-hidden='true' className='size-5' />
            </div>
            <h3 className='mt-5 text-base font-semibold tracking-normal'>
              {t('Usage and account control')}
            </h3>
            <p className='text-muted-foreground mt-2 text-sm leading-6 tracking-normal'>
              {t(
                'Create keys, review usage, and manage account access from one workspace.'
              )}
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
