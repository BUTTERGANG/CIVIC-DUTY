import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchCitations, Citation } from '../api';
import { Clock, Search, FileText, MapPin } from 'lucide-react';
import { formatDateTime, timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function Citations() {
  const { showError } = useToast();
  const [items, setItems] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterViolation, setFilterViolation] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchCitations({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at', 'issued_at']));
      })
      .catch(err => {
        console.error('[Citations] fetch error:', err);
        showError(`Failed to load citations: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const violations = useMemo(
    () => Array.from(new Set(items.map(r => r.violation).filter(Boolean))).sort(),
    [items]
  );
  const districts = useMemo(
    () => Array.from(new Set(items.map(r => r.district).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (filterViolation) result = result.filter(r => r.violation === filterViolation);
    if (filterDistrict) result = result.filter(r => r.district === filterDistrict);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.violation?.toLowerCase().includes(q)) ||
        (r.violation_type?.toLowerCase().includes(q)) ||
        (r.address?.toLowerCase().includes(q)) ||
        (r.district?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterViolation, filterDistrict, searchQuery]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Citations</h1>
          <ModuleBadge module="citations" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Indianapolis police citations from IMPD data — violation, location, district, and driver demographics.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search violation, address, district…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <select className="select-field w-52" value={filterViolation} onChange={e => setFilterViolation(e.target.value)}>
          <option value="">All Violations</option>
          {violations.map(v => <option key={v!} value={v!}>{v}</option>)}
        </select>
        <select className="select-field w-36" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
          <option value="">All Districts</option>
          {districts.map(d => <option key={d!} value={d!}>{d}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} citations</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <FileText size={14} className="text-yellow-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">citations</span>
        </div>

        {loading && (
          <div className="text-slate-500 text-xs text-center py-12">Loading…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">
            No citations found.
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
                    <span className="text-sm font-medium text-white truncate">{r.violation ?? 'Citation'}</span>
                    {r.violation_type && (
                      <span className="text-[10px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded-md shrink-0">
                        {r.violation_type}
                      </span>
                    )}
                  </div>
                  {r.address && (
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <MapPin size={9} /> {r.address}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {r.issued_at && (
                    <div className="text-[11px] text-slate-600 font-mono">
                      {formatDateTime(r.issued_at)}
                    </div>
                  )}
                  {r.district && (
                    <div className="text-[10px] text-slate-700 font-mono">{r.district}</div>
                  )}
                </div>
              </div>

              {expanded === r.id && (
                <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.04] space-y-2 animate-slide-up">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Citation ID</div>
                      <div className="text-xs font-mono text-slate-300 truncate">{r.citation_id}</div>
                    </div>
                    {r.address && (
                      <div className="glass-inset px-3 py-2">
                        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Location</div>
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
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Driver</div>
                      <div className="text-xs text-slate-300">
                        {[r.driver_age, r.driver_sex, r.driver_race].filter(Boolean).join(' · ') || '—'}
                      </div>
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