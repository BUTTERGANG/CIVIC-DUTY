import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchServiceRequests, ServiceRequest } from '../api';
import { Clock, Search, Wrench, MapPin, CheckCircle, XCircle, Clock as ClockIcon } from 'lucide-react';
import { formatDateTime, timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

const STATUS_COLORS: Record<string, string> = {
  open: 'text-warning bg-warning/10',
  'in_progress': 'text-primary bg-primary/10',
  closed: 'text-success bg-success/10',
};

export default function ServiceRequests() {
  const { showError } = useToast();
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchServiceRequests({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at', 'requested_at', 'closed_at']));
      })
      .catch(err => {
        console.error('[ServiceRequests] fetch error:', err);
        showError(`Failed to load service requests: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const types = useMemo(
    () => Array.from(new Set(items.map(r => r.request_type).filter(Boolean))).sort(),
    [items]
  );
  const districts = useMemo(
    () => Array.from(new Set(items.map(r => r.district).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (filterType) result = result.filter(r => r.request_type === filterType);
    if (filterStatus) result = result.filter(r => r.status === filterStatus);
    if (filterDistrict) result = result.filter(r => r.district === filterDistrict);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.request_type?.toLowerCase().includes(q)) ||
        (r.description?.toLowerCase().includes(q)) ||
        (r.address?.toLowerCase().includes(q)) ||
        (r.district?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterType, filterStatus, filterDistrict, searchQuery]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">311 Service Requests</h1>
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
        RequestIndy 311 service requests for Indianapolis — potholes, graffiti, street lights, and more.
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search type, description, address…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <select className="select-field w-48" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <select className="select-field w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <select className="select-field w-36" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
          <option value="">All Districts</option>
          {districts.map(d => <option key={d!} value={d!}>{d}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} requests</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <Wrench size={14} className="text-cyan-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">service requests</span>
        </div>

        {loading && (
          <div className="text-slate-500 text-xs text-center py-12">Loading…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">
            No service requests found.
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
                    <span className="text-sm font-medium text-white truncate">{r.request_type}</span>
                    {r.status && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${STATUS_COLORS[r.status] ?? 'text-slate-500 bg-white/[0.04]'}`}>
                        {r.status === 'in_progress' ? 'In Progress' : r.status}
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="text-xs text-slate-500 truncate">{r.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {r.requested_at && (
                    <div className="text-[11px] text-slate-600 font-mono">
                      {formatDateTime(r.requested_at)}
                    </div>
                  )}
                </div>
              </div>

              {expanded === r.id && (
                <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.04] space-y-2 animate-slide-up">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Request ID</div>
                      <div className="text-xs font-mono text-slate-300 truncate">{r.request_id}</div>
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
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Status</div>
                      <div className={`text-xs font-semibold ${r.status === 'closed' ? 'text-success' : r.status === 'in_progress' ? 'text-primary' : 'text-warning'}`}>
                        {r.status ?? '—'}
                      </div>
                    </div>
                  </div>
                  {r.closed_at && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <CheckCircle size={11} className="text-success" />
                      Closed {formatDateTime(r.closed_at)}
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