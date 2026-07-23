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
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface GettingStartedProps {
  apiBaseUrl: string
  docsUrl: string
  docsExternal: boolean
  isAuthenticated: boolean
}

export function GettingStarted(props: GettingStartedProps) {
  const { t } = useTranslation()
  const accountTarget = props.isAuthenticated ? '/keys' : '/sign-up'

  return (
    <section
      aria-labelledby='jistai-getting-started-title'
      className='border-b border-[#dfe8e5] bg-white px-4 py-14 sm:px-6 sm:py-20'
    >
      <div className='mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20'>
        <div>
          <p className='font-mono text-[10px] font-semibold tracking-[0.2em] text-[#b06d1c] uppercase'>
            {t('Connect in three steps')} / 03
          </p>
          <h2
            id='jistai-getting-started-title'
            className='mt-3 text-3xl leading-tight font-semibold tracking-normal text-[#0b1718] sm:text-4xl'
          >
            {t('Connect in three steps')}
          </h2>
          <p className='mt-4 max-w-md text-sm leading-7 text-[#5c6e6a] sm:text-base'>
            {t(
              'Use your existing client conventions and keep credentials in your own environment.'
            )}
          </p>

          <div
            className='mt-8 overflow-hidden rounded-[8px] border border-[#263638] bg-[#0b1314] text-white shadow-[0_18px_40px_-28px_rgba(7,17,18,0.8)]'
            role='region'
            aria-label={t('Environment configuration example')}
          >
            <div className='flex items-center justify-between border-b border-white/10 px-4 py-3 font-mono text-[10px] tracking-[0.16em] text-white/60 uppercase'>
              <span>.env / client config</span>
              <span className='text-lime-200/75'>EXAMPLE</span>
            </div>
            <pre className='overflow-hidden px-4 py-5 font-mono text-xs leading-6 break-all whitespace-pre-wrap sm:px-5 sm:text-sm'>
              <code>
                <span className='text-white/60'>OPENAI_BASE_URL=</span>
                <span className='text-cyan-200'>{props.apiBaseUrl}</span>
                {'\n'}
                <span className='text-white/60'>OPENAI_API_KEY=</span>
                <span className='text-amber-200'>&lt;your-api-key&gt;</span>
              </code>
            </pre>
          </div>
        </div>

        <ol className='border-t border-[#dfe8e5]'>
          <li className='grid gap-3 border-b border-[#dfe8e5] py-6 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-start'>
            <span className='font-mono text-xs font-semibold tracking-[0.14em] text-[#177f83]'>
              01
            </span>
            <div>
              <h3 className='text-base font-semibold tracking-normal text-[#0b1718]'>
                {t('Create an account and API key')}
              </h3>
              <p className='mt-2 text-sm leading-6 text-[#5c6e6a]'>
                {t('Keep separate keys for the applications you operate.')}
              </p>
            </div>
            <Link
              to={accountTarget}
              className='inline-flex min-h-8 items-center gap-1 text-sm font-medium text-[#177f83] underline-offset-4 hover:underline sm:justify-self-end'
            >
              {props.isAuthenticated ? t('Manage keys') : t('Sign up')}
              <ArrowUpRight aria-hidden='true' className='size-4' />
            </Link>
          </li>

          <li className='grid gap-3 border-b border-[#dfe8e5] py-6 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-start'>
            <span className='font-mono text-xs font-semibold tracking-[0.14em] text-[#177f83]'>
              02
            </span>
            <div>
              <h3 className='text-base font-semibold tracking-normal text-[#0b1718]'>
                {t('Set the API base URL')}
              </h3>
              <p className='mt-2 text-sm leading-6 text-[#5c6e6a]'>
                {t('Point your compatible client to the JistAI endpoint.')}
              </p>
            </div>
            <span className='font-mono text-[10px] tracking-[0.14em] text-[#5f716c] uppercase sm:justify-self-end sm:pt-1'>
              ENV / BASE
            </span>
          </li>

          <li className='grid gap-3 border-b border-[#dfe8e5] py-6 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-start'>
            <span className='font-mono text-xs font-semibold tracking-[0.14em] text-[#b06d1c]'>
              03
            </span>
            <div>
              <h3 className='text-base font-semibold tracking-normal text-[#0b1718]'>
                {t('Send and review requests')}
              </h3>
              <p className='mt-2 text-sm leading-6 text-[#5c6e6a]'>
                {t('Follow usage and account activity from your dashboard.')}
              </p>
            </div>
            <a
              href={props.docsUrl}
              target={props.docsExternal ? '_blank' : undefined}
              rel={props.docsExternal ? 'noopener noreferrer' : undefined}
              className='inline-flex min-h-8 items-center gap-1 text-sm font-medium text-[#177f83] underline-offset-4 hover:underline sm:justify-self-end'
            >
              {t('Open docs')}
              <ArrowUpRight aria-hidden='true' className='size-4' />
            </a>
          </li>
        </ol>
      </div>
    </section>
  )
}
