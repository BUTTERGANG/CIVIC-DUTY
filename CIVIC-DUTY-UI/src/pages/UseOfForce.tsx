import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge } from '../components/Shared';
import { fetchUseOfForce, UseOfForceReport } from '../api';
import { Clock, Search, Shield, AlertTriangle, User } from 'lucide-react';
import { formatDateTime, timeAgo, latestTimestamp } from '../lib/format';
import { useToast } from '../context/ToastContext';

export default function UseOfForce() {
  const { showError } = useToast();
  const [items, setItems] = useState<UseOfForceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterForceType, setFilterForceType] = useState('');
  const [filterIncidentType, setFilterIncidentType] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchUseOfForce({ city: 'indy' })
      .then(data => {
        setItems(data);
        setLastUpdated(latestTimestamp(data, ['scraped_at', 'occurred_at']));
      })
      .catch(err => {
        console.error('[UseOfForce] fetch error:', err);
        showError(`Failed to load use-of-force reports: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const forceTypes = useMemo(
    () => Array.from(new Set(items.map(r => r.force_type).filter(Boolean))).sort(),
    [items]
  );
  const incidentTypes = useMemo(
    () => Array.from(new Set(items.map(r => r.incident_type).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (filterForceType) result = result.filter(r => r.force_type === filterForceType);
    if (filterIncidentType) result = result.filter(r => r.incident_type === filterIncidentType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.force_type?.toLowerCase().includes(q)) ||
        (r.incident_type?.toLowerCase().includes(q)) ||
        (r.address?.toLowerCase().includes(q)) ||
        (r.district?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filterForceType, filterIncidentType, searchQuery]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="page-header">Use of Force</h1>
          <ModuleBadge module="useOfForce" />
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Indianapolis police use-of-force reports from IMPD data — force type, incident type, and officer experience.
        <span className="block text-slate-600 text-xs mt-1">Note: no address or coordinates published for these records.</span>
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search force type, incident, address…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-9 w-64"
          />
        </div>
        <select className="select-field w-44" value={filterForceType} onChange={e => setFilterForceType(e.target.value)}>
          <option value="">All Force Types</option>
          {forceTypes.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <select className="select-field w-44" value={filterIncidentType} onChange={e => setFilterIncidentType(e.target.value)}>
          <option value="">All Incident Types</option>
          {incidentTypes.map(t => <option key={t!} value={t!}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} reports</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <Shield size={14} className="text-pink-400" />
          <span className="text-sm font-display font-semibold text-white">
            {loading ? '…' : filtered.length}
          </span>
          <span className="text-xs text-slate-500">reports</span>
        </div>

        {loading && (
          <div className="text-slate-500 text-xs text-center py-12">Loading…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-slate-600 text-xs text-center py-12">
            No use-of-force reports found.
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
                    <span className="text-sm font-medium text-white truncate">{r.force_type ?? 'Use of Force'}</span>
                    {r.incident_type && (
                      <span className="text-[10px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded-md shrink-0">
                        {r.incident_type}
                      </span>
                    )}
                  </div>
                  {r.district && (
                    <p className="text-xs text-slate-500">District {r.district}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
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
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Report ID</div>
                      <div className="text-xs font-mono text-slate-300 truncate">{r.report_id}</div>
                    </div>
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
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Officer Experience</div>
                      <div className="text-xs text-slate-300">{r.officer_years_experience ?? '—'}</div>
                    </div>
                    <div className="glass-inset px-3 py-2">
                      <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Subject Injury</div>
                      <div className="text-xs text-slate-300">{r.subject_injury ?? '—'}</div>
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