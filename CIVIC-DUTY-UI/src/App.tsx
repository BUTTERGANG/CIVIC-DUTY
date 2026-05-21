import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NavBar } from './components/Shared';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertsProvider, useAlerts } from './context/AlertsContext';
import { ToastProvider } from './context/ToastContext';
import { CityProvider } from './context/CityContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Council from './pages/Council';
import Bids from './pages/Bids';
import Zoning from './pages/Zoning';
import Campaign from './pages/Campaign';
import Court from './pages/Court';
import Alerts from './pages/Alerts';
import Parcels from './pages/Parcels';
import Buildings from './pages/Buildings';
import Schools from './pages/Schools';
import Parks from './pages/Parks';
import Polling from './pages/Polling';
import TaxDistricts from './pages/TaxDistricts';

function AppShell() {
  const { user, loading, logout } = useAuth();
  const { unreadCount } = useAlerts();

  // Show nothing while restoring session from localStorage
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-slate-600 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  // Not authenticated — show login
  if (!user) return <Login />;

  return (
    <div className="min-h-screen flex flex-col relative text-slate-300 font-sans">

      {/* Ambient Background Engine */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1] bg-background">
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
        <div
          className="absolute top-[-10%] left-[-10%] w-[55%] h-[60%] rounded-full animate-pulse-slow"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(62,168,255,0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute bottom-[-15%] right-[-5%] w-[45%] h-[55%] rounded-full animate-pulse-slow"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(124,92,255,0.10) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animationDelay: '2s',
          }}
        />
        <div
          className="absolute top-[35%] left-[55%] w-[30%] h-[35%] rounded-full animate-pulse-slow"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(16,217,138,0.07) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animationDelay: '4s',
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <NavBar unreadCount={unreadCount} user={user} onLogout={logout} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 z-10 animate-fade-in relative">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/council" element={<Council />} />
          <Route path="/bids" element={<Bids />} />
          <Route path="/zoning" element={<Zoning />} />
          <Route path="/campaign" element={<Campaign />} />
          <Route path="/court" element={<Court />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/parcels" element={<Parcels />} />
          <Route path="/buildings" element={<Buildings />} />
          <Route path="/schools" element={<Schools />} />
          <Route path="/parks" element={<Parks />} />
          <Route path="/polling" element={<Polling />} />
          <Route path="/tax-districts" element={<TaxDistricts />} />
        </Routes>
      </main>

      <div className="fixed bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
    </div>
  );
}

function App() {
  return (
    <Router>
      <CityProvider>
        <AuthProvider>
          <AlertsProvider>
            <ToastProvider>
              <AppShell />
            </ToastProvider>
          </AlertsProvider>
        </AuthProvider>
      </CityProvider>
    </Router>
  );
}

export default App;
