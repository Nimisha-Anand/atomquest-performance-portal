// App.jsx — Role-based routing with sidebar navigation
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { QueryClientProvider, QueryClient, useQuery } from '@tanstack/react-query';
import GoalSheet from './components/GoalSheet';
import ManagerView from './components/ManagerView';
import AdminView from './components/AdminView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

// ─── ROOT ───
export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Splash />;
  if (!session) return <LoginPage />;

  return (
    <QueryClientProvider client={queryClient}>
      <Portal session={session} />
    </QueryClientProvider>
  );
}

// ─── PORTAL (authenticated shell) ───
function Portal({ session }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [activeView, setActiveView] = useState(null);

  // Set default view once user role is known
  useEffect(() => {
    if (user && !activeView) {
      const defaults = { employee: 'my-goals', manager: 'approvals', admin: 'dashboard' };
      setActiveView(defaults[user.role] || 'my-goals');
    }
  }, [user]);

  if (isLoading || !user) return <Splash />;

  const renderView = () => {
    switch (activeView) {
      case 'my-goals':  return <GoalSheet />;
      case 'checkin':   return <GoalSheet />;  // reuse GoalSheet; extend later for check-in mode
      case 'approvals':
      case 'team-checkins': return <ManagerView user={user} />;
      case 'dashboard':
      case 'cycles':
      case 'audit':     return <AdminView user={user} />;
      default:
        if (user.role === 'manager') return <ManagerView user={user} />;
        if (user.role === 'admin')   return <AdminView user={user} />;
        return <GoalSheet />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f1117', color: '#e8eaf0', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <Sidebar user={user} activeView={activeView} onViewChange={setActiveView} />
      <main style={{ flex: 1, overflowX: 'hidden' }}>
        <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
          {renderView()}
        </div>
      </main>
    </div>
  );
}

// ─── SIDEBAR ───
function Sidebar({ user, activeView, onViewChange }) {
  const role = user?.role || 'employee';

  const navByRole = {
    employee: [
      { id: 'my-goals', icon: '📋', label: 'My Goal Sheet' },
      { id: 'checkin',  icon: '📊', label: 'Q1 Check-in', badge: 'Due' },
    ],
    manager: [
      { id: 'approvals',      icon: '✅', label: 'Goal Approvals' },
      { id: 'team-checkins',  icon: '👥', label: 'Team Check-ins' },
    ],
    admin: [
      { id: 'dashboard', icon: '📈', label: 'Dashboard' },
      { id: 'cycles',    icon: '🔄', label: 'Cycle Management' },
      { id: 'audit',     icon: '📋', label: 'Audit Trail' },
    ],
  };

  const roleColors = {
    employee: { bg: 'rgba(46,217,163,0.15)', text: '#2ed9a3' },
    manager:  { bg: 'rgba(245,166,35,0.15)', text: '#f5a623' },
    admin:    { bg: 'rgba(240,83,83,0.15)',  text: '#f05353' },
  };
  const rc = roleColors[role];

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: '#161b25',
      borderRight: '1px solid #2a3348', display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid #2a3348' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#4f8ef7', letterSpacing: '-0.3px' }}>⚡ AtomQuest</div>
        <div style={{ fontSize: 11, color: '#5c6480', marginTop: 2, fontFamily: 'monospace' }}>Goal Portal v1.0</div>
      </div>

      {/* Nav */}
      <div style={{ padding: '16px 12px', flex: 1 }}>
        <div style={{ fontSize: 10, color: '#5c6480', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8, padding: '0 8px' }}>
          {role === 'employee' ? 'Employee' : role === 'manager' ? 'Manager' : 'Admin / HR'}
        </div>
        {(navByRole[role] || []).map(item => (
          <div key={item.id} onClick={() => onViewChange(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px',
              borderRadius: 8, cursor: 'pointer', fontSize: 13, marginBottom: 2,
              background: activeView === item.id ? 'rgba(79,142,247,0.1)' : 'transparent',
              color: activeView === item.id ? '#4f8ef7' : '#8b92a8',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { if (activeView !== item.id) e.currentTarget.style.background = '#1d2435'; }}
            onMouseOut={e => { if (activeView !== item.id) e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && (
              <span style={{ background: '#f5a623', color: '#fff', fontSize: 10, borderRadius: 9, padding: '1px 6px', fontWeight: 600 }}>
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div style={{ padding: 16, borderTop: '1px solid #2a3348' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: rc.bg, color: rc.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {user?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
            <div style={{ fontSize: 11, color: rc.text, textTransform: 'capitalize' }}>{role}</div>
          </div>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ width: '100%', background: 'transparent', border: '1px solid #2a3348', color: '#5c6480', borderRadius: 8, padding: '7px 0', cursor: 'pointer', fontSize: 12, transition: 'all 0.15s' }}
          onMouseOver={e => { e.currentTarget.style.borderColor = '#374057'; e.currentTarget.style.color = '#8b92a8'; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = '#2a3348'; e.currentTarget.style.color = '#5c6480'; }}>
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── LOGIN PAGE ───
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name, role: 'employee' } },
        });
        if (error) throw error;
        setError('Check your email to confirm, then sign in.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: '100%', padding: '10px 12px', background: '#1e293b',
    border: '1px solid #334155', borderRadius: 8, color: '#f8fafc',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#4f8ef7' }}>⚡ AtomQuest</div>
          <div style={{ fontSize: 13, color: '#5c6480', marginTop: 6 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </div>
        </div>

        <div style={{ background: '#1a2030', border: '1px solid #2a3348', borderRadius: 14, padding: 32 }}>
          <form onSubmit={handle}>
            {mode === 'signup' && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>Full name</label>
                <input style={inp} required value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>Email</label>
              <input style={inp} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>Password</label>
              <input style={inp} type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && (
              <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, marginBottom: 14,
                background: error.includes('Check') ? 'rgba(46,217,163,0.08)' : 'rgba(240,83,83,0.08)',
                border: `1px solid ${error.includes('Check') ? 'rgba(46,217,163,0.2)' : 'rgba(240,83,83,0.2)'}`,
                color: error.includes('Check') ? '#2ed9a3' : '#f05353' }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 12, background: '#4f8ef7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#5c6480' }}>
            {mode === 'login' ? "No account? " : "Already have one? "}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SPLASH ───
function Splash() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5c6480', fontFamily: 'sans-serif', fontSize: 14 }}>
      Loading AtomQuest...
    </div>
  );
}