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
import {
  Activity,
  ArrowRight,
  BookOpen,
  Braces,
  CircleDollarSign,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { HeroTerminalDemo } from '@/features/home/components/hero-terminal-demo'

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
      className='relative isolate overflow-hidden bg-[#091011] text-white'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 -z-10 opacity-70'
      >
        <div className='absolute inset-y-0 left-[8%] w-px bg-white/[0.055]' />
        <div className='absolute inset-y-0 left-1/2 w-px bg-white/[0.04]' />
        <div className='absolute inset-y-0 right-[8%] w-px bg-white/[0.055]' />
        <div className='absolute inset-x-0 top-[7.25rem] h-px bg-white/[0.055]' />
      </div>

      <div className='mx-auto max-w-7xl px-4 sm:px-6'>
        <div className='flex min-h-12 items-center justify-between border-b border-white/10 py-2.5 sm:min-h-14 sm:py-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <span
              aria-hidden='true'
              className='size-2 shrink-0 rounded-full bg-lime-300 shadow-[0_0_0_4px_rgba(190,242,100,0.12)]'
            />
            <span className='truncate font-mono text-[10px] font-semibold tracking-[0.2em] text-white/70 uppercase sm:text-[11px]'>
              JISTAI / API CONTROL PLANE
            </span>
          </div>
          <div className='hidden items-center gap-5 font-mono text-[10px] tracking-[0.16em] text-white/55 uppercase sm:flex'>
            <span>REGION / GLOBAL</span>
            <span className='text-lime-200/80'>UNIFIED ROUTING</span>
          </div>
        </div>

        <div className='grid items-center py-10 sm:py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)] lg:gap-16 lg:py-20'>
          <div className='min-w-0'>
            <div className='flex items-center gap-4'>
              <div className='flex size-14 shrink-0 items-center justify-center rounded-[8px] border border-white/15 bg-white/[0.06] shadow-[0_14px_34px_-18px_rgba(0,0,0,0.9)] sm:size-16'>
                <BrandMark logoUrl={props.config.logoUrl} />
              </div>
              <div className='min-w-0'>
                <p className='truncate text-sm font-semibold tracking-wide text-cyan-200'>
                  {props.config.systemName}
                </p>
                <p className='mt-1 text-xs tracking-wide text-white/60'>
                  {t('Unified AI API service')}
                </p>
              </div>
            </div>

            <h1
              id='jistai-home-title'
              className='mt-7 max-w-3xl text-4xl leading-[0.95] font-semibold tracking-normal text-white sm:mt-9 sm:text-6xl lg:text-7xl'
            >
              {t('JistAI')}
              <span className='mt-3 block max-w-2xl text-2xl leading-[1.08] font-normal tracking-normal text-white/55 sm:mt-4 sm:text-4xl lg:text-5xl'>
                {t('Built for dependable AI workflows')}
              </span>
            </h1>

            <p className='mt-5 max-w-xl text-sm leading-7 text-white/60 sm:mt-7 sm:text-base sm:leading-8'>
              {t(
                'A unified AI API service for teams building products across regions, clients, and workflows.'
              )}
            </p>

            <div className='mt-6 flex w-full max-w-xl flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap'>
              <Button
                className='h-11 w-full rounded-[8px] bg-cyan-300 px-5 text-sm font-semibold text-[#071113] hover:bg-cyan-200 sm:w-auto'
                render={<Link to={primaryTarget} />}
              >
                {primaryLabel}
                <ArrowRight aria-hidden='true' className='size-4' />
              </Button>
              <div className='grid grid-cols-2 gap-3 sm:flex'>
                <Button
                  variant='outline'
                  className='h-11 min-w-0 rounded-[8px] border-white/15 bg-white/[0.04] px-3 text-white hover:bg-white/10 hover:text-white'
                  render={<Link to='/pricing' />}
                >
                  <CircleDollarSign aria-hidden='true' className='size-4' />
                  <span className='truncate'>{t('View pricing')}</span>
                </Button>
                <Button
                  variant='outline'
                  className='h-11 min-w-0 rounded-[8px] border-white/15 bg-white/[0.04] px-3 text-white hover:bg-white/10 hover:text-white'
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

            <div className='mt-10 hidden flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/10 pt-5 text-xs text-white/60 sm:flex'>
              <span className='inline-flex items-center gap-2'>
                <Braces aria-hidden='true' className='size-4 text-cyan-200' />
                {t('OpenAI-compatible endpoint')}
              </span>
              <span className='inline-flex items-center gap-2'>
                <Zap aria-hidden='true' className='size-4 text-lime-200' />
                {t('Streaming and tool workflows')}
              </span>
            </div>
          </div>

          <div className='hidden min-w-0 lg:block lg:pt-4'>
            <div className='mb-3 flex items-center justify-between gap-3 font-mono text-[10px] tracking-[0.16em] uppercase'>
              <span className='inline-flex items-center gap-2 text-white/60'>
                <Terminal aria-hidden='true' className='size-3.5 text-cyan-200' />
                {t('API base URL')}
              </span>
              <span className='inline-flex items-center gap-2 text-lime-200/80'>
                <Activity aria-hidden='true' className='size-3.5' />
                DEMO / 200
              </span>
            </div>
            <HeroTerminalDemo className='max-w-none' />
            <div className='mt-3 flex items-center gap-2 font-mono text-[10px] text-white/55'>
              <ShieldCheck aria-hidden='true' className='size-3.5 text-cyan-200/70' />
              <span>{t('Use this URL in your OpenAI-compatible client')}</span>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-3 border-t border-white/10'>
          <div className='flex flex-col items-start gap-2 border-r border-white/10 px-2 py-4 sm:flex-row sm:gap-3 sm:px-0 sm:py-6 sm:pr-7'>
            <Braces aria-hidden='true' className='mt-0.5 size-4 shrink-0 text-cyan-200' />
            <div>
              <p className='font-mono text-[10px] tracking-[0.16em] text-white/55 uppercase'>
                <span className='sm:hidden'>API</span>
                <span className='hidden sm:inline'>
                  {t('OpenAI-compatible endpoint')}
                </span>
              </p>
              <p className='mt-1 text-[10px] leading-4 text-white/80 sm:text-sm'>
                <span className='sm:hidden'>OPENAI</span>
                <span className='hidden sm:inline'>OPENAI COMPATIBLE</span>
              </p>
            </div>
          </div>
          <div className='flex flex-col items-start gap-2 border-r border-white/10 px-3 py-4 sm:flex-row sm:gap-3 sm:px-7 sm:py-6'>
            <Zap aria-hidden='true' className='mt-0.5 size-4 shrink-0 text-lime-200' />
            <div>
              <p className='font-mono text-[10px] tracking-[0.16em] text-white/55 uppercase'>
                <span className='sm:hidden'>SSE</span>
                <span className='hidden sm:inline'>
                  {t('Streaming and tool workflows')}
                </span>
              </p>
              <p className='mt-1 text-[10px] leading-4 text-white/80 sm:text-sm'>
                <span className='sm:hidden'>STREAM</span>
                <span className='hidden sm:inline'>STREAMING + TOOLS</span>
              </p>
            </div>
          </div>
          <div className='flex flex-col items-start gap-2 px-3 py-4 sm:flex-row sm:gap-3 sm:py-6 sm:pl-7'>
            <ShieldCheck aria-hidden='true' className='mt-0.5 size-4 shrink-0 text-amber-200' />
            <div>
              <p className='font-mono text-[10px] tracking-[0.16em] text-white/55 uppercase'>
                <span className='sm:hidden'>OPS</span>
                <span className='hidden sm:inline'>
                  {t('Usage and account control')}
                </span>
              </p>
              <p className='mt-1 text-[10px] leading-4 text-white/80 sm:text-sm'>
                <span className='sm:hidden'>USAGE</span>
                <span className='hidden sm:inline'>USAGE + ACCESS VISIBILITY</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
