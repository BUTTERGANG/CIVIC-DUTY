import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ModuleBadge, StatusChip, EmptyState } from '../components/Shared';
import { fetchParcels, Parcel } from '../api';
import { MapPin, DollarSign, Home, Maximize, Calendar, User, X, Clock, Search } from 'lucide-react';
import { formatDate, timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const FISHERS_CENTER: [number, number] = [39.9417, -86.0138];

function ParcelCard({ p, active, onClick }: { p: Parcel; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
        active
          ? 'bg-emerald-500/10 border-emerald-500/35 shadow-[0_4px_20px_rgba(16,185,129,0.15)]'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
      }`}
    >
      <div className="flex justify-between items-start mb-1.5">
        <span className="text-[10px] font-mono text-slate-500">{p.parcel_id}</span>
        {p.zoning && <span className="text-[10px] font-bold text-emerald-400/70 uppercase">{p.zoning}</span>}
      </div>
      <h3 className={`font-semibold text-sm truncate transition-colors ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
        {p.address ?? 'No address'}
      </h3>
      {p.owner_name && (
        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
          <User size={9} /> {p.owner_name}
        </p>
      )}
      <div className="flex items-center gap-3 mt-1.5">
        {p.assessed_value != null && (
          <span className="text-[10px] text-emerald-400/60 font-mono">${p.assessed_value.toLocaleString()}</span>
        )}
        {p.land_area_sqft != null && (
          <span className="text-[10px] text-slate-600">{(p.land_area_sqft / 43560).toFixed(2)} ac</span>
        )}
      </div>
    </div>
  );
}

function ParcelDetail({ p }: { p: Parcel }) {
  return (
    <div className="border-t border-white/[0.06] bg-background/60 backdrop-blur p-4 space-y-3 shrink-0 animate-slide-up max-h-80 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-white text-sm leading-snug">{p.address ?? 'No address'}</h3>
          <span className="text-[10px] font-mono text-slate-500">{p.parcel_id}</span>
        </div>
        {p.zoning && <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-lg">{p.zoning}</span>}
      </div>

      {p.owner_name && (
        <div className="glass-inset px-3 py-2.5 space-y-1">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">Owner</div>
          <div className="text-sm text-slate-200 font-medium">{p.owner_name}</div>
          {p.owner_address && <div className="text-[11px] text-slate-500">{p.owner_address}</div>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {p.assessed_value != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Assessed Value</div>
            <div className="font-mono font-bold text-emerald-400 text-base">${p.assessed_value.toLocaleString()}</div>
          </div>
        )}
        {p.land_area_sqft != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Land Area</div>
            <div className="font-mono font-bold text-slate-200 text-base">
              {(p.land_area_sqft / 43560).toFixed(2)} ac
            </div>
            <div className="text-[10px] text-slate-600">{p.land_area_sqft.toLocaleString()} sqft</div>
          </div>
        )}
        {p.building_area_sqft != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Building Area</div>
            <div className="font-mono font-bold text-slate-200 text-base">{p.building_area_sqft.toLocaleString()}</div>
            <div className="text-[10px] text-slate-600">sqft</div>
          </div>
        )}
        {p.year_built != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Year Built</div>
            <div className="font-mono font-bold text-slate-200 text-base">{p.year_built}</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {p.land_use && (
          <span className="text-[10px] bg-white/[0.04] border border-white/[0.08] text-slate-400 px-2 py-1 rounded-lg">
            Use: {p.land_use}
          </span>
        )}
        {p.tax_district && (
          <span className="text-[10px] bg-white/[0.04] border border-white/[0.08] text-slate-400 px-2 py-1 rounded-lg">
            Tax: {p.tax_district}
          </span>
        )}
        {p.last_sale_date && (
          <span className="text-[10px] bg-white/[0.04] border border-white/[0.08] text-slate-400 px-2 py-1 rounded-lg flex items-center gap-1">
            <Calendar size={9} /> Sold {formatDate(p.last_sale_date)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Parcels() {
  const { showError } = useToast();
  const [items, setItems] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePin, setActivePin] = useState<Parcel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterZoning, setFilterZoning] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchParcels()
      .then(data => {
        setItems(data);
        const latest = data.reduce<string | null>((acc, r) => {
          const raw = r.scraped_at ?? r.last_sale_date;
          if (!raw) return acc;
          if (!acc) return raw;
          return new Date(raw) > new Date(acc) ? raw : acc;
        }, null);
        setLastUpdated(latest);
      })
      .catch(err => {
        console.error('[Parcels] fetch error:', err);
        showError(`Failed to load parcels: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const zonings = useMemo(() => Array.from(new Set(items.map(p => p.zoning).filter(Boolean))), [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (filterZoning) result = result.filter(p => p.zoning === filterZoning);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        (p.address?.toLowerCase().includes(q)) ||
        (p.owner_name?.toLowerCase().includes(q)) ||
        (p.parcel_id?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterZoning, searchQuery]);

  const mappable = filtered.filter(p => p.lat && p.lng);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Parcels</h1>
          <ModuleBadge module="parcels" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Property parcel data from Hamilton County GIS — ownership, zoning, assessed values, and land details.
      </p>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search address, owner, parcel ID…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-72"
          />
        </div>
        <select className="select-field w-40" value={filterZoning} onChange={e => setFilterZoning(e.target.value)}>
          <option value="">All Zoning</option>
          {zonings.map(z => <option key={z!} value={z!}>{z}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} parcels</span>
      </div>

      {/* Map + Sidebar */}
      <div className="flex flex-col md:flex-row gap-5 h-[72vh]">
        <div className="w-full md:w-72 lg:w-80 flex flex-col glass-card rounded-2xl overflow-hidden shrink-0">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="text-sm font-semibold text-white font-display flex items-center gap-2">
              <MapPin size={13} className="text-emerald-400" />
              <span className="text-emerald-400">{loading ? '…' : filtered.length}</span>
              <span className="text-slate-500 font-normal text-xs">parcels</span>
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
                No parcels found.<br />
                <span className="text-slate-700">Run the parcel scraper to populate data.</span>
              </div>
            )}
            {filtered.map(p => (
              <ParcelCard key={p.id} p={p} active={activePin?.id === p.id} onClick={() => setActivePin(p)} />
            ))}
          </div>

          {activePin && <ParcelDetail p={activePin} />}
        </div>

        <div className="flex-1 h-full rounded-2xl overflow-hidden border border-white/[0.07] relative z-0 shadow-card">
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
                    <strong>{p.address ?? p.parcel_id}</strong>
                    {p.owner_name && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.owner_name}</div>}
                    {p.zoning && <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>{p.zoning}</div>}
                    {p.assessed_value != null && (
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
                        ${p.assessed_value.toLocaleString()}
                      </div>
                    )}
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
