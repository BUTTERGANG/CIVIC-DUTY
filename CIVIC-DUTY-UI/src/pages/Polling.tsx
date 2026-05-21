import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ModuleBadge } from '../components/Shared';
import { fetchPollingLocations, PollingLocation } from '../api';
import { MapPin, Vote, MapPin as AddressIcon, Clock, X, Search } from 'lucide-react';
import { timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41],
  className: 'leaflet-marker-polling',
});
L.Marker.prototype.options.icon = DefaultIcon;

const FISHERS_CENTER: [number, number] = [39.9417, -86.0138];

function PollingCard({ p, active, onClick }: { p: PollingLocation; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
        active
          ? 'bg-orange-500/10 border-orange-500/35 shadow-[0_4px_20px_rgba(249,115,22,0.15)]'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
      }`}
    >
      <div className="flex justify-between items-start mb-1.5">
        {p.precinct && (
          <span className="text-[10px] font-bold text-orange-400/70 uppercase">Precinct {p.precinct}</span>
        )}
        {p.district && <span className="text-[10px] text-slate-600">{p.district}</span>}
      </div>
      <h3 className={`font-semibold text-sm truncate transition-colors ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
        {p.name}
      </h3>
      {p.address && (
        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
          <AddressIcon size={9} /> {p.address}
        </p>
      )}
      {p.poll_hours && (
        <p className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
          <Clock size={9} /> {p.poll_hours}
        </p>
      )}
    </div>
  );
}

function PollingDetail({ p }: { p: PollingLocation }) {
  return (
    <div className="border-t border-white/[0.06] bg-background/60 backdrop-blur p-4 space-y-3 shrink-0 animate-slide-up max-h-72 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-white text-sm leading-snug">{p.name}</h3>
          {p.address && <p className="text-[11px] text-slate-500 mt-0.5">{p.address}</p>}
        </div>
        {p.precinct && (
          <span className="text-xs font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-lg shrink-0">
            Precinct {p.precinct}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {p.district && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">District</div>
            <div className="text-sm text-slate-200 font-medium">{p.district}</div>
          </div>
        )}
        {p.poll_hours && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Poll Hours</div>
            <div className="text-sm text-slate-200 font-medium">{p.poll_hours}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Polling() {
  const { showError } = useToast();
  const [items, setItems] = useState<PollingLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePin, setActivePin] = useState<PollingLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchPollingLocations()
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
        console.error('[Polling] fetch error:', err);
        showError(`Failed to load polling locations: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const districts = useMemo(() => Array.from(new Set(items.map(p => p.district).filter(Boolean))), [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (filterDistrict) result = result.filter(p => p.district === filterDistrict);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.address?.toLowerCase().includes(q)) ||
        (p.precinct?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterDistrict, searchQuery]);

  const mappable = filtered.filter(p => p.lat && p.lng);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Polling Locations</h1>
          <ModuleBadge module="polling" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Voting precinct locations and polling places — address, precinct, district, and hours.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, address, precinct…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <select className="select-field w-40" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
          <option value="">All Districts</option>
          {districts.map(d => <option key={d!} value={d!}>{d}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} locations</span>
      </div>

      <div className="flex flex-col md:flex-row gap-5 h-[72vh]">
        <div className="w-full md:w-72 lg:w-80 flex flex-col glass-card rounded-2xl overflow-hidden shrink-0">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="text-sm font-semibold text-white font-display flex items-center gap-2">
              <Vote size={13} className="text-orange-400" />
              <span className="text-orange-400">{loading ? '…' : filtered.length}</span>
              <span className="text-slate-500 font-normal text-xs">locations</span>
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
                No polling locations found.<br />
                <span className="text-slate-700">Run the polling scraper to populate data.</span>
              </div>
            )}
            {filtered.map(p => (
              <PollingCard key={p.id} p={p} active={activePin?.id === p.id} onClick={() => setActivePin(p)} />
            ))}
          </div>

          {activePin && <PollingDetail p={activePin} />}
        </div>

        <div className="flex-1 h-full rounded-2xl overflow-hidden border border-white/[0.07] relative z-0 shadow-card">
          <style>{`.leaflet-marker-polling { filter: hue-rotate(20deg) brightness(1.2); }`}</style>
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
                    {p.address && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.address}</div>}
                    {p.precinct && <div style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 'bold' }}>Precinct {p.precinct}</div>}
                    {p.poll_hours && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{p.poll_hours}</div>}
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
