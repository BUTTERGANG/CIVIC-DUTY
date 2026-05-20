import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ModuleBadge, EmptyState } from '../components/Shared';
import { Users, ChevronLeft, ChevronRight, Search, Clock } from 'lucide-react';
import { fetchCampaign, fetchCampaignCandidates, CampaignContribution } from '../api';
import { formatDate, timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

const COLORS = ['#3ea8ff', '#10d98a', '#f5a623', '#a78bfa', '#f04459'];
const PAGE_SIZE = 50;
const CURRENT_YEAR = new Date().getFullYear();
const CYCLES = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => String(CURRENT_YEAR - i));

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass px-3 py-2 rounded-xl border border-white/10 text-sm">
        <p className="text-slate-300 font-medium capitalize">{payload[0].name}</p>
        <p className="text-white font-bold font-mono">${payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export default function Campaign() {
  const { showError } = useToast();
  const [candidates, setCandidates] = useState<string[]>([]);
  const [candidate, setCandidate] = useState('');
  const [cycle, setCycle] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorNameInput, setDonorNameInput] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<CampaignContribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaignCandidates()
      .then(setCandidates)
      .catch(() => {})
      .finally(() => setLoadingCandidates(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    };
    if (candidate) params.candidate = candidate;
    if (cycle)     params.cycle = cycle;
    if (donorName) params.donor_name = donorName;

    fetchCampaign(params)
      .then(data => {
        setRows(data);
        const latest = data.reduce<string | null>((acc, r) => {
          const raw = (r as any).scraped_at ?? (r as any).filed_date;
          if (!raw) return acc;
          if (!acc) return raw;
          return new Date(raw) > new Date(acc) ? raw : acc;
        }, null);
        setLastUpdated(latest);
      })
      .catch(err => {
        console.error('[Campaign] fetch error:', err);
        showError(`Failed to load contributions: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [candidate, cycle, donorName, page, showError]);

  const resetPage = () => setPage(0);
  const handleCandidate = (v: string) => { setCandidate(v); resetPage(); };
  const handleCycle     = (v: string) => { setCycle(v);     resetPage(); };
  const commitDonor     = ()          => { setDonorName(donorNameInput); resetPage(); };

  const stats = useMemo(() => {
    const total = rows.reduce((acc, r) => acc + Number(r.amount), 0);
    const byType = rows.reduce((acc: Record<string, number>, r) => {
      const key = r.donor_type ?? 'Unknown';
      acc[key] = (acc[key] || 0) + Number(r.amount);
      return acc;
    }, {});
    const pieData = Object.entries(byType)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return { total, pieData };
  }, [rows]);

  const hasPrev = page > 0;
  const hasNext = rows.length === PAGE_SIZE;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex md:items-end justify-between flex-col md:flex-row gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="page-header">Campaign Finance</h1>
            <ModuleBadge module="campaign" />
          </div>
          <p className="text-slate-500 text-sm max-w-xl">
            Indiana FCPA contributions — filter by candidate and election cycle.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select
              className="select-field pl-8 w-full md:w-52"
              value={candidate}
              onChange={e => handleCandidate(e.target.value)}
              disabled={loadingCandidates}
            >
              <option value="">{loadingCandidates ? 'Loading…' : 'All Candidates'}</option>
              {candidates.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <select
            className="select-field w-28"
            value={cycle}
            onChange={e => handleCycle(e.target.value)}
          >
            <option value="">All Years</option>
            {CYCLES.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              className="input-field pl-8 w-full md:w-44"
              placeholder="Donor name…"
              value={donorNameInput}
              onChange={e => setDonorNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitDonor()}
              onBlur={commitDonor}
            />
          </div>
        </div>
      </div>

      {/* Freshness */}
      {!loading && lastUpdated && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <Clock size={11} />
          Updated {timeAgo(lastUpdated)}
        </div>
      )}

      {!loading && rows.length === 0 && !loadingCandidates ? (
        <EmptyState title="No contributions found" message="Try adjusting the candidate or year filter." />
      ) : (
        <>
          {/* Top Stats Row */}
          <div className="grid md:grid-cols-3 gap-5">
            <div className="glass-card p-6 flex flex-col justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                {candidate ? 'Total Raised' : 'Page Total'}
              </p>
              <div>
                <div className={`text-5xl font-display font-bold text-gradient-success leading-none ${loading ? 'opacity-30' : ''}`}>
                  ${stats.total.toLocaleString()}
                </div>
                {candidate && (
                  <p className="text-sm text-slate-500 mt-2">
                    by <span className="text-slate-300">{candidate}</span>
                    {cycle && <span> · {cycle}</span>}
                  </p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.05] text-xs text-slate-600">
                {loading ? '…' : `${rows.length} record${rows.length !== 1 ? 's' : ''} on this page`}
                {!candidate && <span className="ml-1 text-slate-700">— select a candidate to see totals</span>}
              </div>
            </div>

            <div className="glass-card p-6 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Donations by Type</p>
              {loading ? (
                <div className="h-40 flex items-center justify-center text-slate-600 text-sm">Loading…</div>
              ) : stats.pieData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-slate-600 text-sm">No data</div>
              ) : (
                <div className="flex items-center gap-6">
                  <div className="h-40 w-40 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.pieData} innerRadius={46} outerRadius={64} paddingAngle={4} dataKey="value" strokeWidth={0}>
                          {stats.pieData.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    {stats.pieData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between gap-4 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-sm text-slate-300 capitalize truncate">{entry.name}</span>
                        </div>
                        <span className="text-sm font-bold font-mono text-white shrink-0">
                          ${entry.value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transaction Table */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Transaction Ledger</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Page {page + 1}</span>
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={!hasPrev || loading}
                  className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasNext || loading}
                  className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {!candidate && <th>Candidate</th>}
                    <th>Donor</th>
                    <th>Type</th>
                    {!cycle && <th>Cycle</th>}
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center text-slate-600 py-8">Loading…</td></tr>
                  ) : rows.map(c => (
                    <tr key={c.id} className="group">
                      <td className="text-slate-600 font-mono text-xs">{formatDate(c.filed_date)}</td>
                      {!candidate && (
                        <td className="font-semibold text-slate-200 group-hover:text-primary transition-colors">
                          {c.candidate}
                        </td>
                      )}
                      <td className="text-slate-300">{c.donor_name ?? '—'}</td>
                      <td>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 bg-white/[0.03] border border-white/[0.06] px-2 py-0.5 rounded-md">
                          {c.donor_type ?? '—'}
                        </span>
                      </td>
                      {!cycle && (
                        <td className="text-slate-600 font-mono text-xs">{c.cycle ?? '—'}</td>
                      )}
                      <td className="text-right font-mono font-bold text-success">
                        +${Number(c.amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
