import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchPlacesOfWorship, PlaceOfWorship } from '../api';
import { Clock, Search, Church, MapPin } from 'lucide-react';
import { timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function PlacesOfWorship() {
  const { showError } = useToast();
  const [items, setItems] = useState<PlaceOfWorship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchPlacesOfWorship({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at']));
      })
      .catch(err => {
        console.error('[Worship] fetch error:', err);
        showError(`Failed to load places of worship: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const types = useMemo(
    () => Array.from(new Set(items.map(p => p.place_type).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (filterType) result = result.filter(p => p.place_type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.address?.toLowerCase().includes(q)) ||
        (p.place_type?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterType, searchQuery]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Places of Worship</h1>
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
        Religious institutions in Indianapolis — directory from city records.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, address, type…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <select className="select-field w-44" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} places</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <Church size={14} className="text-violet-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">places of worship</span>
        </div>

        {loading && <div className="text-slate-500 text-xs text-center py-12">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">No places of worship found.</div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {filtered.map(p => (
            <div key={p.id} className="px-5 py-3.5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">{p.name}</span>
                    {p.place_type && (
                      <span className="text-[10px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded-md">
                        {p.place_type}
                      </span>
                    )}
                  </div>
                  {p.address && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={9} /> {p.address}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}