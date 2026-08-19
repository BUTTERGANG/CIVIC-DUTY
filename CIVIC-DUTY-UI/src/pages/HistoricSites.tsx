import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchHistoricSites, HistoricSite } from '../api';
import { Clock, Search, Building2, Calendar, MapPin } from 'lucide-react';
import { timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function HistoricSites() {
  const { showError } = useToast();
  const [items, setItems] = useState<HistoricSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchHistoricSites({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at']));
      })
      .catch(err => {
        console.error('[HistoricSites] fetch error:', err);
        showError(`Failed to load historic sites: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const districts = useMemo(
    () => Array.from(new Set(items.map(s => s.district).filter(Boolean))).sort(),
    [items]
  );
  const ratings = useMemo(
    () => Array.from(new Set(items.map(s => s.rating).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (filterDistrict) result = result.filter(s => s.district === filterDistrict);
    if (filterRating) result = result.filter(s => s.rating === filterRating);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.address?.toLowerCase().includes(q)) ||
        (s.district?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterDistrict, filterRating, searchQuery]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Historic Sites</h1>
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
        Indianapolis historic properties — year built, district, and preservation ratings from the Accela AGIS system.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, address, district…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <select className="select-field w-44" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
          <option value="">All Districts</option>
          {districts.map(d => <option key={d!} value={d!}>{d}</option>)}
        </select>
        <select className="select-field w-36" value={filterRating} onChange={e => setFilterRating(e.target.value)}>
          <option value="">All Ratings</option>
          {ratings.map(r => <option key={r!} value={r!}>{r}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} sites</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <Building2 size={14} className="text-cyan-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">historic sites</span>
        </div>

        {loading && <div className="text-slate-500 text-xs text-center py-12">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">
            No historic sites found.
          </div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {filtered.map(s => (
            <div key={s.id}>
              <div
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white truncate">{s.name}</span>
                    {s.year_built && (
                      <span className="text-[10px] text-slate-600 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded-md shrink-0">
                        {s.year_built}
                      </span>
                    )}
                  </div>
                  {s.address && (
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <MapPin size={9} /> {s.address}
                    </p>
                  )}
                </div>
                {s.rating && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0">
                    {s.rating}
                  </span>
                )}
              </div>

              {expanded === s.id && (
                <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.04] space-y-2 animate-slide-up">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Year Built</div>
                      <div className="text-xs font-mono text-slate-300">{s.year_built ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">District</div>
                      <div className="text-xs text-slate-300">{s.district ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Rating</div>
                      <div className="text-xs text-slate-300">{s.rating ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">SHAARD ID</div>
                      <div className="text-xs font-mono text-slate-300">{s.external_id ?? '—'}</div>
                    </div>
                  </div>
                  {s.notes && (
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Notes</div>
                      <div className="text-xs text-slate-300">{s.notes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}