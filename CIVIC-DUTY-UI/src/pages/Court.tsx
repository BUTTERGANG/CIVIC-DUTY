import { useState, useEffect, useMemo } from 'react';
import { ModuleBadge, StatusChip, EmptyState } from '../components/Shared';
import { Search, Clock, Scale, Loader, ChevronLeft, ChevronRight, Users, FileText } from 'lucide-react';
import { fetchCourt, lookupCourtCase, lookupCourtCasesByParty, CourtCase, PartyNameSearchResult } from '../api';
import { errorMessage, formatDate, formatDateTime, latestTimestamp, timeAgo } from '../lib/format';
import { useToast } from '../context/ToastContext';

const CASE_NUM_RE = /^\d{2}[A-Z]\d{2}-\d{4}-[A-Z]{1,3}-\d+$/i;
const PAGE_SIZE = 25;

type SearchMode = 'case' | 'party';

function CaseCard({ c }: { c: CourtCase }) {
  const parties: { name: string; role: string }[] = Array.isArray(c.parties) ? c.parties : [];
  return (
    <div className="glass-card p-5 hover:bg-white/[0.02] transition-all">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="flex-1 space-y-3">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-mono text-primary text-sm font-bold tracking-wider">{c.case_number}</span>
            {c.status && <StatusChip status={c.status} />}
            {c.case_type && (
              <span className="text-[10px] uppercase tracking-widest font-bold font-display text-slate-500 bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-md">
                {c.case_type}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-100 leading-snug">{c.title ?? c.case_number}</h3>
          <div className="flex flex-wrap gap-2">
            {c.judge && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white/[0.02] px-2.5 py-1.5 rounded-lg border border-white/[0.05]">
                <Scale size={12} className="text-slate-600" />
                {c.judge}
              </div>
            )}
            {c.filed_date && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white/[0.02] px-2.5 py-1.5 rounded-lg border border-white/[0.05]">
                <Clock size={12} className="text-slate-600" />
                Filed {formatDate(c.filed_date)}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2.5 border-t lg:border-t-0 border-white/[0.05] pt-4 lg:pt-0 shrink-0">
          {parties.length > 0 && (
            <div className="space-y-1.5">
              {parties.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-slate-300 font-medium">{p.name}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-600 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded font-mono w-24 text-center">
                    {p.role}
                  </span>
                </div>
              ))}
            </div>
          )}
          {c.next_hearing && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/8 border border-warning/25 px-3 py-1.5 rounded-xl mt-1">
              <Clock size={12} />
              Hearing: {formatDateTime(c.next_hearing)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Court() {
  const { showError } = useToast();
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Search / lookup state
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('case');
  const [lookupResult, setLookupResult] = useState<{ source: string; case: CourtCase } | null>(null);
  const [partyResults, setPartyResults] = useState<PartyNameSearchResult | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [looking, setLooking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    setLoadingCases(true);
    fetchCourt({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
      .then(resp => {
        const data = Array.isArray(resp) ? resp : resp.rows;
        const total = Array.isArray(resp) ? data.length : (resp.total ?? data.length);
        setCases(data);
        setTotalCount(total);
        const latest = latestTimestamp(data, ['scraped_at', 'filed_date']);
        setLastUpdated(latest);
      })
      .catch(err => showError(`Failed to load court cases: ${errorMessage(err)}`))
      .finally(() => setLoadingCases(false));
  }, [page, showError]);

  // Client-side filter over cached cases
  const filtered = useMemo(() => {
    const qs = query.toLowerCase().trim();
    if (!qs) return cases;
    return cases.filter(c =>
      c.case_number.toLowerCase().includes(qs) ||
      (c.title ?? '').toLowerCase().includes(qs) ||
      (Array.isArray(c.parties) ? c.parties : []).some(p => p.name.toLowerCase().includes(qs))
    );
  }, [cases, query]);

  const handleLookup = async () => {
    const q = query.trim();
    if (!q) return;
    setLookupError('');
    setLookupResult(null);
    setPartyResults(null);
    setLooking(true);
    try {
      if (searchMode === 'case') {
        const result = await lookupCourtCase(q);
        setLookupResult(result);
        setCases(prev => prev.some(c => c.case_number === result.case.case_number)
          ? prev
          : [result.case, ...prev]);
      } else {
        const result = await lookupCourtCasesByParty(q);
        setPartyResults(result);
        // Add unique new cases to the cached list
        setCases(prev => {
          const existing = new Set(prev.map(c => c.case_number));
          const newCases = result.cases.filter(c => !existing.has(c.case_number));
          return newCases.length > 0 ? [...newCases, ...prev] : prev;
        });
      }
    } catch (err) {
      setLookupError(errorMessage(err));
      showError(errorMessage(err));
    } finally {
      setLooking(false);
    }
  };

  const isLookupQuery = searchMode === 'case'
    ? CASE_NUM_RE.test(query.trim())
    : query.trim().length >= 2;

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasNext = page + 1 < totalPages;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex md:items-end justify-between flex-col md:flex-row gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="page-header">Court Dockets</h1>
            <ModuleBadge module="court" />
          </div>
          <p className="text-slate-500 text-sm max-w-xl">
            Search cached Hamilton County cases, or look up any Indiana case or party live from MyCase.
          </p>
        </div>

        {/* Search + Lookup */}
        <div className="flex flex-col gap-2">
          {/* Search mode tabs */}
          <div className="flex bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06] self-end">
            <button
              onClick={() => { setSearchMode('case'); setLookupResult(null); setPartyResults(null); setLookupError(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                searchMode === 'case'
                  ? 'bg-primary/20 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <FileText size={12} />
              Case Number
            </button>
            <button
              onClick={() => { setSearchMode('party'); setLookupResult(null); setPartyResults(null); setLookupError(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                searchMode === 'party'
                  ? 'bg-primary/20 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Users size={12} />
              Party Name
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder={searchMode === 'case' ? "Case number…" : "Name (last, first or business)…"}
                className="input-field pl-8 w-full md:w-80"
                value={query}
                onChange={e => { setQuery(e.target.value); setLookupResult(null); setPartyResults(null); setLookupError(''); }}
                onKeyDown={e => e.key === 'Enter' && isLookupQuery && handleLookup()}
              />
            </div>
            {isLookupQuery && (
              <button
                onClick={handleLookup}
                disabled={looking}
                className="btn-primary px-4 shrink-0 disabled:opacity-50 flex items-center gap-2"
              >
                {looking ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
                {looking ? 'Searching…' : 'Search'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lookup result banner (case number) */}
      {lookupResult && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-primary flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          {lookupResult.source === 'cache' ? 'Returned from cache' : 'Fetched live from MyCase and cached'}
        </div>
      )}

      {/* Party search results banner */}
      {partyResults && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-primary flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          Found {partyResults.cases.length} case{partyResults.cases.length !== 1 ? 's' : ''}
          {partyResults.hasMore ? ' (more available — narrow your search)' : ''}
          {' — fetched live from MyCase and cached'}
        </div>
      )}

      {lookupError && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-xs text-danger">
          {lookupError}
        </div>
      )}

      {/* Lookup hint */}
      {isLookupQuery && !lookupResult && !partyResults && !lookupError && !looking && (
        <p className="text-xs text-slate-600">
          {searchMode === 'case'
            ? 'Looks like a case number — press Enter or click "Search" to fetch it from MyCase.'
            : 'Enter a party name (last name, first name, or business name) to search MyCase.'}
        </p>
      )}

      {/* Party search results inline list */}
      {partyResults && partyResults.cases.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Party Name Results</h2>
          {partyResults.cases.map((c) => (
            <CaseCard key={c.case_number} c={c} />
          ))}
          {partyResults.hasMore && (
            <div className="text-center py-3">
              <p className="text-xs text-slate-600">Refine your search for more specific results</p>
            </div>
          )}
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-600 font-mono">
          {loadingCases ? '…' : `${filtered.length} case${filtered.length !== 1 ? 's' : ''}`}
        </div>
        <div className="flex items-center gap-3">
          {!loadingCases && lastUpdated && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <Clock size={11} />
              Updated {timeAgo(lastUpdated)}
            </div>
          )}
          {/* Pagination */}
          {!partyResults && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loadingCases}
                className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-slate-600">Page {page + 1}</span>
              <span className="text-[10px] text-slate-600 font-mono">{page + 1}/{totalPages}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasNext || loadingCases}
                className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {loadingCases ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-5">
              <div className="skeleton skeleton-text w-32 mb-2" />
              <div className="skeleton skeleton-title mb-3" />
              <div className="flex gap-2">
                <div className="skeleton h-5 w-24 rounded-lg" />
                <div className="skeleton h-5 w-20 rounded-lg" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 && cases.length === 0 ? (
          <EmptyState
            title="No cases cached yet"
            message="Use the search above to look up a case by number or party name on MyCase."
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" message="Try a different name or case number." />
        ) : (
          filtered.map(c => <CaseCard key={c.id ?? c.case_number} c={c} />)
        )}
      </div>
    </div>
  );
}