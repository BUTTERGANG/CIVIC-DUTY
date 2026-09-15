import { useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { ModuleBadge, AlertCard, ErrorBanner } from '../components/Shared';
import { ArrowRight, TrendingUp } from 'lucide-react';
import {
  fetchDashboardSummary, fetchCouncil, fetchBids,
  CouncilVote, Bid, DashboardSummary,
} from '../api';
import { useAlerts } from '../context/AlertsContext';
import { useCity } from '../context/CityContext';
import { formatDate } from '../lib/format';

// Decorative sparklines — deterministic sine waves
const SPARKLINES = [
  Array.from({ length: 12 }, (_, i) => ({ val: 30 + Math.sin(i * 0.7) * 20 })),
  Array.from({ length: 12 }, (_, i) => ({ val: 50 + Math.cos(i * 0.5) * 25 })),
  Array.from({ length: 12 }, (_, i) => ({ val: 40 + Math.sin(i * 0.9 + 1) * 18 })),
  Array.from({ length: 12 }, (_, i) => ({ val: 60 + Math.cos(i * 0.6 + 2) * 20 })),
  Array.from({ length: 12 }, (_, i) => ({ val: 35 + Math.sin(i * 0.8 + 3) * 22 })),
  Array.from({ length: 12 }, (_, i) => ({ val: 45 + Math.cos(i * 0.4 + 1) * 15 })),
  Array.from({ length: 12 }, (_, i) => ({ val: 55 + Math.sin(i * 0.3 + 2) * 20 })),
  Array.from({ length: 12 }, (_, i) => ({ val: 38 + Math.cos(i * 0.7 + 3) * 18 })),
  Array.from({ length: 12 }, (_, i) => ({ val: 42 + Math.sin(i * 0.5 + 4) * 24 })),
  Array.from({ length: 12 }, (_, i) => ({ val: 48 + Math.cos(i * 0.6 + 5) * 16 })),
];

const FISHERS_STAT_META = [
  { key: 'council',  label: 'Council Votes',     color: '#10d98a', link: '/council',  bg: 'from-emerald-500/[0.08] to-transparent', border: 'hover:border-emerald-500/30' },
  { key: 'bids',     label: 'Active Bids',        color: '#818cf8', link: '/bids',     bg: 'from-indigo-500/[0.08] to-transparent',  border: 'hover:border-indigo-500/30' },
  { key: 'zoning',   label: 'Zoning Cases',       color: '#f5a623', link: '/zoning',   bg: 'from-amber-500/[0.08] to-transparent',   border: 'hover:border-amber-500/30' },
  { key: 'campaign', label: 'Campaign Filings',   color: '#a78bfa', link: '/campaign', bg: 'from-violet-500/[0.08] to-transparent',  border: 'hover:border-violet-500/30' },
  { key: 'court',    label: 'Court Cases',        color: '#f04459', link: '/court',    bg: 'from-rose-500/[0.08] to-transparent',    border: 'hover:border-rose-500/30' },
  { key: 'parcels',  label: 'Parcels',            color: '#10b981', link: '/parcels',  bg: 'from-emerald-500/[0.08] to-transparent', border: 'hover:border-emerald-500/30' },
  { key: 'buildings',label: 'Buildings',          color: '#06b6d4', link: '/buildings',bg: 'from-cyan-500/[0.08] to-transparent',    border: 'hover:border-cyan-500/30' },
  { key: 'schools',  label: 'Schools',            color: '#8b5cf6', link: '/schools',  bg: 'from-violet-500/[0.08] to-transparent',  border: 'hover:border-violet-500/30' },
  { key: 'parks',    label: 'Parks',              color: '#22c55e', link: '/parks',    bg: 'from-green-500/[0.08] to-transparent',   border: 'hover:border-green-500/30' },
  { key: 'polling',  label: 'Polling Locations',  color: '#f97316', link: '/polling',  bg: 'from-orange-500/[0.08] to-transparent',  border: 'hover:border-orange-500/30' },
  { key: 'tax_districts', label: 'Tax Districts', color: '#f43f5e', link: '/tax-districts', bg: 'from-rose-500/[0.08] to-transparent', border: 'hover:border-rose-500/30' },
] as const;

const INDY_STAT_META = [
  { key: 'council',        label: 'Council Votes',      color: '#10d98a', link: '/council',  bg: 'from-emerald-500/[0.08] to-transparent', border: 'hover:border-emerald-500/30' },
  { key: 'incidents',      label: 'Incidents',          color: '#f97316', link: '/incidents',  bg: 'from-orange-500/[0.08] to-transparent',  border: 'hover:border-orange-500/30' },
  { key: 'crashes',        label: 'Traffic Crashes',    color: '#ef4444', link: '/crashes',  bg: 'from-red-500/[0.08] to-transparent',    border: 'hover:border-red-500/30' },
  { key: 'citations',      label: 'Citations',          color: '#eab308', link: '/citations',  bg: 'from-yellow-500/[0.08] to-transparent',  border: 'hover:border-yellow-500/30' },
  { key: 'useOfForce',     label: 'Use of Force',       color: '#ec4899', link: '/use-of-force',  bg: 'from-pink-500/[0.08] to-transparent',   border: 'hover:border-pink-500/30' },
  { key: 'serviceRequests', label: '311 Requests',      color: '#06b6d4', link: '/service-requests',  bg: 'from-cyan-500/[0.08] to-transparent',   border: 'hover:border-cyan-500/30' },
] as const;

export default function Dashboard() {
  const { selectedCity } = useCity();
  const { alerts, unreadCount, markRead } = useAlerts();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentCouncil, setRecentCouncil] = useState<CouncilVote[]>([]);
  const [recentBids, setRecentBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isIndy = selectedCity === 'indy';
  const statMeta = isIndy ? INDY_STAT_META : FISHERS_STAT_META;
  const counts = summary?.counts ?? {
    council: 0, bids: 0, zoning: 0, campaign: 0, court: 0,
    incidents: 0, crashes: 0, citations: 0, useOfForce: 0, serviceRequests: 0,
    parcels: 0, buildings: 0, schools: 0, parks: 0, polling: 0, tax_districts: 0,
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    // Surface fetch failures via the banner instead of swallowing them,
    // so 'load failed' is never mistaken for 'no data'.
    Promise.allSettled([
      fetchDashboardSummary(selectedCity).then(setSummary),
      fetchCouncil({ limit: '2', offset: '0' }).then(setRecentCouncil),
      fetchBids({ limit: '3', offset: '0' }).then(setRecentBids),
    ]).then(results => {
      if (!active) return;
      if (results.some(r => r.status === 'rejected')) {
        setLoadError('Failed to load dashboard data — try again');
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [selectedCity]);
  const recentAlerts = alerts.slice(0, 3);

  return (
    <div className="space-y-10 animate-slide-up">

      {/* Hero */}
      <div className="relative">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest mb-5 bg-primary/8 border border-primary/20 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live Civic Intelligence Feed
          </div>
          <div className="flex items-center gap-3 mb-5">
            <h1 className="text-5xl sm:text-6xl font-bold font-display leading-[1.05]">
              <span className="text-gradient">Command</span>
              <br />
              <span className="text-white">Center</span>
            </h1>
          </div>
          <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
            {isIndy
              ? `Real-time monitoring of Indianapolis civic activity — council votes, public safety incidents, traffic crashes, citations, use of force, and 311 service requests.`
              : `Real-time monitoring of Fishers civic activity — council votes, procurement bids, zoning changes, campaign finance, court filings, parcels, buildings, schools, parks, polling locations, and tax districts.`}
          </p>
        </div>
      </div>

      {/* Fetch error banner (distinct from empty state) */}
      {loadError && (
        <ErrorBanner message={loadError} onRetry={() => {
          // Re-trigger the fetch effect by cycling selectedCity through a no-op
          setLoading(true); setLoadError(null);
          Promise.allSettled([
            fetchDashboardSummary(selectedCity).then(setSummary),
            fetchCouncil({ limit: '2', offset: '0' }).then(setRecentCouncil),
            fetchBids({ limit: '3', offset: '0' }).then(setRecentBids),
          ]).then(results => {
            if (results.some(r => r.status === 'rejected')) setLoadError('Failed to load dashboard data — try again');
            setLoading(false);
          });
        }} />
      )}

      {/* Stat Cards */}
      <div className={`grid gap-4 ${isIndy ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'}`}>
        {statMeta.map((c, i) => (
          <Link
            key={c.key}
            to={c.link}
            className={`glass-card stat-card bg-gradient-to-b ${c.bg} border border-white/[0.06] ${c.border} group cursor-pointer`}
          >
            <div className="relative z-10 mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">{c.label}</p>
              <p className="text-4xl font-display font-bold transition-transform duration-300 group-hover:scale-105 origin-left" style={{ color: c.color }}>
                {counts[c.key as keyof typeof counts] ?? 0}
              </p>
            </div>
            {/* Sparkline */}
            <div className="absolute bottom-0 left-0 right-0 h-14 opacity-50 group-hover:opacity-90 transition-opacity duration-500 pointer-events-none" aria-hidden="true">
              <ResponsiveContainer width="100%" height={56}>
                <AreaChart data={SPARKLINES[i]} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.color} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="val" stroke={c.color} fill={`url(#sg${i})`} strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Feed + Alerts */}
      <div className="grid lg:grid-cols-5 gap-8">

        {/* Aggregated Feed */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Aggregated Feed</h2>
            <Link to="/council" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors font-medium">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="glass-card divide-y divide-white/[0.04]">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-5">
                  <div className="skeleton skeleton-text w-24 mb-2.5" />
                  <div className="skeleton skeleton-title mb-2" />
                  <div className="skeleton h-3 w-32 rounded" />
                </div>
              ))
            ) : (
              <>
                {recentBids.map(b => (
                  <div key={b.id} className="p-5 hover:bg-white/[0.02] transition-colors group cursor-pointer">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <ModuleBadge module="bids" />
                      {b.posted_date && <span className="text-[11px] text-slate-600 font-mono">{formatDate(b.posted_date)}</span>}
                    </div>
                    <p className="font-semibold text-slate-200 leading-snug group-hover:text-primary transition-colors duration-200">{b.title}</p>
                    {b.agency && (
                      <div className="text-sm text-slate-500 mt-1.5 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 shrink-0" />
                        {b.agency}
                      </div>
                    )}
                  </div>
                ))}
                {recentCouncil.map(c => (
                  <div key={c.id} className="p-5 hover:bg-white/[0.02] transition-colors group cursor-pointer">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <ModuleBadge module="council" />
                      <span className="text-[11px] text-slate-600 font-mono">{formatDate(c.date)}</span>
                    </div>
                    <p className="font-semibold text-slate-200 leading-snug group-hover:text-primary transition-colors duration-200">{c.title}</p>
                    {c.summary && <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{c.summary}</p>}
                  </div>
                ))}
                {recentBids.length === 0 && recentCouncil.length === 0 && !loadError && (
                  <div className="p-8 text-center text-slate-600 text-sm">No recent items — run the scrapers to populate data.</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Priority Alerts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Priority Alerts</h2>
            <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              {unreadCount} Unread
            </div>
          </div>
          <div className="space-y-3">
            {recentAlerts.map(a => (
              <AlertCard key={a.id} alert={a} onRead={markRead} />
            ))}
            {recentAlerts.length === 0 && (
              <div className="text-sm text-slate-600 text-center py-4">No alerts yet.</div>
            )}
            <Link to="/alerts" className="btn-secondary w-full mt-1 justify-center">
              <TrendingUp size={15} /> View All Alerts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
