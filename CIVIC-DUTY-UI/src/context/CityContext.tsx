// src/context/CityContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface CityMeta {
  id: string;
  displayName: string;
  state: string;
  description: string;
  modules: string[];
  icon: string;
  hasData: boolean;
}

interface CityContextValue {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  cities: CityMeta[];
  citiesLoading: boolean;
  currentCity: CityMeta | undefined;
}

const CityContext = createContext<CityContextValue | null>(null);

const STORAGE_KEY = 'cd_selected_city';
const DEFAULT_CITY = 'fishers';

export function CityProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setCity] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CITY;
  });
  const [cities, setCities] = useState<CityMeta[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);

  const setSelectedCity = useCallback((city: string) => {
    setCity(city);
    localStorage.setItem(STORAGE_KEY, city);
  }, []);

  useEffect(() => {
    fetch('/api/cities')
      .then(res => res.json())
      .then(data => {
        setCities(data.cities ?? []);
      })
      .catch(() => {
        // Fallback: use default cities if API unavailable
        setCities([
          { id: 'fishers', displayName: 'Fishers', state: 'IN', description: 'City of Fishers', modules: ['council', 'bids', 'zoning', 'campaign', 'court'], icon: '🏛️', hasData: true },
          { id: 'indy', displayName: 'Indianapolis', state: 'IN', description: 'City of Indianapolis', modules: ['council', 'incidents', 'crashes', 'citations', 'useOfForce', 'serviceRequests'], icon: '🌆', hasData: true },
        ]);
      })
      .finally(() => setCitiesLoading(false));
  }, []);

  const currentCity = cities.find(c => c.id === selectedCity);

  return (
    <CityContext.Provider value={{ selectedCity, setSelectedCity, cities, citiesLoading, currentCity }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error('useCity must be used within CityProvider');
  return ctx;
}
