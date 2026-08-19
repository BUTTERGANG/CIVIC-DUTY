import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchCrashes, Crash } from '../api';
import { Clock, Search, Car, AlertTriangle, Users, Skull } from 'lucide-react';
import { formatDateTime, timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function Crashes() {
  const { showError } = useToast();
  const [items, setItems] = useState<Crash[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchCrashes({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at', 'occurred_at']));
      })
      .catch(err => {
        console.error('[Crashes] fetch error:', err);
        showError(`Failed to load crashes: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const types = useMemo(
    () => Array.from(new Set(items.map(r => r.crash_type).filter(Boolean))).sort(),
    [items]
  );
  const districts = useMemo(
    () => Array.from(new Set(items.map(r => r.district).filter(Boolean))).sort(),
    [items]
  );
  const severities = useMemo(
    () => Array.from(new Set(items.map(r => r.severity).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (filterType) result = result.filter(r => r.crash_type === filterType);
    if (filterDistrict) result = result.filter(r => r.district === filterDistrict);
    if (filterSeverity) result = result.filter(r => r.severity === filterSeverity);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.crash_type?.toLowerCase().includes(q)) ||
        (r.address?.toLowerCase().includes(q)) ||
        (r.severity?.toLowerCase().includes(q)) ||
        (r.district?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterType, filterDistrict, filterSeverity, searchQuery]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Traffic Crashes</h1>
          <ModuleBadge module="crashes" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Indianapolis traffic crash reports from IMPD — severity, location, and casualty counts.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search type, address, district…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-56"
          />
        </div>
        <select className="select-field w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <select className="select-field w-40" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
          <option value="">All Severities</option>
          {severities.map(s => <option key={s!} value={s!}>{s}</option>)}
        </select>
        <select className="select-field w-36" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
          <option value="">All Districts</option>
          {districts.map(d => <option key={d!} value={d!}>{d}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} crashes</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <Car size={14} className="text-red-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">traffic crashes</span>
        </div>

        {loading && (
          <div className="text-slate-500 text-xs text-center py-12">Loading…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">
            No crashes found.
          </div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {filtered.map(r => (
            <div key={r.id}>
              <div
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white truncate">
                      {r.crash_type ?? 'Crash'}
                    </span>
                    {r.severity && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${
                        r.severity.toLowerCase().includes('fatal')
                          ? 'text-red-400 bg-red-500/10'
                          : r.severity.toLowerCase().includes('injury')
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-slate-500 bg-white/[0.04]'
                      }`}>
                        {r.severity}
                      </span>
                    )}
                  </div>
                  {r.address && (
                    <p className="text-xs text-slate-500 truncate">{r.address}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.injuries > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-400 font-mono">
                      <Users size={11} /> {r.injuries}
                    </span>
                  )}
                  {r.fatalities > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-red-400 font-mono">
                      <Skull size={11} /> {r.fatalities}
                    </span>
                  )}
                  {r.occurred_at && (
                    <div className="text-[11px] text-slate-600 font-mono">
                      {formatDateTime(r.occurred_at)}
                    </div>
                  )}
                </div>
              </div>

              {expanded === r.id && (
                <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.04] space-y-2 animate-slide-up">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {r.crash_id && (
                      <div className="glass-inset px-3 py-2">
                        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">ID</div>
                        <div className="text-xs font-mono text-slate-300 truncate">{r.crash_id}</div>
                      </div>
                    )}
                    {r.address && (
                      <div className="glass-inset px-3 py-2">
                        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Address</div>
                        <div className="text-xs text-slate-300">{r.address}</div>
                      </div>
                    )}
                    {r.district && (
                      <div className="glass-inset px-3 py-2">
                        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">District</div>
                        <div className="text-xs text-slate-300">{r.district}</div>
                      </div>
                    )}
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Vehicles</div>
                      <div className="text-xs font-mono text-slate-300">{r.vehicles_involved ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Injuries</div>
                      <div className="text-xs font-mono text-amber-400">{r.injuries ?? 0}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Fatalities</div>
                      <div className="text-xs font-mono text-red-400">{r.fatalities ?? 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}