/**
 * AdminView.jsx — Admin dashboard, audit trail, cycle management
 * Place in: src/components/AdminView.jsx
 */

import { useState } from 'react';
import {
  useCompletionDashboard,
  useAuditLog,
  usePushSharedGoal,
  useUnlockSheet,
  useUpdateCycle,
  useCycles,
  useTeamSheets,
} from '../hooks/useGoalPortal';

const THRUST_AREAS = [
  'Revenue Growth', 'Cost Efficiency', 'Safety & Quality',
  'Delivery / Execution', 'Customer Experience',
  'Process Improvement', 'People & Learning', 'Innovation',
];

const UOM_OPTIONS = [
  { value: 'min_numeric', label: 'Min (Numeric / %)' },
  { value: 'max_numeric', label: 'Max (Numeric / %)' },
  { value: 'timeline',    label: 'Timeline' },
  { value: 'zero',        label: 'Zero' },
];

const INITIAL_SG_FORM = {
  title: '', thrust_area: THRUST_AREAS[0], uom_type: 'min_numeric',
  target: '', department: '',
};

const inputStyle = {
  background: '#1d2435', border: '1px solid #374057', borderRadius: 8,
  padding: '9px 12px', color: '#e8eaf0', fontSize: 13, outline: 'none',
  width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};

const cardStyle = {
  background: '#1a2030', border: '1px solid #2a3348',
  borderRadius: 14, padding: 20, marginBottom: 14,
};

const btnPrimary = {
  background: '#4f8ef7', color: '#fff', border: 'none',
  borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
};
const btnGhost = {
  background: 'transparent', color: '#8b92a8', border: '1px solid #2a3348',
  borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13,
};
const btnSuccess = {
  background: 'rgba(46,217,163,0.12)', color: '#2ed9a3',
  border: '1px solid rgba(46,217,163,0.2)', borderRadius: 8,
  padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
};
const btnAmber = {
  background: 'rgba(245,166,35,0.12)', color: '#f5a623',
  border: '1px solid rgba(245,166,35,0.2)', borderRadius: 8,
  padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
};

const badge = (color, text) => (
  <span style={{ background: color + '22', color, fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
    {text}
  </span>
);

function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#161b25', border: '1px solid #2a3348', borderRadius: 14, width: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #2a3348', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e8eaf0' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5c6480', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
        {footer && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #2a3348', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD TAB ───
function DashboardTab() {
  const { data: stats, isLoading } = useCompletionDashboard();
  const { data: sheets } = useTeamSheets();
  const unlockSheet = useUnlockSheet();
  const [unlockModal, setUnlockModal] = useState(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [sharedGoalModal, setSharedGoalModal] = useState(false);
  const pushSharedGoal = usePushSharedGoal();
  const { data: cycles } = useCycles();
  const [sgForm, setSgForm] = useState(INITIAL_SG_FORM);

  if (isLoading) return <div style={{ padding: 40, color: '#5c6480', textAlign: 'center' }}>Loading dashboard...</div>;

  const statCards = [
    { label: 'Total Employees', value: stats?.total_employees ?? '—', color: '#4f8ef7' },
    { label: 'Goals Submitted', value: stats?.goals_submitted ?? '—', color: '#2ed9a3', sub: `${stats?.submission_rate ?? 0}% rate` },
    { label: 'Pending Approval', value: stats?.pending_approval ?? '—', color: '#f5a623' },
    { label: 'Managers', value: stats?.manager_stats?.length ?? '—', color: '#9b6dff' },
  ];

  const lockedSheets = (sheets || []).filter(s => s.status === 'locked');

  const closeSharedGoalModal = () => {
    setSgForm(INITIAL_SG_FORM);
    setSharedGoalModal(false);
  };

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: '#1a2030', border: '1px solid #2a3348', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 11, color: '#5c6480', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: s.color, margin: '6px 0 4px', fontFamily: 'monospace' }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 12, color: '#2ed9a3' }}>↑ {s.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Manager stats */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 14 }}>Manager check-in completion</div>
          {(!stats?.manager_stats?.length) && (
            <div style={{ color: '#5c6480', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No managers found</div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {(stats?.manager_stats || []).map(m => {
                const teamSize = m.team_size || 0;
                const checkins = m.checkins_done || 0;
                const rate = teamSize ? Math.round((checkins / teamSize) * 100) : 0;
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #1d2435' }}>
                    <td style={{ padding: '10px 0', color: '#e8eaf0', fontWeight: 500 }}>{m.full_name}</td>
                    <td style={{ padding: '10px 0', color: '#5c6480', fontSize: 12 }}>{teamSize} reports</td>
                    <td style={{ padding: '10px 0', textAlign: 'right' }}>
                      {badge(rate === 100 ? '#2ed9a3' : rate >= 60 ? '#f5a623' : '#f05353', `${rate}%`)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Submission rate by dept */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 14 }}>Portal overview</div>
          {[
            { label: 'Submitted', val: stats?.goals_submitted || 0, color: '#2ed9a3' },
            { label: 'Pending', val: stats?.pending_approval || 0, color: '#f5a623' },
          ].map(row => (
            <div key={row.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8b92a8', marginBottom: 6 }}>
                <span>{row.label}</span>
                <span style={{ color: row.color, fontFamily: 'monospace' }}>{row.val}</span>
              </div>
              <div style={{ background: '#1d2435', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min((row.val / (stats?.total_employees || 1)) * 100, 100)}%`, height: '100%', background: row.color, borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shared Goals */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Shared / Departmental KPIs</div>
          <button style={btnPrimary} onClick={() => setSharedGoalModal(true)}>+ Push Shared Goal</button>
        </div>
        <div style={{ fontSize: 13, color: '#5c6480', textAlign: 'center', padding: '16px 0' }}>
          Use "Push Shared Goal" to broadcast a KPI to an entire department.
          <br />Recipients can only adjust their weightage — title and target are read-only.
        </div>
      </div>

      {/* Goal Unlock Requests */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Goal unlock requests</div>
          {lockedSheets.length > 0 && badge('#f05353', `${lockedSheets.length} locked`)}
        </div>
        {lockedSheets.length === 0 && (
          <div style={{ fontSize: 13, color: '#5c6480', textAlign: 'center', padding: '16px 0' }}>No unlock requests</div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {lockedSheets.map(sheet => (
              <tr key={sheet.id} style={{ borderBottom: '1px solid #1d2435' }}>
                <td style={{ padding: '10px 12px', color: '#e8eaf0', fontWeight: 500 }}>{sheet.employee?.full_name}</td>
                <td style={{ padding: '10px 12px', color: '#5c6480' }}>{sheet.goals?.length || 0} goals · locked</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <button style={btnAmber} onClick={() => { setUnlockModal(sheet.id); setUnlockReason(''); }}>
                    🔓 Unlock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unlock modal */}
      <Modal open={!!unlockModal} onClose={() => setUnlockModal(null)} title="Unlock Goal Sheet"
        footer={
          <>
            <button style={btnGhost} onClick={() => setUnlockModal(null)}>Cancel</button>
            <button style={btnAmber} onClick={() => {
              if (!unlockReason.trim()) { alert('Reason is required for audit trail'); return; }
              unlockSheet.mutate({ sheetId: unlockModal, reason: unlockReason });
              setUnlockModal(null);
            }}>Confirm Unlock</button>
          </>
        }>
        <div>
          <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#f5a623' }}>
            ⚠ This action will be logged to the audit trail. The employee will be able to edit their goals again.
          </div>
          <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>
            Reason for unlock <span style={{ color: '#f05353' }}>*</span>
          </label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            placeholder="e.g. Target needs revision due to market changes..."
            value={unlockReason}
            onChange={e => setUnlockReason(e.target.value)}
          />
        </div>
      </Modal>

      {/* Shared goal modal */}
      <Modal open={sharedGoalModal} onClose={closeSharedGoalModal} title="Push Shared / Departmental Goal"
        footer={
          <>
            <button style={btnGhost} onClick={closeSharedGoalModal}>Cancel</button>
            <button style={btnPrimary} onClick={() => {
              if (!sgForm.title.trim() || !sgForm.target.trim()) { alert('Title and target are required'); return; }
              const activeCycle = (cycles || []).find(c => c.status === 'active');
              pushSharedGoal.mutate({ ...sgForm, cycle_id: activeCycle?.id });
              closeSharedGoalModal();
            }}>Push to Employees</button>
          </>
        }>
        <div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>Goal title *</label>
            <input style={inputStyle} placeholder="e.g. Q2 Revenue Department Target"
              value={sgForm.title} onChange={e => setSgForm({ ...sgForm, title: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>Thrust area</label>
              <select style={inputStyle} value={sgForm.thrust_area} onChange={e => setSgForm({ ...sgForm, thrust_area: e.target.value })}>
                {THRUST_AREAS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>UoM Type</label>
              <select style={inputStyle} value={sgForm.uom_type} onChange={e => setSgForm({ ...sgForm, uom_type: e.target.value })}>
                {UOM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>Target *</label>
              <input style={inputStyle} placeholder="e.g. ₹15 Cr"
                value={sgForm.target} onChange={e => setSgForm({ ...sgForm, target: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>Department</label>
              <select style={inputStyle} value={sgForm.department} onChange={e => setSgForm({ ...sgForm, department: e.target.value })}>
                <option value="">All departments</option>
                {['Sales', 'Engineering', 'Operations', 'Finance', 'HR', 'Marketing'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#8b92a8' }}>
            ℹ Recipients can adjust <strong style={{ color: '#e8eaf0' }}>weightage only</strong>. Title and target will be read-only.
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── AUDIT TRAIL TAB ───
function AuditTab() {
  const { data: log, isLoading } = useAuditLog();

  if (isLoading) return <div style={{ padding: 40, color: '#5c6480', textAlign: 'center' }}>Loading audit trail...</div>;

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 14 }}>
        All post-lock changes — who changed what and when
      </div>
      {(!log?.length) && (
        <div style={{ fontSize: 13, color: '#5c6480', textAlign: 'center', padding: '20px 0' }}>
          No audit entries yet. Actions like approvals, unlocks, and edits will appear here.
        </div>
      )}
      {(log || []).map(entry => (
        <div key={entry.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #1d2435', fontSize: 12 }}>
          <span style={{ color: '#5c6480', fontFamily: 'monospace', minWidth: 160, flexShrink: 0 }}>
            {entry.created_at ? new Date(entry.created_at).toLocaleString('en-IN') : '—'}
          </span>
          <span style={{ color: '#8b92a8' }}>
            <span style={{ color: '#4f8ef7' }}>{entry.actor_name || 'System'}</span>
            {' '}{entry.action}
            {entry.reason && <span style={{ color: '#f5a623' }}> — {entry.reason}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── CYCLE MANAGEMENT TAB ───
function CyclesTab() {
  const { data: cycles, isLoading } = useCycles();
  const updateCycle = useUpdateCycle();

  if (isLoading) return <div style={{ padding: 40, color: '#5c6480', textAlign: 'center' }}>Loading cycles...</div>;

  const statusColor = { active: '#2ed9a3', upcoming: '#8b92a8', closed: '#f05353' };

  return (
    <div>
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 14 }}>FY cycle windows</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a3348' }}>
              {['Phase', 'Window Opens', 'Window Closes', 'Status', 'Action'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#5c6480', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(cycles || []).map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #1d2435' }}>
                <td style={{ padding: '12px', color: '#e8eaf0', fontWeight: 500 }}>{c.label}</td>
                <td style={{ padding: '12px', color: '#8b92a8' }}>{c.window_opens ? new Date(c.window_opens).toLocaleDateString('en-IN') : '—'}</td>
                <td style={{ padding: '12px', color: '#8b92a8' }}>{c.window_closes ? new Date(c.window_closes).toLocaleDateString('en-IN') : '—'}</td>
                <td style={{ padding: '12px' }}>
                  {badge(statusColor[c.status] || '#8b92a8', c.status)}
                </td>
                <td style={{ padding: '12px' }}>
                  {c.status !== 'closed' && (
                    <button style={c.status === 'active' ? btnGhost : btnSuccess}
                      onClick={() => updateCycle.mutate({ cycleId: c.id, status: c.status === 'active' ? 'closed' : 'active' })}>
                      {c.status === 'active' ? 'Close Window' : 'Open Window'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Escalation rules */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Escalation rules</div>
          {badge('#9b6dff', 'Configured')}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a3348' }}>
              {['Trigger', 'Days', 'Escalates To', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#5c6480', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { id: 'esc_submit', trigger: "Employee hasn't submitted goals", days: 5, to: 'Manager → HR' },
              { id: 'esc_approve', trigger: "Manager hasn't approved", days: 3, to: 'Skip-level → HR' },
              { id: 'esc_checkin', trigger: 'Q check-in not completed', days: 7, to: 'Manager → HR' },
            ].map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #1d2435' }}>
                <td style={{ padding: '10px 12px', color: '#e8eaf0' }}>{r.trigger}</td>
                <td style={{ padding: '10px 12px', color: '#8b92a8', fontFamily: 'monospace' }}>{r.days}d</td>
                <td style={{ padding: '10px 12px', color: '#8b92a8' }}>{r.to}</td>
                <td style={{ padding: '10px 12px' }}>{badge('#2ed9a3', 'Active')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ROOT ADMIN VIEW ───
export default function AdminView({ user }) {
  const [tab, setTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'cycles',    label: '🔄 Cycle Management' },
    { id: 'audit',     label: '📋 Audit Trail' },
  ];

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '20px 0 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0' }}>Admin / HR Portal</div>
        <div style={{ fontSize: 13, color: '#5c6480', marginTop: 4 }}>
          Welcome, {user?.full_name} · Full portal oversight and configuration
        </div>
      </div>

      {/* Tabs Layout Container */}
      <div style={{ display: 'flex', gap: 2, background: '#1d2435', borderRadius: 10, padding: 3, marginBottom: 24, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px', borderRadius: 7, border: 'none',
              background: tab === t.id ? '#1a2030' : 'transparent',
              color: tab === t.id ? '#e8eaf0' : '#5c6480',
              cursor: 'pointer', fontSize: 13,
              fontWeight: tab === t.id ? 500 : 400,
              transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tabs View Wrappers to prevent data/query unmounting */}
      <div style={{ display: tab === 'dashboard' ? 'block' : 'none' }}>
        <DashboardTab />
      </div>
      <div style={{ display: tab === 'cycles' ? 'block' : 'none' }}>
        <CyclesTab />
      </div>
      <div style={{ display: tab === 'audit' ? 'block' : 'none' }}>
        <AuditTab />
      </div>
    </div>
  );
}