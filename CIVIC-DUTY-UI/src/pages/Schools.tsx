import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ModuleBadge } from '../components/Shared';
import { fetchSchools, School } from '../api';
import { GraduationCap, Users, X, Clock, Search } from 'lucide-react';
import { timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41],
  className: 'leaflet-marker-school',
});
L.Marker.prototype.options.icon = DefaultIcon;

const FISHERS_CENTER: [number, number] = [39.9417, -86.0138];

function SchoolCard({ s, active, onClick }: { s: School; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
        active
          ? 'bg-violet-500/10 border-violet-500/35 shadow-[0_4px_20px_rgba(139,92,246,0.15)]'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
      }`}
    >
      <div className="flex justify-between items-start mb-1.5">
        {s.school_type && (
          <span className="text-[10px] font-bold text-violet-400/70 uppercase">{s.school_type}</span>
        )}
        {s.grade_levels && <span className="text-[10px] text-slate-600">{s.grade_levels}</span>}
      </div>
      <h3 className={`font-semibold text-sm truncate transition-colors ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
        {s.name}
      </h3>
      {s.district && <p className="text-[11px] text-slate-500 mt-0.5">{s.district}</p>}
      <div className="flex items-center gap-3 mt-1.5">
        {s.enrollment != null && (
          <span className="text-[10px] text-violet-400/60 flex items-center gap-1">
            <Users size={9} /> {s.enrollment.toLocaleString()}
          </span>
        )}
        {s.address && <span className="text-[10px] text-slate-600 truncate">{s.address}</span>}
      </div>
    </div>
  );
}

function SchoolDetail({ s }: { s: School }) {
  return (
    <div className="border-t border-white/[0.06] bg-background/60 backdrop-blur p-4 space-y-3 shrink-0 animate-slide-up max-h-72 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-white text-sm leading-snug">{s.name}</h3>
          {s.address && <p className="text-[11px] text-slate-500 mt-0.5">{s.address}</p>}
        </div>
        {s.school_type && (
          <span className="text-xs font-bold text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-lg shrink-0">{s.school_type}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {s.district && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">District</div>
            <div className="text-sm text-slate-200 font-medium">{s.district}</div>
          </div>
        )}
        {s.enrollment != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Enrollment</div>
            <div className="font-mono font-bold text-violet-400 text-base">{s.enrollment.toLocaleString()}</div>
          </div>
        )}
        {s.grade_levels && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Grades</div>
            <div className="text-sm text-slate-200 font-medium">{s.grade_levels}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Schools() {
  const { showError } = useToast();
  const [items, setItems] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePin, setActivePin] = useState<School | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchSchools()
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
        console.error('[Schools] fetch error:', err);
        showError(`Failed to load schools: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const types = useMemo(() => Array.from(new Set(items.map(s => s.school_type).filter(Boolean))), [items]);
  const districts = useMemo(() => Array.from(new Set(items.map(s => s.district).filter(Boolean))), [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (filterType) result = result.filter(s => s.school_type === filterType);
    if (filterDistrict) result = result.filter(s => s.district === filterDistrict);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.address?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterType, filterDistrict, searchQuery]);

  const mappable = filtered.filter(s => s.lat && s.lng);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Schools</h1>
          <ModuleBadge module="schools" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        School locations and district data — type, enrollment, grade levels, and contact info.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search school name…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-56"
          />
        </div>
        <select className="select-field w-36" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <select className="select-field w-44" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
          <option value="">All Districts</option>
          {districts.map(d => <option key={d!} value={d!}>{d}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} schools</span>
      </div>

      <div className="flex flex-col md:flex-row gap-5 h-[72vh]">
        <div className="w-full md:w-72 lg:w-80 flex flex-col glass-card rounded-2xl overflow-hidden shrink-0">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="text-sm font-semibold text-white font-display flex items-center gap-2">
              <GraduationCap size={13} className="text-violet-400" />
              <span className="text-violet-400">{loading ? '…' : filtered.length}</span>
              <span className="text-slate-500 font-normal text-xs">schools</span>
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
                No schools found.<br />
                <span className="text-slate-700">Run the school scraper to populate data.</span>
              </div>
            )}
            {filtered.map(s => (
              <SchoolCard key={s.id} s={s} active={activePin?.id === s.id} onClick={() => setActivePin(s)} />
            ))}
          </div>

          {activePin && <SchoolDetail s={activePin} />}
        </div>

        <div className="flex-1 h-full rounded-2xl overflow-hidden border border-white/[0.07] relative z-0 shadow-card">
          <style>{`.leaflet-marker-school { filter: hue-rotate(260deg) brightness(1.2); }`}</style>
          <MapContainer center={FISHERS_CENTER} zoom={12} className="w-full h-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <LayerGroup>
              {mappable.map(s => (
                <Marker key={s.id} position={[s.lat!, s.lng!]} icon={DefaultIcon}
                  eventHandlers={{ click: () => setActivePin(s) }}>
                  <Popup>
                    <strong>{s.name}</strong>
                    {s.school_type && <div style={{ fontSize: '0.75rem', color: '#8b5cf6' }}>{s.school_type}</div>}
                    {s.district && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.district}</div>}
                    {s.enrollment != null && <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>{s.enrollment.toLocaleString()} students</div>}
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
