import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchPropertyAssessments, PropertyAssessment } from '../api';
import { Clock, Search, DollarSign, FileText, MapPin } from 'lucide-react';
import { timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function PropertyAssessments() {
  const { showError } = useToast();
  const [items, setItems] = useState<PropertyAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchPropertyAssessments({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at']));
      })
      .catch(err => {
        console.error('[Assessments] fetch error:', err);
        showError(`Failed to load assessments: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const filtered = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(a =>
      (a.owner_name?.toLowerCase().includes(q)) ||
      (a.address?.toLowerCase().includes(q)) ||
      (a.parcel_number?.toLowerCase().includes(q)) ||
      (a.state_pin?.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Property Assessments</h1>
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
        Indianapolis property assessed values — land value, improvement value, and legal descriptions from the Accela system.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search owner, address, parcel number…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-72"
          />
        </div>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} assessments</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <DollarSign size={14} className="text-emerald-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">property assessments</span>
        </div>

        {loading && <div className="text-slate-500 text-xs text-center py-12">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">No assessments found. Run the assessments scraper.</div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {filtered.map(a => (
            <div key={a.id}>
              <div
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white truncate">{a.owner_name ?? 'Unknown'}</span>
                  </div>
                  {a.address && (
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <MapPin size={9} /> {a.address}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {a.land_value && (
                    <div className="text-[11px] text-slate-400 font-mono">Land: ${a.land_value}</div>
                  )}
                  {a.improved_value && (
                    <div className="text-[11px] text-slate-500 font-mono">Impr: ${a.improved_value}</div>
                  )}
                </div>
              </div>

              {expanded === a.id && (
                <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.04] space-y-2 animate-slide-up">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Parcel #</div>
                      <div className="text-xs font-mono text-slate-300">{a.parcel_number ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Land Value</div>
                      <div className="text-xs font-mono text-slate-300">{a.land_value ? `$${a.land_value}` : '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Improvement Value</div>
                      <div className="text-xs font-mono text-slate-300">{a.improved_value ? `$${a.improved_value}` : '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">State PIN</div>
                      <div className="text-xs font-mono text-slate-300">{a.state_pin ?? '—'}</div>
                    </div>
                  </div>
                  {a.legal_desc && (
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Legal Description</div>
                      <div className="text-xs text-slate-300">{a.legal_desc}</div>
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