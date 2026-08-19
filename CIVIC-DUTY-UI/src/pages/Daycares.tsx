import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchDaycares, Daycare } from '../api';
import { Clock, Search, Baby, MapPin, FileText } from 'lucide-react';
import { timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function Daycares() {
  const { showError } = useToast();
  const [items, setItems] = useState<Daycare[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchDaycares({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at']));
      })
      .catch(err => {
        console.error('[Daycares] fetch error:', err);
        showError(`Failed to load daycares: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const filtered = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(d =>
      d.name.toLowerCase().includes(q) ||
      (d.address?.toLowerCase().includes(q)) ||
      (d.provider_type?.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Licensed Daycares</h1>
          <ModuleBadge module="serviceRequests" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Licensed daycare ministries in Indianapolis — facility names, addresses, and license numbers.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, address…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} daycares</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <Baby size={14} className="text-cyan-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">licensed daycares</span>
        </div>

        {loading && <div className="text-slate-500 text-xs text-center py-12">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">No daycares found.</div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {filtered.map(d => (
            <div key={d.id} className="px-5 py-3.5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">{d.name}</span>
                    {d.provider_type && (
                      <span className="text-[10px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded-md">
                        {d.provider_type}
                      </span>
                    )}
                  </div>
                  {d.address && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={9} /> {d.address}
                    </p>
                  )}
                </div>
                {d.license_number && (
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-slate-600">License</div>
                    <div className="text-[11px] font-mono text-slate-400">{d.license_number}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}