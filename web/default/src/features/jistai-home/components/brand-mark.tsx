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
import { useTranslation } from 'react-i18next'

import { JISTAI_LOGO_FALLBACK } from '../lib/public-config'

interface BrandMarkProps {
  logoUrl: string
}

export function BrandMark(props: BrandMarkProps) {
  const { t } = useTranslation()

  return (
    <img
      src={props.logoUrl}
      alt={t('JistAI logo')}
      width={72}
      height={72}
      decoding='async'
      fetchPriority='high'
      className='size-10 rounded-[6px] object-contain'
      onError={(event) => {
        if (event.currentTarget.src !== JISTAI_LOGO_FALLBACK) {
          event.currentTarget.src = JISTAI_LOGO_FALLBACK
        }
      }}
    />
  )
}
