import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchZoningVariances, ZoningVariance } from '../api';
import { Clock, Search, Scale, User, Calendar } from 'lucide-react';
import { formatDate, timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function ZoningVariances() {
  const { showError } = useToast();
  const [items, setItems] = useState<ZoningVariance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPlanner, setFilterPlanner] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchZoningVariances({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at', 'decision_date']));
      })
      .catch(err => {
        console.error('[ZoningVariances] fetch error:', err);
        showError(`Failed to load zoning variances: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const statuses = useMemo(
    () => Array.from(new Set(items.map(v => v.status).filter(Boolean))).sort(),
    [items]
  );
  const planners = useMemo(
    () => Array.from(new Set(items.map(v => v.planner).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (filterStatus) result = result.filter(v => v.status === filterStatus);
    if (filterPlanner) result = result.filter(v => v.planner === filterPlanner);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(v =>
        v.case_number.toLowerCase().includes(q) ||
        (v.recommendation?.toLowerCase().includes(q)) ||
        (v.planner?.toLowerCase().includes(q)) ||
        (v.status?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterStatus, filterPlanner, searchQuery]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Zoning Variances</h1>
          <ModuleBadge module="zoning" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Indianapolis zoning variance applications — case numbers, status, recommendations, and planner assignments from the Accela system.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search case number, planner, status…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <select className="select-field w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s!} value={s!}>{s}</option>)}
        </select>
        <select className="select-field w-40" value={filterPlanner} onChange={e => setFilterPlanner(e.target.value)}>
          <option value="">All Planners</option>
          {planners.map(p => <option key={p!} value={p!}>{p}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} variances</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <Scale size={14} className="text-amber-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">zoning variances</span>
        </div>

        {loading && <div className="text-slate-500 text-xs text-center py-12">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">No zoning variances found. Run the zoning_vars scraper.</div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {filtered.map(v => (
            <div key={v.id}>
              <div
                onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white font-mono">{v.case_number}</span>
                    {v.recommendation && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${
                        v.recommendation.toLowerCase().includes('approv')
                          ? 'text-success bg-success/10'
                          : v.recommendation.toLowerCase().includes('den')
                          ? 'text-danger bg-danger/10'
                          : 'text-slate-500 bg-white/[0.04]'
                      }`}>
                        {v.recommendation}
                      </span>
                    )}
                  </div>
                  {v.planner && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <User size={9} /> {v.planner}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {v.status && (
                    <div className="text-[11px] text-slate-400">{v.status}</div>
                  )}
                  {v.decision_date && (
                    <div className="text-[10px] text-slate-600 font-mono">{formatDate(v.decision_date)}</div>
                  )}
                </div>
              </div>

              {expanded === v.id && (
                <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.04] space-y-2 animate-slide-up">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Case #</div>
                      <div className="text-xs font-mono text-slate-300">{v.case_number}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Recommendation</div>
                      <div className="text-xs text-slate-300">{v.recommendation ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Status</div>
                      <div className="text-xs text-slate-300">{v.status ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Planner</div>
                      <div className="text-xs text-slate-300">{v.planner ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Decision Date</div>
                      <div className="text-xs font-mono text-slate-300">{v.decision_date ? formatDate(v.decision_date) : '—'}</div>
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