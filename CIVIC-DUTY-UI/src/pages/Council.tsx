import { useState, useMemo, useEffect, useRef } from 'react';
import { ModuleBadge, StatusChip, DocumentList, EmptyState, ErrorBanner } from '../components/Shared';
import { Search, SlidersHorizontal, ChevronDown, ChevronRight, FileText, Clock, ExternalLink } from 'lucide-react';
import { fetchCouncil, CouncilVote, AgendaItem } from '../api';
import { formatDate, latestTimestamp, timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

function AgendaPanel({ items, attachments }: { items: AgendaItem[]; attachments: CouncilVote['itemAttachments'] }) {
  const [expandedAttachments, setExpandedAttachments] = useState<Set<number>>(new Set());

  const toggleAttachment = (idx: number) => {
    setExpandedAttachments(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

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

      {attachments && attachments.length > 0 && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mt-4 mb-2 flex items-center gap-1.5">
            <FileText size={10} />
            Per-Item Documents ({attachments.length})
          </p>
          <div className="space-y-1.5">
            {attachments.map((att, idx) => (
              <div key={idx} className="text-xs">
                <div className="flex items-start gap-2">
                  <span className="font-mono font-bold text-slate-500 shrink-0 w-8">
                    {att.outlineNumber || '-'}
                  </span>
                  <span className="text-slate-400 flex-1 leading-relaxed">
                    {att.fileName}
                    {att.resolution && (
                      <span className="ml-2 text-[10px] font-mono text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded">
                        {att.resolution}
                      </span>
                    )}
                    {att.ordinance && (
                      <span className="ml-2 text-[10px] font-mono text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded">
                        {att.ordinance}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={att.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-primary hover:text-primary/70 transition-colors"
                      title="Open PDF"
                    >
                      <ExternalLink size={12} />
                    </a>
                    {att.pdfText && (
                      <button
                        onClick={e => { e.stopPropagation(); toggleAttachment(idx); }}
                        className="text-slate-500 hover:text-slate-300 transition-colors"
                        title={expandedAttachments.has(idx) ? 'Collapse text' : 'View text excerpt'}
                      >
                        {expandedAttachments.has(idx)
                          ? <ChevronDown size={12} />
                          : <ChevronRight size={12} />
                        }
                      </button>
                    )}
                  </div>
                </div>
                {expandedAttachments.has(idx) && att.pdfText && (
                  <div className="ml-10 mt-1 p-2 bg-white/[0.03] border border-white/[0.06] rounded text-[11px] text-slate-500 leading-relaxed max-h-32 overflow-y-auto">
                    {att.pdfText.slice(0, 1500)}
                    {att.pdfText.length > 1500 && (
                      <span className="text-slate-600 ml-1">... ({att.pdfText.length - 1500} more chars)</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
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
  const hasAttachments = v.itemAttachments && v.itemAttachments.length > 0;

  return (
    <>
      <tr
        className={`group ${hasAgenda || hasAttachments ? 'cursor-pointer' : ''}`}
        onClick={() => (hasAgenda || hasAttachments) && setExpanded(e => !e)}
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
      {expanded && (v.agendaItems.length > 0 || (v.itemAttachments && v.itemAttachments.length > 0)) && (
        <tr>
          <td colSpan={5} className="p-0">
            <AgendaPanel items={v.agendaItems} attachments={v.itemAttachments} />
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [sortKey, setSortKey] = useState<'date' | 'title' | 'yes' | 'no'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Fetch council votes whenever debouncedSearch changes
  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { limit: '200' };
    if (debouncedSearch) params.q = debouncedSearch;

    fetchCouncil(params)
      .then(rows => {
        setData(rows);
        // Find the most recent scraped_at across all rows
        const latest = latestTimestamp(rows, ['scraped_at', 'date']);
        setLastUpdated(latest);
      })
      .catch(e => {
        setError(e.message);
        showError(`Failed to load council votes: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, showError]);

  const filtered = useMemo(() => {
    return data.filter(v => {
      if (filterTag && !v.tags.includes(filterTag)) return false;
      return true;
    });
  }, [data, filterTag]);

  const allTags = useMemo(() => Array.from(new Set(data.flatMap(d => d.tags))), [data]);

  // Client-side sort applied on top of the (tag) filter.
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'title': return a.title.localeCompare(b.title) * dir;
        case 'yes': return (a.votes.yes - b.votes.yes) * dir;
        case 'no': return (a.votes.no - b.votes.no) * dir;
        case 'date':
        default: return (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) * dir;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const setPageSizeSafe = (n: number) => { setPageSize(n); setPage(0); };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'title' ? 'asc' : 'desc'); }
  };
  const sortIcon = (key: typeof sortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

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
          {loading ? 'Loading…' : error ? `Error: ${error}` : `${sorted.length} of ${data.length} records`}
        </div>
        {!loading && lastUpdated && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <Clock size={11} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      {/* Table */}
      {error && !loading && (
        <ErrorBanner message={`Failed to load data — ${error}`} />
      )}
      <div className="glass-card overflow-x-auto">
        {error && !loading ? (
          <EmptyState title="Load failed" message="Could not fetch council events. No records are shown while the source is unavailable." />
        ) : sorted.length === 0 && !loading ? (
          <EmptyState title="No votes found" message="Try adjusting your search or tag filter." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="cursor-pointer select-none hover:text-slate-300 transition-colors" onClick={() => toggleSort('date')}>Date &amp; Title{sortIcon('date')}</th>
                <th>Status</th>
                <th className="cursor-pointer select-none hover:text-slate-300 transition-colors" onClick={() => toggleSort('yes')}>Votes{sortIcon('yes')}</th>
                <th className="hidden md:table-cell">Tags</th>
                <th className="text-right">Docs</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : (
                paged.map(v => (
                  <CouncilRow key={v.id} v={v} filterTag={filterTag} setFilterTag={setFilterTag} />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      {!loading && !error && sorted.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">Page {safePage + 1} of {totalPages}</span>
            <span className="text-slate-700">·</span>
            <span className="font-mono">{sorted.length} shown</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-600 uppercase tracking-widest">Per page</label>
            <select
              className="select-field w-20"
              value={String(pageSize)}
              onChange={e => setPageSizeSafe(Number(e.target.value))}
            >
              {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button
              className="btn-secondary h-9 px-3 disabled:opacity-40"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              ‹ Prev
            </button>
            <button
              className="btn-secondary h-9 px-3 disabled:opacity-40"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
