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
import { useMemo } from 'react'

import { useStatus } from '@/hooks/use-status'

import { ApiEndpoint } from './components/api-endpoint'
import { Capabilities } from './components/capabilities'
import { FinalCta } from './components/final-cta'
import { GettingStarted } from './components/getting-started'
import { JistAIHero } from './components/hero'
import { resolveJistAIPublicConfig } from './lib/public-config'

interface JistAIHomeProps {
  isAuthenticated: boolean
}

export function JistAIHome(props: JistAIHomeProps) {
  const { status } = useStatus()
  const config = useMemo(() => resolveJistAIPublicConfig(status), [status])

  return (
    <main id='main-content'>
      <JistAIHero config={config} isAuthenticated={props.isAuthenticated} />
      <ApiEndpoint apiBaseUrl={config.apiBaseUrl} />
      <Capabilities />
      <GettingStarted
        apiBaseUrl={config.apiBaseUrl}
        docsUrl={config.docsUrl}
        docsExternal={config.docsExternal}
        isAuthenticated={props.isAuthenticated}
      />
      <FinalCta isAuthenticated={props.isAuthenticated} />
    </main>
  )
}
