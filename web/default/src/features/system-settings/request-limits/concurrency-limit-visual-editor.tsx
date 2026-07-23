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
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { parseConcurrencyLimitMap } from './concurrency-limit'
import {
  ConcurrencyLimitDialog,
  type ConcurrencyLimitEntryData,
} from './concurrency-limit-dialog'

type ConcurrencyLimitVisualEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function ConcurrencyLimitVisualEditor(
  props: ConcurrencyLimitVisualEditorProps
) {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editData, setEditData] = useState<ConcurrencyLimitEntryData | null>(
    null
  )

  const concurrencyLimits = useMemo(
    () =>
      Object.entries(parseConcurrencyLimitMap(props.value)).map(
        ([groupName, maxConcurrency]) => ({ groupName, maxConcurrency })
      ),
    [props.value]
  )

  const filteredConcurrencyLimits = useMemo(() => {
    if (!searchText) return concurrencyLimits
    const lowerSearch = searchText.toLowerCase()
    return concurrencyLimits.filter((limit) =>
      limit.groupName.toLowerCase().includes(lowerSearch)
    )
  }, [concurrencyLimits, searchText])

  const handleSave = (data: ConcurrencyLimitEntryData) => {
    const parsed = parseConcurrencyLimitMap(props.value)

    if (editData && editData.groupName !== data.groupName) {
      delete parsed[editData.groupName]
    }

    parsed[data.groupName] = data.maxConcurrency
    props.onChange(JSON.stringify(parsed, null, 2))
  }

  const handleDelete = (groupName: string) => {
    const parsed = parseConcurrencyLimitMap(props.value)
    delete parsed[groupName]
    props.onChange(JSON.stringify(parsed, null, 2))
  }

  const handleEdit = (limit: ConcurrencyLimitEntryData) => {
    setEditData(limit)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditData(null)
    setDialogOpen(true)
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
          <Input
            placeholder={t('Search group names...')}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className='pl-9'
          />
        </div>
        <Button type='button' onClick={handleAdd}>
          <Plus className='mr-2 h-4 w-4' />
          {t('Add group')}
        </Button>
      </div>

      <StaticDataTable
        data={filteredConcurrencyLimits}
        getRowKey={(limit) => limit.groupName}
        emptyContent={
          searchText
            ? t('No groups match your search')
            : t(
                'No group concurrency limits configured. Unlisted groups inherit the global limit.'
              )
        }
        columns={[
          {
            id: 'group',
            header: t('Group Name'),
            cellClassName: 'font-medium',
            cell: (limit) => limit.groupName,
          },
          {
            id: 'max-concurrency',
            header: t('Maximum Concurrency'),
            className: 'text-right',
            cellClassName: 'text-right',
            cell: (limit) => (
              <span className='font-mono'>
                {limit.maxConcurrency === 0
                  ? t('Unlimited')
                  : limit.maxConcurrency.toLocaleString()}
              </span>
            ),
          },
          {
            id: 'actions',
            header: t('Actions'),
            className: 'text-right',
            cellClassName: 'text-right',
            cell: (limit) => (
              <StaticRowActions
                editLabel={t('Edit')}
                deleteLabel={t('Delete')}
                menuLabel={t('Open menu')}
                onEdit={() => handleEdit(limit)}
                onDelete={() => handleDelete(limit.groupName)}
              />
            ),
          },
        ]}
      />

      <ConcurrencyLimitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editData={editData}
      />
    </div>
  )
}
