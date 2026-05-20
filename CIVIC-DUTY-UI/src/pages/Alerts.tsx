import { useState, useEffect } from 'react';
import { AlertCard, ModuleBadge } from '../components/Shared';
import { useAlerts } from '../context/AlertsContext';
import { fetchAlertRules, apiCreateAlertRule, apiDeleteAlertRule, AlertRule } from '../api';
import { BellRing, Plus, CheckCheck, MapPin, Tag, X, Trash2 } from 'lucide-react';
import { formatDate } from '../lib/format';

const MODULES = ['council', 'bids', 'zoning', 'campaign', 'court'] as const;

// ── Add Rule Modal ────────────────────────────────────────────────────────────

function AddRuleModal({ onClose, onSaved }: { onClose: () => void; onSaved: (rule: AlertRule) => void }) {
  const [module, setModule] = useState<string>('council');
  const [type, setType] = useState<'keyword' | 'location'>('keyword');
  const [keyword, setKeyword] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError('');
    if (type === 'keyword' && !keyword.trim()) { setError('Enter a keyword'); return; }
    if (type === 'location') {
      if (!lat || !lng || !radius) { setError('Fill in lat, lng, and radius'); return; }
      if (isNaN(Number(lat)) || isNaN(Number(lng)) || isNaN(Number(radius))) { setError('Coordinates must be numbers'); return; }
    }
    setSaving(true);
    try {
      const rule = await apiCreateAlertRule({
        module,
        keyword: type === 'keyword' ? keyword.trim() : undefined,
        lat: type === 'location' ? Number(lat) : undefined,
        lng: type === 'location' ? Number(lng) : undefined,
        radius_miles: type === 'location' ? Number(radius) : undefined,
      });
      onSaved(rule);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 space-y-5 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-white text-lg">New Watchlist Rule</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Module */}
        <div>
          <label className="block text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Module</label>
          <div className="flex flex-wrap gap-2">
            {MODULES.map(m => (
              <button
                key={m}
                onClick={() => setModule(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  module === m
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:border-white/10 hover:text-slate-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Rule type */}
        <div>
          <label className="block text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Match Type</label>
          <div className="flex gap-2">
            {(['keyword', 'location'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  type === t
                    ? 'bg-primary/15 text-primary border-primary/35'
                    : 'bg-white/[0.02] text-slate-500 border-white/[0.06] hover:text-slate-300'
                }`}
              >
                {t === 'keyword' ? <Tag size={13} /> : <MapPin size={13} />}
                {t === 'keyword' ? 'Keyword' : 'Location'}
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        {type === 'keyword' ? (
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium">Keyword</label>
            <input
              className="input-field w-full"
              placeholder='e.g. "annexation" or "IKEA Way"'
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-slate-600 mt-1.5">Matched against the full text of every new record in this module.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Latitude</label>
                <input className="input-field w-full" placeholder="39.9417" value={lat} onChange={e => setLat(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Longitude</label>
                <input className="input-field w-full" placeholder="-86.0138" value={lng} onChange={e => setLng(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium">Radius (miles)</label>
              <input className="input-field w-full" placeholder="2" value={radius} onChange={e => setRadius(e.target.value)} />
            </div>
            <p className="text-xs text-slate-600">Triggers when a new record falls within this radius. Only works for modules with coordinates (zoning, bids).</p>
          </div>
        )}

        {error && (
          <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rule Card ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, onDelete }: { rule: AlertRule; onDelete: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDeleteAlertRule(rule.id);
      onDelete(rule.id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex justify-between items-center">
        <ModuleBadge module={rule.module} />
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-[11px] text-slate-600 hover:text-danger transition-colors font-medium flex items-center gap-1 disabled:opacity-40"
        >
          <Trash2 size={11} />
          {deleting ? 'Removing…' : 'Remove'}
        </button>
      </div>

      {rule.keyword && (
        <div className="flex items-start gap-2 text-sm text-slate-400">
          <Tag size={13} className="text-slate-600 mt-0.5 shrink-0" />
          <span>Keyword: <strong className="text-slate-200">"{rule.keyword}"</strong></span>
        </div>
      )}

      {rule.radius_miles && rule.lat && rule.lng && (
        <>
          <div className="flex items-start gap-2 text-sm text-slate-400">
            <MapPin size={13} className="text-slate-600 mt-0.5 shrink-0" />
            <span>Within <strong className="text-slate-200">{rule.radius_miles} mi</strong> of:</span>
          </div>
          <div className="font-mono text-xs text-slate-500 bg-background/60 px-2.5 py-1.5 rounded-lg border border-white/[0.06]">
            {Number(rule.lat).toFixed(4)}, {Number(rule.lng).toFixed(4)}
          </div>
        </>
      )}

      <p className="text-[10px] text-slate-700 font-mono">
        Added {formatDate(rule.created_at)}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Alerts() {
  const { alerts, markRead, markAllRead } = useAlerts();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const unread = alerts.filter(a => !a.read).length;

  useEffect(() => {
    fetchAlertRules()
      .then(setRules)
      .catch(() => {})
      .finally(() => setLoadingRules(false));
  }, []);

  const handleRuleSaved = (rule: AlertRule) => setRules(prev => [rule, ...prev]);
  const handleRuleDeleted = (id: number) => setRules(prev => prev.filter(r => r.id !== id));

  return (
    <div className="space-y-6 animate-slide-up">
      {showModal && (
        <AddRuleModal onClose={() => setShowModal(false)} onSaved={handleRuleSaved} />
      )}

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="page-header">Alerts Engine</h1>
            <BellRing size={22} className="text-primary animate-pulse-slow" />
          </div>
          <p className="text-slate-500 text-sm max-w-xl">Manage your active watchlists and see triggered events in real-time.</p>
        </div>
        {unread > 0 && (
          <div className="flex items-center gap-2 text-xs font-bold text-primary bg-primary/8 border border-primary/25 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {unread} unread
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8">

        {/* Watchlist Rules */}
        <div className="md:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Watchlist Rules</h2>
            <button onClick={() => setShowModal(true)} className="btn-primary text-xs py-1.5 px-3 shadow-none flex items-center gap-1.5">
              <Plus size={13} /> Rule
            </button>
          </div>

          <div className="space-y-3">
            {loadingRules && (
              <div className="text-slate-600 text-xs text-center py-6">Loading…</div>
            )}
            {!loadingRules && rules.map(rule => (
              <RuleCard key={rule.id} rule={rule} onDelete={handleRuleDeleted} />
            ))}
            {!loadingRules && rules.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="w-full glass-card p-4 border-dashed border-white/10 flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-slate-400 hover:border-white/20 transition-all group"
              >
                <Plus size={15} className="group-hover:text-primary transition-colors" />
                Add your first rule
              </button>
            )}
          </div>
        </div>

        {/* Triggered Feed */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Triggered Feed</h2>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors font-medium"
              >
                <CheckCheck size={15} />
                Mark all read
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="glass-card p-10 flex flex-col items-center justify-center text-center">
              <BellRing size={28} className="text-slate-700 mb-3" />
              <p className="text-slate-600 text-sm">No alerts triggered yet.</p>
              <p className="text-slate-700 text-xs mt-1">Add watchlist rules to start monitoring.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(a => <AlertCard key={a.id} alert={a} onRead={markRead} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
