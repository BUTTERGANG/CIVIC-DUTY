import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ModuleBadge } from '../components/Shared';
import { fetchBuildings, Building } from '../api';
import { MapPin, Building2, Maximize, Calendar, Layers, X, Clock, Search } from 'lucide-react';
import { timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41],
  className: 'leaflet-marker-building',
});
L.Marker.prototype.options.icon = DefaultIcon;

const FISHERS_CENTER: [number, number] = [39.9417, -86.0138];

function BuildingCard({ b, active, onClick }: { b: Building; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
        active
          ? 'bg-cyan-500/10 border-cyan-500/35 shadow-[0_4px_20px_rgba(6,182,212,0.15)]'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
      }`}
    >
      <div className="flex justify-between items-start mb-1.5">
        {b.building_type && (
          <span className="text-[10px] font-bold text-cyan-400/70 uppercase">{b.building_type}</span>
        )}
        {b.year_built != null && <span className="text-[10px] text-slate-600 font-mono">{b.year_built}</span>}
      </div>
      <h3 className={`font-semibold text-sm truncate transition-colors ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
        {b.address ?? b.building_id ?? 'Unknown building'}
      </h3>
      <div className="flex items-center gap-3 mt-1.5">
        {b.area_sqft != null && (
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Maximize size={9} /> {b.area_sqft.toLocaleString()} sqft
          </span>
        )}
        {b.levels != null && (
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Layers size={9} /> {b.levels} {b.levels === 1 ? 'level' : 'levels'}
          </span>
        )}
      </div>
    </div>
  );
}

function BuildingDetail({ b }: { b: Building }) {
  return (
    <div className="border-t border-white/[0.06] bg-background/60 backdrop-blur p-4 space-y-3 shrink-0 animate-slide-up max-h-72 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-white text-sm leading-snug">{b.address ?? 'Unknown address'}</h3>
          {b.building_id && <span className="text-[10px] font-mono text-slate-500">{b.building_id}</span>}
        </div>
        {b.building_type && (
          <span className="text-xs font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-lg shrink-0">{b.building_type}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {b.area_sqft != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Area</div>
            <div className="font-mono font-bold text-slate-200 text-base">{b.area_sqft.toLocaleString()}</div>
            <div className="text-[10px] text-slate-600">sqft</div>
          </div>
        )}
        {b.year_built != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Year Built</div>
            <div className="font-mono font-bold text-slate-200 text-base">{b.year_built}</div>
          </div>
        )}
        {b.levels != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Levels</div>
            <div className="font-mono font-bold text-slate-200 text-base">{b.levels}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Buildings() {
  const { showError } = useToast();
  const [items, setItems] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePin, setActivePin] = useState<Building | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchBuildings()
      .then(data => {
        setItems(data);
        const latest = data.reduce<string | null>((acc, r) => {
          if (!r.scraped_at) return acc;
          if (!acc) return r.scraped_at;
          return new Date(r.scraped_at) > new Date(acc) ? r.scraped_at : acc;
        }, null);
        setLastUpdated(latest);
      })
      .catch(err => {
        console.error('[Buildings] fetch error:', err);
        showError(`Failed to load buildings: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const types = useMemo(() => Array.from(new Set(items.map(b => b.building_type).filter(Boolean))), [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (filterType) result = result.filter(b => b.building_type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b =>
        (b.address?.toLowerCase().includes(q)) ||
        (b.building_id?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterType, searchQuery]);

  const mappable = filtered.filter(b => b.lat && b.lng);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Buildings</h1>
          <ModuleBadge module="buildings" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Building footprint data from Hamilton County GIS — type, area, year built, and levels.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search address, building ID…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <select className="select-field w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} buildings</span>
      </div>

      <div className="flex flex-col md:flex-row gap-5 h-[72vh]">
        <div className="w-full md:w-72 lg:w-80 flex flex-col glass-card rounded-2xl overflow-hidden shrink-0">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="text-sm font-semibold text-white font-display flex items-center gap-2">
              <Building2 size={13} className="text-cyan-400" />
              <span className="text-cyan-400">{loading ? '…' : filtered.length}</span>
              <span className="text-slate-500 font-normal text-xs">buildings</span>
            </div>
            {activePin && (
              <button onClick={() => setActivePin(null)}
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading && <div className="text-slate-500 text-xs text-center py-8">Loading…</div>}
            {!loading && filtered.length === 0 && (
              <div className="text-slate-600 text-xs text-center py-8">
                No buildings found.<br />
                <span className="text-slate-700">Run the building scraper to populate data.</span>
              </div>
            )}
            {filtered.map(b => (
              <BuildingCard key={b.id} b={b} active={activePin?.id === b.id} onClick={() => setActivePin(b)} />
            ))}
          </div>

          {activePin && <BuildingDetail b={activePin} />}
        </div>

        <div className="flex-1 h-full rounded-2xl overflow-hidden border border-white/[0.07] relative z-0 shadow-card">
          <style>{`.leaflet-marker-building { filter: hue-rotate(180deg) brightness(1.2); }`}</style>
          <MapContainer center={FISHERS_CENTER} zoom={12} className="w-full h-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <LayerGroup>
              {mappable.map(b => (
                <Marker key={b.id} position={[b.lat!, b.lng!]} icon={DefaultIcon}
                  eventHandlers={{ click: () => setActivePin(b) }}>
                  <Popup>
                    <strong>{b.address ?? b.building_id}</strong>
                    {b.building_type && <div style={{ fontSize: '0.75rem', color: '#06b6d4' }}>{b.building_type}</div>}
                    {b.area_sqft != null && <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>{b.area_sqft.toLocaleString()} sqft</div>}
                    {b.year_built != null && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>Built {b.year_built}</div>}
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
