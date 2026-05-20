import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ModuleBadge, StatusChip } from '../components/Shared';
import { fetchZoning, ZoningChange } from '../api';
import { X, MapPin, ArrowRight, Mail, User, Building2, Clock } from 'lucide-react';
import { formatDate, timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
const DevIcon = L.icon({
  iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41], className: 'leaflet-marker-dev',
});
L.Marker.prototype.options.icon = DefaultIcon;

const FISHERS_CENTER: [number, number] = [39.9417, -86.0138];

function boardingTypeLabel(requestType: string | null): string {
  switch (requestType) {
    case 'RZ': return 'Rezone';
    case 'VA': return 'Variance';
    case 'SE': return 'Special Exception';
    case 'TA': return 'Text Amendment';
    case 'DP': return 'Development Plan';
    case 'PP': return 'Primary Plat';
    case 'SP': return 'Secondary Plat';
    default:   return requestType ?? 'Petition';
  }
}

function NoticeCard({ z, active, onClick }: { z: ZoningChange; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
        active
          ? 'bg-amber-500/10 border-amber-500/35 shadow-[0_4px_20px_rgba(245,166,35,0.15)]'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <StatusChip status={z.status} />
        {z.docket && <span className="text-[10px] text-slate-500 font-mono">{z.docket}</span>}
      </div>
      <h3 className={`font-semibold text-sm truncate transition-colors ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
        {z.address}
      </h3>
      {z.request_type && <p className="text-[11px] text-primary/80 mt-0.5">{boardingTypeLabel(z.request_type)}</p>}
      {z.hearing_date && <p className="text-[10px] text-slate-600 mt-1">Hearing: {formatDate(z.hearing_date)}</p>}
      {!active && (
        <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-1.5 group-hover:text-slate-400 transition-colors">
          <ArrowRight size={10} /> Click to inspect
        </div>
      )}
    </div>
  );
}

function DevProjectCard({ z, active, onClick }: { z: ZoningChange; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${
        active
          ? 'bg-indigo-500/10 border-indigo-500/35 shadow-[0_4px_20px_rgba(99,102,241,0.15)]'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/10'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <StatusChip status={z.status} />
        {z.project_type && (
          <span className="text-[10px] text-indigo-400/70 font-semibold uppercase tracking-wider">{z.project_type}</span>
        )}
      </div>
      <h3 className={`font-semibold text-sm truncate transition-colors ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
        {z.project_name ?? z.address}
      </h3>
      {z.applicant && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{z.applicant}</p>}
      {!active && (
        <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-1.5 group-hover:text-slate-400 transition-colors">
          <ArrowRight size={10} /> Click to inspect
        </div>
      )}
    </div>
  );
}

function NoticeDetail({ z }: { z: ZoningChange }) {
  return (
    <div className="border-t border-white/[0.06] bg-background/60 backdrop-blur p-4 space-y-3 shrink-0 animate-slide-up max-h-72 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-white text-sm leading-snug">{z.address}</h3>
        {z.docket && <span className="text-[10px] font-mono text-slate-500 shrink-0">{z.docket}</span>}
      </div>
      {z.board && <p className="text-[11px] text-primary/80 font-medium">{z.board}</p>}
      {z.description && <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{z.description}</p>}
      {(z.from_zone || z.to_zone) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">From Zone</div>
            <div className="font-mono font-bold text-warning text-base">{z.from_zone ?? '—'}</div>
          </div>
          <div className="glass-inset px-3 py-2.5">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">To Zone</div>
            <div className="font-mono font-bold text-primary text-base">{z.to_zone ?? '—'}</div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <StatusChip status={z.status} />
        {z.hearing_date && (
          <span className="text-[11px] text-slate-600 font-mono">
            Hearing {formatDate(z.hearing_date)}
          </span>
        )}
      </div>
      {z.city_staff && (
        <div className="pt-1 border-t border-white/[0.05] space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <User size={10} className="text-slate-600" />
            {z.city_staff}
          </div>
          {z.city_staff_email && (
            <a href={`mailto:${z.city_staff_email}`}
              className="flex items-center gap-1.5 text-[11px] text-primary/70 hover:text-primary transition-colors">
              <Mail size={10} />
              {z.city_staff_email}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function DevProjectDetail({ z }: { z: ZoningChange }) {
  return (
    <div className="border-t border-white/[0.06] bg-background/60 backdrop-blur p-4 space-y-3 shrink-0 animate-slide-up max-h-72 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-white text-sm leading-snug">{z.project_name ?? z.address}</h3>
        {z.project_type && (
          <span className="text-[10px] text-indigo-400/70 font-semibold uppercase tracking-wider shrink-0">{z.project_type}</span>
        )}
      </div>
      {z.applicant && (
        <p className="text-[11px] text-slate-400">Applicant: <span className="text-slate-300">{z.applicant}</span></p>
      )}
      {z.description && <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{z.description}</p>}
      {z.address && z.address !== z.project_name && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <MapPin size={10} /> {z.address}
        </p>
      )}
      <div className="flex items-center justify-between">
        <StatusChip status={z.status} />
        {z.est_completion && (
          <span className="text-[11px] text-slate-600 font-mono">Est. {z.est_completion}</span>
        )}
      </div>
      {(z.contact_name || z.contact_email) && (
        <div className="pt-1 border-t border-white/[0.05] space-y-1">
          {z.contact_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <User size={10} className="text-slate-600" />
              {z.contact_name}
            </div>
          )}
          {z.contact_email && (
            <a href={`mailto:${z.contact_email}`}
              className="flex items-center gap-1.5 text-[11px] text-indigo-400/70 hover:text-indigo-400 transition-colors">
              <Mail size={10} />
              {z.contact_email}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

type LayerFilter = 'all' | 'notices' | 'projects';

export default function Zoning() {
  const { showError } = useToast();
  const [items, setItems] = useState<ZoningChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePin, setActivePin] = useState<ZoningChange | null>(null);
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchZoning()
      .then(data => {
        setItems(data);
        const latest = data.reduce<string | null>((acc, r) => {
          const raw = r.scraped_at ?? r.filed_date ?? r.hearing_date;
          if (!raw) return acc;
          if (!acc) return raw;
          return new Date(raw) > new Date(acc) ? raw : acc;
        }, null);
        setLastUpdated(latest);
      })
      .catch(err => {
        console.error('[Zoning] fetch error:', err);
        showError(`Failed to load zoning data: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const notices     = useMemo(() => items.filter(z => z.source === 'public_notice'), [items]);
  const devProjects = useMemo(() => items.filter(z => z.source === 'dev_project'),   [items]);

  const visibleNotices  = layerFilter !== 'projects' ? notices     : [];
  const visibleProjects = layerFilter !== 'notices'  ? devProjects : [];

  const mappableNotices  = visibleNotices.filter(z => z.lat && z.lng);
  const mappableProjects = visibleProjects.filter(z => z.lat && z.lng);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Zoning Map</h1>
          <ModuleBadge module="zoning" />
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
          {(['all', 'notices', 'projects'] as LayerFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setLayerFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                layerFilter === f ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f === 'all' ? 'All' : f === 'notices' ? 'Hearings' : 'Projects'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">
          Zoning petitions and development projects for Fishers, IN — sourced from the City's ArcGIS portal.
        </p>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0 ml-4">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      {/* Map + Sidebar */}
      <div className="flex flex-col md:flex-row gap-5 h-[78vh]">
        {/* Sidebar */}
        <div className="w-full md:w-72 lg:w-80 flex flex-col glass-card rounded-2xl overflow-hidden shrink-0">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="text-sm font-semibold text-white font-display flex items-center gap-3">
              {layerFilter !== 'projects' && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-amber-400" />
                  <span className="text-amber-400">{loading ? '…' : visibleNotices.length}</span>
                  <span className="text-slate-500 font-normal text-xs">hearings</span>
                </span>
              )}
              {layerFilter !== 'notices' && (
                <span className="flex items-center gap-1.5">
                  <Building2 size={13} className="text-indigo-400" />
                  <span className="text-indigo-400">{loading ? '…' : visibleProjects.length}</span>
                  <span className="text-slate-500 font-normal text-xs">projects</span>
                </span>
              )}
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
            {!loading && visibleNotices.length === 0 && visibleProjects.length === 0 && (
              <div className="text-slate-600 text-xs text-center py-8">
                No items found.<br />
                <span className="text-slate-700">Run the zoning scraper to populate data.</span>
              </div>
            )}
            {visibleNotices.length > 0 && layerFilter !== 'projects' && (
              <>
                {layerFilter === 'all' && (
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-widest font-bold px-1 pb-1">Hearings</p>
                )}
                {visibleNotices.map(z => (
                  <NoticeCard key={z.id} z={z} active={activePin?.id === z.id} onClick={() => setActivePin(z)} />
                ))}
              </>
            )}
            {visibleProjects.length > 0 && layerFilter !== 'notices' && (
              <>
                {layerFilter === 'all' && (
                  <p className="text-[10px] text-indigo-400/70 uppercase tracking-widest font-bold px-1 pb-1 pt-3">Development Projects</p>
                )}
                {visibleProjects.map(z => (
                  <DevProjectCard key={z.id} z={z} active={activePin?.id === z.id} onClick={() => setActivePin(z)} />
                ))}
              </>
            )}
          </div>

          {activePin && (
            activePin.source === 'dev_project'
              ? <DevProjectDetail z={activePin} />
              : <NoticeDetail z={activePin} />
          )}
        </div>

        {/* Map */}
        <div className="flex-1 h-full rounded-2xl overflow-hidden border border-white/[0.07] relative z-0 shadow-card">
          <style>{`.leaflet-marker-dev { filter: hue-rotate(200deg) brightness(1.1); }`}</style>
          <MapContainer center={FISHERS_CENTER} zoom={12} className="w-full h-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <LayerGroup>
              {mappableNotices.map(z => (
                <Marker key={z.id} position={[z.lat!, z.lng!]} icon={DefaultIcon}
                  eventHandlers={{ click: () => setActivePin(z) }}>
                  <Popup>
                    <strong>{z.address}</strong>
                    {z.docket && <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>{z.docket}</div>}
                    {z.description && <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>{z.description.slice(0, 120)}…</div>}
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
            <LayerGroup>
              {mappableProjects.map(z => (
                <Marker key={z.id} position={[z.lat!, z.lng!]} icon={DevIcon}
                  eventHandlers={{ click: () => setActivePin(z) }}>
                  <Popup>
                    <strong>{z.project_name ?? z.address}</strong>
                    {z.project_type && <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>{z.project_type}</div>}
                    {z.applicant && <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>{z.applicant}</div>}
                    {z.status && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{z.status}</div>}
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
