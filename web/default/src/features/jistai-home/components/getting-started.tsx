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
      className='border-border/70 border-t px-4 py-14 sm:px-6 sm:py-18'
    >
      <div className='mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16'>
        <div>
          <p className='text-sm font-semibold tracking-normal text-amber-700 dark:text-amber-300'>
            {t('Start with the essentials')}
          </p>
          <h2
            id='jistai-getting-started-title'
            className='mt-2 text-2xl leading-tight font-semibold tracking-normal sm:text-3xl'
          >
            {t('Connect in three steps')}
          </h2>
          <p className='text-muted-foreground mt-3 text-base leading-7 tracking-normal'>
            {t(
              'Use your existing client conventions and keep credentials in your own environment.'
            )}
          </p>

          <div
            className='border-border mt-6 rounded-[8px] border bg-[#101412] p-4 text-white'
            role='region'
            aria-label={t('Environment configuration example')}
          >
            <pre className='overflow-hidden font-mono text-xs leading-6 break-all whitespace-pre-wrap sm:text-sm'>
              <code>
                <span className='text-white/50'>OPENAI_BASE_URL=</span>
                <span className='text-emerald-200'>{props.apiBaseUrl}</span>
                {'\n'}
                <span className='text-white/50'>OPENAI_API_KEY=</span>
                <span className='text-cyan-200'>&lt;your-api-key&gt;</span>
              </code>
            </pre>
          </div>
        </div>

        <ol className='border-border border-t'>
          <li className='border-border grid gap-3 border-b py-5 sm:grid-cols-[2.5rem_1fr_auto] sm:items-start'>
            <span className='font-mono text-sm text-emerald-700 dark:text-emerald-300'>
              01
            </span>
            <div>
              <h3 className='font-semibold tracking-normal'>
                {t('Create an account and API key')}
              </h3>
              <p className='text-muted-foreground mt-1 text-sm leading-6 tracking-normal'>
                {t('Keep separate keys for the applications you operate.')}
              </p>
            </div>
            <Link
              to={accountTarget}
              className='text-foreground inline-flex min-h-8 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline'
            >
              {props.isAuthenticated ? t('Manage keys') : t('Sign up')}
              <ArrowUpRight aria-hidden='true' className='size-4' />
            </Link>
          </li>

          <li className='border-border grid gap-3 border-b py-5 sm:grid-cols-[2.5rem_1fr_auto] sm:items-start'>
            <span className='font-mono text-sm text-cyan-700 dark:text-cyan-300'>
              02
            </span>
            <div>
              <h3 className='font-semibold tracking-normal'>
                {t('Set the API base URL')}
              </h3>
              <p className='text-muted-foreground mt-1 text-sm leading-6 tracking-normal'>
                {t('Point your compatible client to the JistAI endpoint.')}
              </p>
            </div>
          </li>

          <li className='border-border grid gap-3 border-b py-5 sm:grid-cols-[2.5rem_1fr_auto] sm:items-start'>
            <span className='font-mono text-sm text-amber-700 dark:text-amber-300'>
              03
            </span>
            <div>
              <h3 className='font-semibold tracking-normal'>
                {t('Send and review requests')}
              </h3>
              <p className='text-muted-foreground mt-1 text-sm leading-6 tracking-normal'>
                {t('Follow usage and account activity from your dashboard.')}
              </p>
            </div>
            <a
              href={props.docsUrl}
              target={props.docsExternal ? '_blank' : undefined}
              rel={props.docsExternal ? 'noopener noreferrer' : undefined}
              className='text-foreground inline-flex min-h-8 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline'
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
