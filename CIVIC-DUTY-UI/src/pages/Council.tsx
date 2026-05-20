import { useState, useMemo, useEffect } from 'react';
import { ModuleBadge, StatusChip, DocumentList, EmptyState } from '../components/Shared';
import { Search, SlidersHorizontal, ChevronDown, ChevronRight, FileText, Clock } from 'lucide-react';
import { fetchCouncil, CouncilVote, AgendaItem } from '../api';
import { formatDate, timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

function AgendaPanel({ items }: { items: AgendaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="border-t border-white/[0.04] bg-background/40 px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3 flex items-center gap-1.5">
        <FileText size={10} />
        Agenda Items ({items.length})
      </p>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 text-xs">
            <span className="font-mono font-bold text-slate-500 shrink-0 w-8">{item.label}</span>
            <span className="text-slate-400 flex-1 leading-relaxed">{item.title}</span>
            {(item.ordinance || item.resolution) && (
              <span className="text-[10px] font-mono text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded shrink-0">
                {item.ordinance ?? item.resolution}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CouncilRow({ v, filterTag, setFilterTag }: {
  v: CouncilVote;
  filterTag: string;
  setFilterTag: (t: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAgenda = v.agendaItems.length > 0;

  return (
    <>
      <tr
        className={`group ${hasAgenda ? 'cursor-pointer' : ''}`}
        onClick={() => hasAgenda && setExpanded(e => !e)}
      >
        <td className="max-w-xs">
          <div className="text-[11px] text-slate-600 font-mono mb-1">{formatDate(v.date)}</div>
          <div className="font-medium text-slate-200 group-hover:text-primary transition-colors duration-200 leading-snug flex items-center gap-1.5">
            {hasAgenda && (
              expanded
                ? <ChevronDown size={12} className="text-slate-500 shrink-0" />
                : <ChevronRight size={12} className="text-slate-500 shrink-0" />
            )}
            {v.title}
          </div>
          {v.summary && <div className="text-xs text-slate-500 mt-1 truncate">{v.summary}</div>}
        </td>
        <td>
          <StatusChip status={v.status} />
        </td>
        <td>
          <div className="flex items-center gap-1.5 text-[13px] font-mono font-bold">
            <span className="text-success">{v.votes.yes}</span>
            <span className="text-slate-700">·</span>
            <span className="text-danger">{v.votes.no}</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">{v.votes.abstain}</span>
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">Y · N · A</div>
        </td>
        <td className="hidden md:table-cell">
          <div className="flex gap-1 flex-wrap">
            {v.tags.map(t => (
              <button
                key={t}
                onClick={e => { e.stopPropagation(); setFilterTag(t === filterTag ? '' : t); }}
                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                  t === filterTag
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:text-slate-300 hover:border-white/10'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </td>
        <td className="text-right" onClick={e => e.stopPropagation()}>
          <DocumentList docs={v.documents} />
        </td>
      </tr>
      {expanded && hasAgenda && (
        <tr>
          <td colSpan={5} className="p-0">
            <AgendaPanel items={v.agendaItems} />
          </td>
        </tr>
      )}
    </>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="p-4">
        <div className="skeleton skeleton-text w-20 mb-2" />
        <div className="skeleton skeleton-title" />
      </td>
      <td className="p-4"><div className="skeleton h-5 w-16 rounded-lg" /></td>
      <td className="p-4"><div className="skeleton h-5 w-20 rounded" /></td>
      <td className="hidden md:table-cell p-4"><div className="skeleton h-5 w-24 rounded" /></td>
      <td className="p-4"><div className="skeleton h-5 w-12 rounded ml-auto" /></td>
    </tr>
  );
}

export default function Council() {
  const { showError } = useToast();
  const [data, setData] = useState<CouncilVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchCouncil({ limit: '200' })
      .then(rows => {
        setData(rows);
        // Find the most recent scraped_at across all rows
        const latest = rows.reduce<string | null>((acc, r) => {
          const raw = (r as any).scraped_at ?? (r as any).date;
          if (!raw) return acc;
          if (!acc) return raw;
          return new Date(raw) > new Date(acc) ? raw : acc;
        }, null);
        setLastUpdated(latest);
      })
      .catch(e => {
        setError(e.message);
        showError(`Failed to load council votes: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [showError]);

  const filtered = useMemo(() => {
    return data.filter(v => {
      if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTag && !v.tags.includes(filterTag)) return false;
      return true;
    });
  }, [data, search, filterTag]);

  const allTags = useMemo(() => Array.from(new Set(data.flatMap(d => d.tags))), [data]);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex md:items-end justify-between flex-col md:flex-row gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="page-header">Council Votes</h1>
            <ModuleBadge module="council" />
          </div>
          <p className="text-slate-500 max-w-xl text-sm">Track resolutions and ordinances from the City-County Council.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search titles…"
              className="input-field pl-8 w-full md:w-56"
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select
              className="select-field pl-8 w-full md:w-44"
              onChange={e => setFilterTag(e.target.value)}
            >
              <option value="">All Tags</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-600 font-mono">
          {loading ? 'Loading…' : error ? `Error: ${error}` : `${filtered.length} of ${data.length} records`}
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-x-auto">
        {error && !loading ? (
          <EmptyState title="Failed to load" message="Could not fetch council events. Please try again later." />
        ) : filtered.length === 0 && !loading ? (
          <EmptyState title="No votes found" message="Try adjusting your search or tag filter." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date &amp; Title</th>
                <th>Status</th>
                <th>Votes</th>
                <th className="hidden md:table-cell">Tags</th>
                <th className="text-right">Docs</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : (
                filtered.map(v => (
                  <CouncilRow key={v.id} v={v} filterTag={filterTag} setFilterTag={setFilterTag} />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
