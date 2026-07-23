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
import { ArrowRight } from 'lucide-react'
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
      className='border-border/70 border-y bg-emerald-950 px-4 py-12 text-white sm:px-6 sm:py-14 dark:bg-emerald-950/70'
    >
      <div className='mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center'>
        <div className='max-w-2xl'>
          <h2
            id='jistai-final-cta-title'
            className='text-2xl leading-tight font-semibold tracking-normal sm:text-3xl'
          >
            {t('Put one API behind your next AI workflow')}
          </h2>
          <p className='mt-3 text-sm leading-6 tracking-normal text-emerald-50/75 sm:text-base'>
            {t('Create your workspace, issue a key, and connect your client.')}
          </p>
        </div>
        <Button
          variant='secondary'
          className='h-11 w-full rounded-[8px] bg-white px-5 text-emerald-950 hover:bg-emerald-50 sm:w-auto'
          render={<Link to={target} />}
        >
          {props.isAuthenticated ? t('Open dashboard') : t('Get started')}
          <ArrowRight aria-hidden='true' className='size-4' />
        </Button>
      </div>
    </section>
  )
}
