import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName || undefined);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-background">
      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
        <div
          className="absolute top-[-10%] left-[-10%] w-[55%] h-[60%] rounded-full animate-pulse-slow"
          style={{ background: 'radial-gradient(ellipse at center, rgba(62,168,255,0.12) 0%, transparent 70%)', filter: 'blur(60px)' }}
        />
        <div
          className="absolute bottom-[-15%] right-[-5%] w-[45%] h-[55%] rounded-full animate-pulse-slow"
          style={{ background: 'radial-gradient(ellipse at center, rgba(124,92,255,0.10) 0%, transparent 70%)', filter: 'blur(60px)', animationDelay: '2s' }}
        />
      </div>

      <div className="w-full max-w-sm px-4 z-10">
        {/* Logo / wordmark */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">
            Civic<span className="text-primary">Duty</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Fishers, IN civic data — all in one place</p>
        </div>

        <div className="glass-card p-7 space-y-5">
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-white/[0.07] p-1 gap-1">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold font-display transition-all duration-200 ${
                  mode === m
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Display Name</label>
                <input
                  type="text"
                  className="input-field w-full"
                  placeholder="Your name (optional)"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium">Email</label>
              <input
                type="email"
                className="input-field w-full"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium">Password</label>
              <input
                type="password"
                className="input-field w-full"
                placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && (
              <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
