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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { MAX_CONCURRENCY_LIMIT } from './concurrency-limit'

const createConcurrencyLimitDialogSchema = (t: (key: string) => string) =>
  z.object({
    groupName: z.string().trim().min(1, t('Group name is required')),
    maxConcurrency: z
      .number()
      .int(t('Must be an integer'))
      .min(0, t('Must be ≥ 0'))
      .max(MAX_CONCURRENCY_LIMIT, t('Must be ≤ 2,147,483,647')),
  })

type ConcurrencyLimitDialogFormValues = z.infer<
  ReturnType<typeof createConcurrencyLimitDialogSchema>
>

const CONCURRENCY_LIMIT_FORM_ID = 'concurrency-limit-form'

export type ConcurrencyLimitEntryData = {
  groupName: string
  maxConcurrency: number
}

type ConcurrencyLimitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: ConcurrencyLimitEntryData) => void
  editData?: ConcurrencyLimitEntryData | null
}

export function ConcurrencyLimitDialog(props: ConcurrencyLimitDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!props.editData
  const concurrencyLimitDialogSchema = createConcurrencyLimitDialogSchema(t)

  const form = useForm<ConcurrencyLimitDialogFormValues>({
    resolver: zodResolver(concurrencyLimitDialogSchema),
    defaultValues: {
      groupName: '',
      maxConcurrency: 0,
    },
  })

  useEffect(() => {
    form.reset(
      props.editData ?? {
        groupName: '',
        maxConcurrency: 0,
      }
    )
  }, [form, props.editData, props.open])

  const handleSubmit = (values: ConcurrencyLimitDialogFormValues) => {
    props.onSave(values)
    form.reset()
    props.onOpenChange(false)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        isEditMode
          ? t('Edit group concurrency limit')
          : t('Add group concurrency limit')
      }
      description={t(
        'Configure the maximum in-flight model requests for a specific user group.'
      )}
      contentClassName='sm:max-w-[500px]'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form={CONCURRENCY_LIMIT_FORM_ID}>
            {isEditMode ? t('Update') : t('Add')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={CONCURRENCY_LIMIT_FORM_ID}
          onSubmit={form.handleSubmit(handleSubmit)}
          className='space-y-4'
        >
          <FormField
            control={form.control}
            name='groupName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Group Name')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('e.g., default, vip, premium')}
                    {...field}
                    disabled={isEditMode}
                  />
                </FormControl>
                <FormDescription>
                  {isEditMode
                    ? t('Group name cannot be changed when editing.')
                    : t('Unique identifier for this group.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='maxConcurrency'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Maximum concurrent requests')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    max={MAX_CONCURRENCY_LIMIT}
                    step={1}
                    {...field}
                    onChange={(event) =>
                      field.onChange(Number(event.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Maximum in-flight model requests for this group. 0 = unlimited.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
