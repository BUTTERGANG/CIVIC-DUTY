import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ModuleBadge } from '../components/Shared';
import { fetchParks, Park } from '../api';
import { MapPin, Trees, Maximize, X, Clock, Search } from 'lucide-react';
import { timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41],
  className: 'leaflet-marker-park',
});
L.Marker.prototype.options.icon = DefaultIcon;

const FISHERS_CENTER: [number, number] = [39.9417, -86.0138];

function ParkCard({ p, active, onClick }: { p: Park; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
        active
          ? 'bg-green-500/10 border-green-500/35 shadow-[0_4px_20px_rgba(34,197,94,0.15)]'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
      }`}
    >
      <div className="flex justify-between items-start mb-1.5">
        {p.park_type && (
          <span className="text-[10px] font-bold text-green-400/70 uppercase">{p.park_type}</span>
        )}
        {p.area_acres != null && (
          <span className="text-[10px] text-slate-600">{p.area_acres} ac</span>
        )}
      </div>
      <h3 className={`font-semibold text-sm truncate transition-colors ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
        {p.name}
      </h3>
      {p.address && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{p.address}</p>}
      {p.features && (
        <p className="text-[10px] text-slate-600 mt-1 line-clamp-1">{p.features}</p>
      )}
    </div>
  );
}

function ParkDetail({ p }: { p: Park }) {
  return (
    <div className="border-t border-white/[0.06] bg-background/60 backdrop-blur p-4 space-y-3 shrink-0 animate-slide-up max-h-72 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-white text-sm leading-snug">{p.name}</h3>
          {p.address && <p className="text-[11px] text-slate-500 mt-0.5">{p.address}</p>}
        </div>
        {p.park_type && (
          <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-lg shrink-0">{p.park_type}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {p.area_acres != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Area</div>
            <div className="font-mono font-bold text-green-400 text-base">{p.area_acres}</div>
            <div className="text-[10px] text-slate-600">acres</div>
          </div>
        )}
      </div>

      {p.features && (
        <div className="glass-inset px-3 py-2.5">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Features</div>
          <div className="text-sm text-slate-300">{p.features}</div>
        </div>
      )}
    </div>
  );
}

export default function Parks() {
  const { showError } = useToast();
  const [items, setItems] = useState<Park[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePin, setActivePin] = useState<Park | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchParks()
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
        console.error('[Parks] fetch error:', err);
        showError(`Failed to load parks: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const types = useMemo(() => Array.from(new Set(items.map(p => p.park_type).filter(Boolean))), [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (filterType) result = result.filter(p => p.park_type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.address?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterType, searchQuery]);

  const mappable = filtered.filter(p => p.lat && p.lng);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Parks</h1>
          <ModuleBadge module="parks" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Park locations and recreation areas — type, acreage, amenities, and features.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search park name…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-56"
          />
        </div>
        <select className="select-field w-36" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} parks</span>
      </div>

      <div className="flex flex-col md:flex-row gap-5 h-[72vh]">
        <div className="w-full md:w-72 lg:w-80 flex flex-col glass-card rounded-2xl overflow-hidden shrink-0">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="text-sm font-semibold text-white font-display flex items-center gap-2">
              <Trees size={13} className="text-green-400" />
              <span className="text-green-400">{loading ? '…' : filtered.length}</span>
              <span className="text-slate-500 font-normal text-xs">parks</span>
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
                No parks found.<br />
                <span className="text-slate-700">Run the park scraper to populate data.</span>
              </div>
            )}
            {filtered.map(p => (
              <ParkCard key={p.id} p={p} active={activePin?.id === p.id} onClick={() => setActivePin(p)} />
            ))}
          </div>

          {activePin && <ParkDetail p={activePin} />}
        </div>

        <div className="flex-1 h-full rounded-2xl overflow-hidden border border-white/[0.07] relative z-0 shadow-card">
          <style>{`.leaflet-marker-park { filter: hue-rotate(100deg) brightness(1.2); }`}</style>
          <MapContainer center={FISHERS_CENTER} zoom={12} className="w-full h-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <LayerGroup>
              {mappable.map(p => (
                <Marker key={p.id} position={[p.lat!, p.lng!]} icon={DefaultIcon}
                  eventHandlers={{ click: () => setActivePin(p) }}>
                  <Popup>
                    <strong>{p.name}</strong>
                    {p.park_type && <div style={{ fontSize: '0.75rem', color: '#22c55e' }}>{p.park_type}</div>}
                    {p.area_acres != null && <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>{p.area_acres} acres</div>}
                    {p.features && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{p.features.slice(0, 80)}…</div>}
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
