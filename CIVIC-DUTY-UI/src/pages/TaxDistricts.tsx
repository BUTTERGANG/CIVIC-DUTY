import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ModuleBadge } from '../components/Shared';
import { fetchTaxDistricts, TaxDistrict } from '../api';
import { MapPin, Landmark, DollarSign, Percent, X, Clock, Search } from 'lucide-react';
import { timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41],
  className: 'leaflet-marker-tax',
});
L.Marker.prototype.options.icon = DefaultIcon;

const FISHERS_CENTER: [number, number] = [39.9417, -86.0138];

function TaxDistrictCard({ t, active, onClick }: { t: TaxDistrict; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
        active
          ? 'bg-rose-500/10 border-rose-500/35 shadow-[0_4px_20px_rgba(244,63,94,0.15)]'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
      }`}
    >
      <div className="flex justify-between items-start mb-1.5">
        {t.district_code && (
          <span className="text-[10px] font-mono text-rose-400/70">{t.district_code}</span>
        )}
        {t.tax_rate != null && (
          <span className="text-[10px] font-bold text-rose-400/60 flex items-center gap-0.5">
            <Percent size={9} /> {t.tax_rate}%
          </span>
        )}
      </div>
      <h3 className={`font-semibold text-sm truncate transition-colors ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
        {t.district_name ?? 'Unknown district'}
      </h3>
      {t.net_assessed_value != null && (
        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
          <DollarSign size={9} /> {t.net_assessed_value.toLocaleString()} net AV
        </p>
      )}
    </div>
  );
}

function TaxDistrictDetail({ t }: { t: TaxDistrict }) {
  return (
    <div className="border-t border-white/[0.06] bg-background/60 backdrop-blur p-4 space-y-3 shrink-0 animate-slide-up max-h-72 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-white text-sm leading-snug">{t.district_name ?? 'Unknown district'}</h3>
          {t.district_code && <span className="text-[10px] font-mono text-slate-500">{t.district_code}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {t.tax_rate != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Tax Rate</div>
            <div className="font-mono font-bold text-rose-400 text-base">{t.tax_rate}%</div>
          </div>
        )}
        {t.net_assessed_value != null && (
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Net Assessed Value</div>
            <div className="font-mono font-bold text-slate-200 text-base">${t.net_assessed_value.toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaxDistricts() {
  const { showError } = useToast();
  const [items, setItems] = useState<TaxDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePin, setActivePin] = useState<TaxDistrict | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchTaxDistricts()
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
        console.error('[TaxDistricts] fetch error:', err);
        showError(`Failed to load tax districts: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const filtered = useMemo(() => {
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.district_name?.toLowerCase().includes(q)) ||
        (t.district_code?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, searchQuery]);

  const mappable = filtered.filter(t => t.lat && t.lng);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Tax Districts</h1>
          <ModuleBadge module="tax_districts" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Tax district boundaries and rates — district codes, names, tax rates, and net assessed values.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search district name, code…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} districts</span>
      </div>

      <div className="flex flex-col md:flex-row gap-5 h-[72vh]">
        <div className="w-full md:w-72 lg:w-80 flex flex-col glass-card rounded-2xl overflow-hidden shrink-0">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="text-sm font-semibold text-white font-display flex items-center gap-2">
              <Landmark size={13} className="text-rose-400" />
              <span className="text-rose-400">{loading ? '…' : filtered.length}</span>
              <span className="text-slate-500 font-normal text-xs">districts</span>
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
                No tax districts found.<br />
                <span className="text-slate-700">Run the tax district scraper to populate data.</span>
              </div>
            )}
            {filtered.map(t => (
              <TaxDistrictCard key={t.id} t={t} active={activePin?.id === t.id} onClick={() => setActivePin(t)} />
            ))}
          </div>

          {activePin && <TaxDistrictDetail t={activePin} />}
        </div>

        <div className="flex-1 h-full rounded-2xl overflow-hidden border border-white/[0.07] relative z-0 shadow-card">
          <style>{`.leaflet-marker-tax { filter: hue-rotate(320deg) brightness(1.2); }`}</style>
          <MapContainer center={FISHERS_CENTER} zoom={12} className="w-full h-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <LayerGroup>
              {mappable.map(t => (
                <Marker key={t.id} position={[t.lat!, t.lng!]} icon={DefaultIcon}
                  eventHandlers={{ click: () => setActivePin(t) }}>
                  <Popup>
                    <strong>{t.district_name ?? t.district_code}</strong>
                    {t.district_code && <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>{t.district_code}</div>}
                    {t.tax_rate != null && <div style={{ fontSize: '0.8rem', color: '#f43f5e', marginTop: 4, fontWeight: 'bold' }}>{t.tax_rate}%</div>}
                    {t.net_assessed_value != null && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>${t.net_assessed_value.toLocaleString()}</div>
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
