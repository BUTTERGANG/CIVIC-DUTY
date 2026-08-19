import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchCallsForService, CallForService } from '../api';
import { Clock, Search, Phone, MapPin, Clock as Timer } from 'lucide-react';
import { formatDateTime, timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function CallsForService() {
  const { showError } = useToast();
  const [items, setItems] = useState<CallForService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchCallsForService({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at', 'received_at']));
      })
      .catch(err => {
        console.error('[CFS] fetch error:', err);
        showError(`Failed to load calls for service: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const types = useMemo(
    () => Array.from(new Set(items.map(r => r.incident_type).filter(Boolean))).sort(),
    [items]
  );
  const districts = useMemo(
    () => Array.from(new Set(items.map(r => r.district).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (filterType) result = result.filter(r => r.incident_type === filterType);
    if (filterDistrict) result = result.filter(r => r.district === filterDistrict);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.incident_type?.toLowerCase().includes(q)) ||
        (r.address?.toLowerCase().includes(q)) ||
        (r.call_source?.toLowerCase().includes(q)) ||
        (r.district?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterType, filterDistrict, searchQuery]);

  function responseTime(rec: string | null, disp: string | null): string | null {
    if (!rec || !disp) return null;
    const secs = (new Date(disp).getTime() - new Date(rec).getTime()) / 1000;
    if (secs < 60) return `${Math.round(secs)}s`;
    return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Calls for Service</h1>
          <ModuleBadge module="incidents" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        IMPD Computer Aided Dispatch (CAD) calls — every police dispatch with response timelines and council district geography.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search type, address, district…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <select className="select-field w-48" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <select className="select-field w-36" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
          <option value="">All Districts</option>
          {districts.map(d => <option key={d!} value={d!}>{d}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} calls</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <Phone size={14} className="text-orange-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">calls for service</span>
        </div>

        {loading && <div className="text-slate-500 text-xs text-center py-12">Loading…</div>}

        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">
            No calls for service found.
          </div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {filtered.map(r => {
            const rt = responseTime(r.received_at, r.dispatched_at);
            return (
              <div key={r.id}>
                <div
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white truncate">{r.incident_type}</span>
                      {r.call_source && (
                        <span className="text-[10px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded-md shrink-0">
                          {r.call_source}
                        </span>
                      )}
                    </div>
                    {r.address && (
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                        <MapPin size={9} /> {r.address}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {rt && (
                      <span className="flex items-center gap-1 text-[11px] text-primary font-mono">
                        <Timer size={11} /> {rt}
                      </span>
                    )}
                    {r.received_at && (
                      <div className="text-[11px] text-slate-600 font-mono">
                        {formatDateTime(r.received_at)}
                      </div>
                    )}
                  </div>
                </div>

                {expanded === r.id && (
                  <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.04] space-y-2 animate-slide-up">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="glass-inset px-3 py-2">
                        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">CAD #</div>
                        <div className="text-xs font-mono text-slate-300 truncate">{r.cad ?? '—'}</div>
                      </div>
                      {r.primary_dispatch && (
                        <div className="glass-inset px-3 py-2">
                          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Dispatch</div>
                          <div className="text-xs text-slate-300">{r.primary_dispatch}</div>
                        </div>
                      )}
                      {r.district && (
                        <div className="glass-inset px-3 py-2">
                          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">District</div>
                          <div className="text-xs text-slate-300">{r.district}</div>
                        </div>
                      )}
                      {r.council_district && (
                        <div className="glass-inset px-3 py-2">
                          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Council</div>
                          <div className="text-xs text-slate-300">{r.council_district}</div>
                        </div>
                      )}
                      <div className="glass-inset px-3 py-2">
                        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Received</div>
                        <div className="text-xs font-mono text-slate-300">{r.received_at ? formatDateTime(r.received_at) : '—'}</div>
                      </div>
                      <div className="glass-inset px-3 py-2">
                        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Dispatched</div>
                        <div className="text-xs font-mono text-slate-300">{r.dispatched_at ? formatDateTime(r.dispatched_at) : '—'}</div>
                      </div>
                      <div className="glass-inset px-3 py-2">
                        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Arrived</div>
                        <div className="text-xs font-mono text-slate-300">{r.arrived_at ? formatDateTime(r.arrived_at) : '—'}</div>
                      </div>
                      <div className="glass-inset px-3 py-2">
                        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Cleared</div>
                        <div className="text-xs font-mono text-slate-300">{r.cleared_at ? formatDateTime(r.cleared_at) : '—'}</div>
                      </div>
                    </div>
                    {r.lat && r.lng && (
                      <div className="text-[10px] text-slate-600 font-mono">
                        {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}