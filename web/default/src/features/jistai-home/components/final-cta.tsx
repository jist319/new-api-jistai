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
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { resolveJistAIPrimaryDestination } from '../lib/public-config'

interface FinalCtaProps {
  isAuthenticated: boolean
}

export function FinalCta(props: FinalCtaProps) {
  const { t } = useTranslation()
  const target = resolveJistAIPrimaryDestination(props.isAuthenticated)

  return (
    <section
      aria-labelledby='jistai-final-cta-title'
      className='border-b border-[#1d2a2b] bg-[#091011] px-4 py-12 text-white sm:px-6 sm:py-16'
    >
      <div className='mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between'>
        <div className='max-w-2xl'>
          <div className='mb-4 inline-flex items-center gap-2 font-mono text-[10px] font-semibold tracking-[0.2em] text-cyan-200/75 uppercase'>
            <ShieldCheck aria-hidden='true' className='size-3.5' />
            {t('Get started')}
          </div>
          <h2
            id='jistai-final-cta-title'
            className='text-2xl leading-tight font-semibold tracking-normal sm:text-3xl'
          >
            {t('Put one API behind your next AI workflow')}
          </h2>
          <p className='mt-3 max-w-xl text-sm leading-6 text-white/55 sm:text-base'>
            {t('Create your workspace, issue a key, and connect your client.')}
          </p>
        </div>
        <Button
          className='h-11 w-full rounded-[8px] bg-cyan-300 px-5 text-sm font-semibold text-[#071113] hover:bg-cyan-200 sm:w-auto'
          render={<Link to={target} />}
        >
          {props.isAuthenticated ? t('Open dashboard') : t('Get started')}
          <ArrowRight aria-hidden='true' className='size-4' />
        </Button>
      </div>
    </section>
  )
}
