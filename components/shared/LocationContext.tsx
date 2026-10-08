'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

interface LocationCtx {
  /** Label shown in the navbar location pill, e.g. "Vadodara" or "Near you" */
  locationLabel: string
  setLocationLabel: (label: string) => void
  /** Search radius in km; changing it triggers a new /api/search via the query key */
  radiusKm: number
  setRadiusKm: (r: number) => void
}

const LocationContext = createContext<LocationCtx>({
  locationLabel: 'Vadodara',
  setLocationLabel: () => {},
  radiusKm: 3,
  setRadiusKm: () => {},
})

export function LocationProvider({ children }: { children: ReactNode }) {
  const [locationLabel, setLocationLabel] = useState('Vadodara')
  const [radiusKm, setRadiusKm] = useState(3)
  return (
    <LocationContext.Provider value={{ locationLabel, setLocationLabel, radiusKm, setRadiusKm }}>
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation() {
  return useContext(LocationContext)
}
