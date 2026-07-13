'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { isProtocolResponse, type ProtocolResponse } from '@/lib/types'

type ContextValue = { data: ProtocolResponse | null; loading: boolean; error: string; refresh: () => Promise<void> }
const ProtocolContext = createContext<ContextValue>({ data: null, loading: true, error: '', refresh: async () => undefined })

export function ProtocolProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ProtocolResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      const response = await fetch('/api/protocol', { cache: 'no-store' })
      const payload: unknown = await response.json()
      if (!response.ok) throw new Error(`Protocol API returned HTTP ${response.status}`)
      if (!isProtocolResponse(payload)) throw new Error('Protocol API returned malformed JSON')
      const typed = payload
      setData(typed)
      if (typed.error) setError(typed.error)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Protocol data is unavailable.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { const timer = window.setTimeout(() => { void refresh() }, 0); return () => window.clearTimeout(timer) }, [refresh])
  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(id)
  }, [refresh])

  return <ProtocolContext.Provider value={{ data, loading, error, refresh }}>{children}</ProtocolContext.Provider>
}

export const useProtocol = () => useContext(ProtocolContext)
