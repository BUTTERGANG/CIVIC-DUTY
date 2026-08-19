import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchParcelOwners, ParcelOwner } from '../api';
import { Clock, Search, User, MapPin, DollarSign, Building2 } from 'lucide-react';
import { timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function ParcelOwners() {
  const { showError } = useToast();
  const [items, setItems] = useState<ParcelOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTownship, setFilterTownship] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchParcelOwners({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at']));
      })
      .catch(err => {
        console.error('[ParcelOwners] fetch error:', err);
        showError(`Failed to load parcel owners: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const classes = useMemo(
    () => Array.from(new Set(items.map(p => p.property_class).filter(Boolean))).sort(),
    [items]
  );
  const townships = useMemo(
    () => Array.from(new Set(items.map(p => p.township_name).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (filterClass) result = result.filter(p => p.property_class === filterClass);
    if (filterTownship) result = result.filter(p => p.township_name === filterTownship);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        (p.owner_name?.toLowerCase().includes(q)) ||
        (p.owner_address?.toLowerCase().includes(q)) ||
        (p.state_parcel_number?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterClass, filterTownship, searchQuery]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Parcel Owners</h1>
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
        Search Indianapolis properties by owner name. View assessed land and improvement values, property class, and owner contact info.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search owner name, address, parcel #…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-72"
          />
        </div>
        <select className="select-field w-44" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">All Property Classes</option>
          {classes.map(c => <option key={c!} value={c!}>{c}</option>)}
        </select>
        <select className="select-field w-40" value={filterTownship} onChange={e => setFilterTownship(e.target.value)}>
          <option value="">All Townships</option>
          {townships.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} owners</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <User size={14} className="text-emerald-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">parcel owners</span>
        </div>

        {loading && <div className="text-slate-500 text-xs text-center py-12">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">No parcel owners found. Run the parcel_owners scraper.</div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {filtered.map(p => (
            <div key={p.id}>
              <div
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white truncate">{p.owner_name ?? 'Unknown'}</span>
                    {p.property_class && (
                      <span className="text-[10px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded-md shrink-0">{p.property_class}</span>
                    )}
                  </div>
                  {p.owner_address && (
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <MapPin size={9} /> {p.owner_address}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {p.land_total != null && (
                    <div className="text-[11px] text-slate-400 font-mono">${p.land_total.toLocaleString()}</div>
                  )}
                  {p.township_name && <div className="text-[10px] text-slate-600">{p.township_name}</div>}
                </div>
              </div>

              {expanded === p.id && (
                <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.04] space-y-2 animate-slide-up">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Parcel #</div>
                      <div className="text-xs font-mono text-slate-300 truncate">{p.state_parcel_number ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Property Class</div>
                      <div className="text-xs text-slate-300">{p.property_class ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Land Value</div>
                      <div className="text-xs font-mono text-slate-300">{p.land_total != null ? `$${p.land_total.toLocaleString()}` : '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Improvement Value</div>
                      <div className="text-xs font-mono text-slate-300">{p.improvement_total != null ? `$${p.improvement_total.toLocaleString()}` : '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Township</div>
                      <div className="text-xs text-slate-300">{p.township_name ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Owner City</div>
                      <div className="text-xs text-slate-300">{p.owner_city ?? '—'}{p.owner_state ? `, ${p.owner_state}` : ''}</div>
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