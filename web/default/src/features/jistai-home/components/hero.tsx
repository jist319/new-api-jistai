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
import { ArrowRight, BookOpen, CircleDollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import {
  resolveJistAIPrimaryDestination,
  type JistAIPublicConfig,
} from '../lib/public-config'
import { BrandMark } from './brand-mark'

interface JistAIHeroProps {
  config: JistAIPublicConfig
  isAuthenticated: boolean
}

export function JistAIHero(props: JistAIHeroProps) {
  const { t } = useTranslation()
  const primaryLabel = props.isAuthenticated
    ? t('Go to dashboard')
    : t('Create your account')
  const primaryTarget = resolveJistAIPrimaryDestination(props.isAuthenticated)

  return (
    <section
      aria-labelledby='jistai-home-title'
      className='px-4 pt-24 pb-10 sm:px-6 sm:pt-28 sm:pb-14'
    >
      <div className='mx-auto max-w-6xl'>
        <div className='mb-6 flex items-center gap-4'>
          <BrandMark logoUrl={props.config.logoUrl} />
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold tracking-normal text-emerald-700 dark:text-emerald-300'>
              {props.config.systemName}
            </p>
            <p className='text-muted-foreground mt-1 text-sm leading-5 tracking-normal'>
              {t('Unified AI API service')}
            </p>
          </div>
        </div>

        <h1
          id='jistai-home-title'
          className='text-5xl leading-none font-semibold tracking-normal sm:text-6xl'
        >
          {t('JistAI')}
        </h1>
        <p className='text-muted-foreground mt-5 max-w-3xl text-base leading-7 tracking-normal sm:text-lg sm:leading-8'>
          {t(
            'A unified AI API service for teams building products across regions, clients, and workflows.'
          )}
        </p>

        <div className='mt-7 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap'>
          <Button
            className='h-11 w-full rounded-[8px] px-5 sm:w-auto'
            render={<Link to={primaryTarget} />}
          >
            {primaryLabel}
            <ArrowRight aria-hidden='true' className='size-4' />
          </Button>
          <div className='grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:flex'>
            <Button
              variant='outline'
              className='h-11 min-w-0 rounded-[8px] px-3'
              render={<Link to='/pricing' />}
            >
              <CircleDollarSign aria-hidden='true' className='size-4' />
              <span className='truncate'>{t('View pricing')}</span>
            </Button>
            <Button
              variant='outline'
              className='h-11 min-w-0 rounded-[8px] px-3'
              render={
                <a
                  href={props.config.docsUrl}
                  target={props.config.docsExternal ? '_blank' : undefined}
                  rel={
                    props.config.docsExternal
                      ? 'noopener noreferrer'
                      : undefined
                  }
                />
              }
            >
              <BookOpen aria-hidden='true' className='size-4' />
              <span className='truncate'>{t('Read the docs')}</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
