import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'nongsadama.regionId'

interface SelectedRegionContextValue {
  /** 선택된 지역 id. 미선택 시 null. */
  regionId: string | null
  setRegionId: (id: string | null) => void
}

const SelectedRegionContext = createContext<SelectedRegionContextValue | null>(null)

function readInitial(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function SelectedRegionProvider({ children }: { children: ReactNode }) {
  const [regionId, setRegionIdState] = useState<string | null>(readInitial)

  const setRegionId = useCallback((id: string | null) => {
    setRegionIdState(id)
    if (typeof window !== 'undefined') {
      if (id) window.localStorage.setItem(STORAGE_KEY, id)
      else window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const value = useMemo(() => ({ regionId, setRegionId }), [regionId, setRegionId])

  return (
    <SelectedRegionContext.Provider value={value}>{children}</SelectedRegionContext.Provider>
  )
}

export function useSelectedRegion(): SelectedRegionContextValue {
  const ctx = useContext(SelectedRegionContext)
  if (!ctx) {
    throw new Error('useSelectedRegion must be used within a SelectedRegionProvider')
  }
  return ctx
}
