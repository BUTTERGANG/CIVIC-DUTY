import { NavLink, useLocation } from 'react-router-dom';
import { Bell, FileText, Search, Activity, Landmark, Gavel, FileCheck, Map, TrendingUp, LogOut, Menu, X, ChevronDown, Home, Building2, GraduationCap, Trees, Vote, Landmark as TaxIcon, Shield, Car, FileText as CitationIcon, AlertTriangle, Wrench, Phone, AlertTriangle as VzIcon, Church, Baby, User, DollarSign, Scale, Sun, Moon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useState, useEffect, useRef } from 'react';
import { useCity } from '../context/CityContext';
import { getTheme, setTheme, type Theme } from '../lib/theme';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ── Module Badge ── */
export const ModuleBadge = ({ module }: { module: string }) => {
  const colors: Record<string, string> = {
    council:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    bids:      'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
    zoning:    'bg-amber-500/10 text-amber-400 border-amber-500/25',
    campaign:  'bg-violet-500/10 text-violet-400 border-violet-500/25',
    court:     'bg-rose-500/10 text-rose-400 border-rose-500/25',
    incidents: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
    crashes:   'bg-red-500/10 text-red-400 border-red-500/25',
    citations: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
    useOfForce: 'bg-pink-500/10 text-pink-400 border-pink-500/25',
    serviceRequests: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
    parcels:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    buildings: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
    schools:   'bg-violet-500/10 text-violet-400 border-violet-500/25',
    parks:     'bg-green-500/10 text-green-400 border-green-500/25',
    polling:   'bg-orange-500/10 text-orange-400 border-orange-500/25',
    tax_districts: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  };
  const dots: Record<string, string> = {
    council:   'bg-emerald-400',
    bids:      'bg-indigo-400',
    zoning:    'bg-amber-400',
    campaign:  'bg-violet-400',
    court:     'bg-rose-400',
    incidents: 'bg-orange-400',
    crashes:   'bg-red-400',
    citations: 'bg-yellow-400',
    useOfForce: 'bg-pink-400',
    serviceRequests: 'bg-cyan-400',
    parcels:   'bg-emerald-400',
    buildings: 'bg-cyan-400',
    schools:   'bg-violet-400',
    parks:     'bg-green-400',
    polling:   'bg-orange-400',
    tax_districts: 'bg-rose-400',
  };
  return (
    <span className={cn('badge flex items-center gap-1.5', colors[module] || 'bg-slate-500/10 text-slate-400 border-slate-600/25')}>
      <span className={cn('w-1.5 h-1.5 rounded-full', dots[module] || 'bg-slate-400')} />
      {module}
    </span>
  );
};

/* ── Status Chip ── */
export const StatusChip = ({ status }: { status: string }) => {
  let color = 'bg-slate-500/10 text-slate-400 border-slate-600/25';
  const ls = status.toLowerCase();

  if (['passed', 'awarded', 'approved', 'active'].includes(ls)) {
    color = 'bg-success/10 text-success border-success/25';
  } else if (['pending', 'filed', 'scheduled', 'open'].includes(ls)) {
    color = 'bg-warning/10 text-warning border-warning/25';
  } else if (['failed', 'denied', 'closed', 'appealed', 'tabled'].includes(ls)) {
    color = 'bg-danger/10 text-danger border-danger/25';
  }

  return (
    <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-display font-bold uppercase tracking-widest border', color)}>
      {status}
    </span>
  );
};

/* ── Document List ── */
export const DocumentList = ({ docs }: { docs: { label: string; url: string }[] }) => {
  if (!docs || docs.length === 0)
    return <span className="text-slate-600 text-xs italic">—</span>;
  return (
    <div className="flex gap-1.5 flex-wrap justify-end">
      {docs.map((d, i) => (
        <a
          key={i}
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs bg-primary/5 hover:bg-primary/15 hover:text-white px-2.5 py-1.5 rounded-lg text-primary transition-all duration-200 border border-primary/15 hover:border-primary/40 active:scale-95"
        >
          <FileText size={12} className="shrink-0" />
          {d.label}
        </a>
      ))}
    </div>
  );
};

/* ── Empty State ── */
export const EmptyState = ({ title, message }: { title: string; message: string }) => (
  <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
    <div className="relative w-20 h-20 mb-6">
      <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl animate-pulse-slow" />
      <div className="relative w-20 h-20 rounded-2xl bg-surfaceHighlight border border-white/[0.07] flex items-center justify-center shadow-card">
        <Search size={28} className="text-primary/70" />
      </div>
    </div>
    <h3 className="text-xl font-display font-semibold text-white mb-2">{title}</h3>
    <p className="text-slate-500 max-w-xs leading-relaxed text-sm">{message}</p>
  </div>
);

/* ── Fetch Error Banner ──
   Rendered when a data fetch rejects, so users can always tell
   'load failed' apart from the empty-data EmptyState. */
export const ErrorBanner = ({
  message = 'Failed to load data — try again',
  onRetry,
}: { message?: string; onRetry?: () => void }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-danger/30 bg-danger/10 text-danger-200">
    <AlertTriangle size={16} className="shrink-0 text-danger" />
    <span className="text-sm font-medium flex-1">{message}</span>
    {onRetry && (
      <button
        onClick={onRetry}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-danger/25 hover:bg-danger/40 border border-danger/40 transition-all duration-200 animate-pulse"
      >
        Retry
      </button>
    )}
  </div>
);

/* ── Alert Card ── */
export interface AlertCardItem {
  id: string;
  module: string;
  summary: string;
  created_at: string;
  read: boolean;
}

export const AlertCard = ({ alert, onRead }: { alert: AlertCardItem; onRead?: (id: string) => void }) => (
  <div
    onClick={() => !alert.read && onRead?.(alert.id)}
    className={cn(
      'p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 group',
      !alert.read && onRead ? 'cursor-pointer' : '',
      alert.read
        ? 'bg-surfaceHighlight/30 border-white/[0.05] hover:border-white/[0.08]'
        : 'bg-primary/5 border-primary/30 shadow-[0_8px_32px_rgba(62,168,255,0.12)]'
    )}
  >
    <div className="flex justify-between items-start mb-3">
      <ModuleBadge module={alert.module} />
      <span className="text-[11px] text-slate-600 font-mono tracking-wide">
        {new Date(alert.created_at).toLocaleString()}
      </span>
    </div>
    <p className={cn('text-sm leading-relaxed', alert.read ? 'text-slate-400' : 'text-slate-200 font-medium')}>
      {alert.summary}
    </p>
    <div className="mt-4 flex items-center justify-end text-xs pt-3 border-t border-white/[0.05]">
      {!alert.read && (
        <div className="flex items-center gap-1.5 text-primary text-[11px] font-bold uppercase tracking-wider">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-glow-primary" />
          {onRead ? 'Click to dismiss' : 'Live'}
        </div>
      )}
    </div>
  </div>
);

/* ── City Selector ── */
export const CitySelector = () => {
  const { selectedCity, setSelectedCity, cities, currentCity } = useCity();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 border',
          open
            ? 'text-white bg-white/[0.07] border-white/[0.12]'
            : 'text-slate-400 hover:text-slate-200 bg-transparent border-transparent hover:bg-white/[0.04] hover:border-white/[0.08]'
        )}
      >
        <span className="text-base leading-none">{currentCity?.icon ?? '📍'}</span>
        <span className="hidden sm:inline">{currentCity?.displayName ?? selectedCity}</span>
        <ChevronDown size={14} className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-surface/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl z-[100] overflow-hidden animate-slide-up">
          <div className="p-2">
            {cities.map(city => (
              <button
                key={city.id}
                onClick={() => { setSelectedCity(city.id); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                  city.id === selectedCity
                    ? 'text-white bg-primary/10 border border-primary/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                )}
              >
                <span className="text-lg leading-none">{city.icon}</span>
                <div className="text-left">
                  <div className="font-medium">{city.displayName}</div>
                  <div className="text-[10px] text-slate-600">{city.modules.length} modules</div>
                </div>
                {city.id === selectedCity && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
            {cities.length === 0 && (
              <div className="px-3 py-4 text-center text-slate-600 text-xs">Loading cities…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── NavBar ── */
export const NavBar = ({ unreadCount, user, onLogout }: {
  unreadCount: number;
  user?: { email: string; display_name: string | null } | null;
  onLogout?: () => void;
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const moreRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(setTheme(next));
  };

  // Close mobile nav + More menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  // Close More dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Most-used modules stay top-level; the long-tail GIS/admin modules
  // are folded under a 'More ▾' dropdown to de-clutter the primary rail.
  const primaryLinks = [
    { to: '/', icon: <Activity size={16} />, label: 'Dashboard' },
    { to: '/zoning', icon: <Map size={16} />, label: 'Zoning' },
    { to: '/council', icon: <Landmark size={16} />, label: 'Council' },
    { to: '/bids', icon: <FileCheck size={16} />, label: 'Bids' },
  ];
  const moreLinks = [
    { to: '/campaign', icon: <TrendingUp size={16} />, label: 'Campaign' },
    { to: '/court', icon: <Gavel size={16} />, label: 'Court' },
    { to: '/parcels', icon: <Home size={16} />, label: 'Parcels' },
    { to: '/buildings', icon: <Building2 size={16} />, label: 'Buildings' },
    { to: '/schools', icon: <GraduationCap size={16} />, label: 'Schools' },
    { to: '/parks', icon: <Trees size={16} />, label: 'Parks' },
    { to: '/polling', icon: <Vote size={16} />, label: 'Polling' },
    { to: '/tax-districts', icon: <TaxIcon size={16} />, label: 'Tax Districts' },
    { to: '/incidents', icon: <Shield size={16} />, label: 'Incidents' },
    { to: '/crashes', icon: <Car size={16} />, label: 'Crashes' },
    { to: '/citations', icon: <CitationIcon size={16} />, label: 'Citations' },
    { to: '/use-of-force', icon: <AlertTriangle size={16} />, label: 'Use of Force' },
    { to: '/service-requests', icon: <Wrench size={16} />, label: '311 Requests' },
    { to: '/cfs', icon: <Phone size={16} />, label: 'CFS' },
    { to: '/visionzero', icon: <VzIcon size={16} />, label: 'VisionZero' },
    { to: '/historic-sites', icon: <Building2 size={16} />, label: 'Historic Sites' },
    { to: '/daycares', icon: <Baby size={16} />, label: 'Daycares' },
    { to: '/places-of-worship', icon: <Church size={16} />, label: 'Worship' },
    { to: '/parcel-owners', icon: <User size={16} />, label: 'Parcel Owners' },
    { to: '/property-assessments', icon: <DollarSign size={16} />, label: 'Assessments' },
    { to: '/zoning-variances', icon: <Scale size={16} />, label: 'Zoning Variances' },
  ];
  const links = [...primaryLinks, ...moreLinks];

  return (
    <>
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-white/[0.05] shadow-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[62px] flex items-center justify-between gap-4">

          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center font-display font-bold text-white text-base shadow-glow-primary/50 group-hover:shadow-glow-primary transition-shadow">
              C
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white hidden sm:block">
              Civic<span className="text-primary">Duty</span>
            </span>
          </NavLink>

          {/* City Selector */}
          <CitySelector />

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-0.5 overflow-x-auto no-scrollbar mask-edges">
            {primaryLinks.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap relative group',
                    isActive
                      ? 'text-white bg-white/[0.07] border border-white/[0.08]'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('transition-colors', isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300')}>
                      {l.icon}
                    </span>
                    <span className="hidden lg:inline">{l.label}</span>
                    {isActive && (
                      <span className="absolute -bottom-[1px] left-3 right-3 h-[2px] rounded-t-full bg-gradient-to-r from-primary to-accent" />
                    )}
                  </>
                )}
              </NavLink>
            ))}

            {/* More dropdown */}
            <div ref={moreRef} className="relative">
              <button
                onClick={() => setMoreOpen(o => !o)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap border group',
                  moreOpen
                    ? 'text-white bg-white/[0.07] border-white/[0.08]'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] border-transparent'
                )}
              >
                <span className={cn('transition-colors', moreOpen ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300')}><Menu size={16} /></span>
                <span className="hidden lg:inline">More</span>
                <ChevronDown size={13} className={cn('transition-transform duration-200', moreOpen && 'rotate-180')} />
              </button>

              {moreOpen && (
                <div className="absolute top-full right-0 mt-2 w-60 bg-surface/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl z-[100] overflow-hidden animate-slide-up">
                  <div className="p-2 grid grid-cols-1">
                    {moreLinks.map(l => (
                      <NavLink
                        key={l.to}
                        to={l.to}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                            isActive
                              ? 'text-white bg-primary/10 border border-primary/25'
                              : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
                          )
                        }
                      >
                        {l.icon}
                        {l.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User + Logout (desktop) */}
            {user && onLogout && (
              <div className="hidden md:flex items-center gap-2">
                <span className="hidden lg:block text-xs text-slate-500 truncate max-w-[120px]">
                  {user.display_name ?? user.email}
                </span>
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all duration-200"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}

            {/* Theme toggle (desktop + mobile) */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all duration-200 shrink-0"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Alerts Bell */}
            <NavLink
              to="/alerts"
              className={({ isActive }) =>
                cn(
                  'relative p-2.5 rounded-xl transition-all duration-200 active:scale-95 shrink-0 border',
                  isActive
                    ? 'text-primary bg-primary/10 border-primary/25'
                    : 'text-slate-500 hover:text-white bg-transparent hover:bg-white/[0.05] border-transparent hover:border-white/[0.08]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Bell size={18} className={cn(isActive && 'animate-pulse-slow')} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-[20px] bg-gradient-to-br from-danger to-red-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-glow-danger px-1 border border-background font-mono">
                      {unreadCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Nav Overlay */}
      {mobileOpen && (
        <div
          className="mobile-nav-overlay open fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className={cn(
        'mobile-nav-menu open fixed top-[62px] right-0 z-50 w-64 bg-surface/95 backdrop-blur-2xl border-l border-b border-white/[0.06] rounded-bl-2xl shadow-2xl flex-col p-4 gap-1 animate-slide-in-right'
      )}>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'text-white bg-white/[0.07] border border-white/[0.08]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              )
            }
          >
            {l.icon}
            {l.label}
          </NavLink>
        ))}
        {user && onLogout && (
          <div className="pt-3 mt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-slate-500 truncate max-w-[140px]">
              {user.display_name ?? user.email}
            </span>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
};
