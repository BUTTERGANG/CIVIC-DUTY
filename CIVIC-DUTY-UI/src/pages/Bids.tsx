import { useState, useMemo, useEffect } from 'react';
import { ModuleBadge, StatusChip, DocumentList, EmptyState } from '../components/Shared';
import { SlidersHorizontal, Calendar, Building2, CheckCircle2, Clock } from 'lucide-react';
import { fetchBids, Bid } from '../api';
import { formatDate, latestTimestamp, timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

const STATUS_COLORS: Record<string, string[]> = {
  open:        ['bg-warning/8 border-warning/25 hover:border-warning/45', '#f5a623'],
  closed:      ['bg-white/[0.02] border-white/[0.06] hover:border-white/10', '#64748b'],
  awarded:     ['bg-success/8 border-success/25 hover:border-success/45', '#10d98a'],
  anticipated: ['bg-indigo-500/8 border-indigo-500/25 hover:border-indigo-500/45', '#818cf8'],
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function SkeletonCard() {
  return (
    <div className="glass-card p-0 flex flex-col overflow-hidden">
      <div className="h-[3px] w-full bg-white/[0.04]" />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-center mb-4">
          <div className="skeleton h-5 w-16 rounded-lg" />
          <div className="skeleton h-4 w-20 rounded" />
        </div>
        <div className="skeleton skeleton-title mb-2" />
        <div className="skeleton skeleton-text w-32 mb-4" />
        <div className="mt-auto grid grid-cols-2 gap-2">
          <div className="glass-inset px-3 py-2.5">
            <div className="skeleton skeleton-text w-12 mb-1" />
            <div className="skeleton h-4 w-16" />
          </div>
          <div className="glass-inset px-3 py-2.5">
            <div className="skeleton skeleton-text w-14 mb-1" />
            <div className="skeleton h-4 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Bids() {
  const { showError } = useToast();
  const [data, setData] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAgency, setFilterAgency] = useState('');
  const [filterMinValue, setFilterMinValue] = useState('');
  const [filterMaxValue, setFilterMaxValue] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const debouncedMinValue = useDebounce(filterMinValue, 500);
  const debouncedMaxValue = useDebounce(filterMaxValue, 500);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { limit: '200' };
    if (filterStatus) params.status = filterStatus;
    if (filterAgency) params.agency = filterAgency;
    if (debouncedMinValue) params.min_value = debouncedMinValue;
    if (debouncedMaxValue) params.max_value = debouncedMaxValue;

    fetchBids(params)
      .then(rows => {
        setData(rows);
        const latest = latestTimestamp(rows, ['scraped_at', 'posted_date']);
        setLastUpdated(latest);
      })
      .catch(e => {
        setError(e.message);
        showError(`Failed to load bids: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [filterStatus, filterAgency, debouncedMinValue, debouncedMaxValue, showError]);

  const agencies = useMemo(() => Array.from(new Set(data.map(b => b.agency).filter(Boolean))), [data]);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex md:items-end justify-between flex-col md:flex-row gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="page-header">Bid Monitor</h1>
            <ModuleBadge module="bids" />
          </div>
          <p className="text-slate-500 text-sm max-w-xl">Tracking public procurement opportunities and contract awards.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select className="select-field pl-8 w-40" onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="awarded">Awarded</option>
              <option value="anticipated">Anticipated</option>
            </select>
          </div>
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select className="select-field pl-8 w-52" onChange={e => setFilterAgency(e.target.value)}>
              <option value="">All Agencies</option>
              {agencies.map(a => <option key={a!} value={a!}>{a}</option>)}
            </select>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">$</span>
            <input type="number" placeholder="Min Value" className="input-field pl-6 w-32" onChange={e => setFilterMinValue(e.target.value)} />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">$</span>
            <input type="number" placeholder="Max Value" className="input-field pl-6 w-32" onChange={e => setFilterMaxValue(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-600 font-mono">
          {loading ? 'Loading…' : error ? `Error: ${error}` : `${data.length} records`}
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      {error && !loading ? (
        <EmptyState title="Failed to load" message="Could not fetch bids. Please try again later." />
      ) : !loading && data.length === 0 ? (
        <EmptyState title="No bids found" message="Try adjusting your filters, or the scraper may not have run yet." />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : data.map(b => {
                const [cardClass, glowColor] = STATUS_COLORS[b.status] ?? STATUS_COLORS.closed;
                return (
                  <div key={b.id} className={`glass-card p-0 flex flex-col overflow-hidden border ${cardClass} transition-all duration-300 hover:-translate-y-0.5`}>
                    <div className="h-[3px] w-full" style={{ background: `linear-gradient(to right, ${glowColor}80, transparent)` }} />
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex justify-between items-center mb-4">
                        <StatusChip status={b.status} />
                        {b.posted_date && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-mono">
                            <Calendar size={11} />
                            {formatDate(b.posted_date)}
                          </div>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-100 leading-snug mb-1.5">{b.title}</h3>
                      {b.agency && <p className="text-indigo-400 text-sm font-medium mb-4">{b.agency}</p>}
                      <div className="mt-auto space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="glass-inset px-3 py-2.5">
                            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Category</div>
                            <div className="text-sm font-semibold text-slate-300 capitalize">{b.category ?? '—'}</div>
                          </div>
                          <div className="glass-inset px-3 py-2.5">
                            <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Est. Value</div>
                            <div className="text-sm font-bold text-slate-200 font-mono">
                              {b.value_estimate != null ? `$${b.value_estimate.toLocaleString()}` : '—'}
                            </div>
                          </div>
                        </div>
                        {b.awarded_to && (
                          <div className="flex items-center gap-2 bg-success/8 border border-success/20 px-3 py-2 rounded-xl">
                            <CheckCircle2 size={14} className="text-success shrink-0" />
                            <div>
                              <div className="text-[10px] text-success/70 uppercase tracking-wider font-bold">Awarded To</div>
                              <div className="text-xs text-success font-medium">{b.awarded_to}</div>
                            </div>
                          </div>
                        )}
                        <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between">
                          <DocumentList docs={b.documents} />
                          {b.close_date && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-mono">
                              <Calendar size={11} />
                              Closes {formatDate(b.close_date)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      )}
    </div>
  );
}
