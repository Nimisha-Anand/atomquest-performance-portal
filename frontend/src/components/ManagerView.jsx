/**
 * ManagerView.jsx — Manager approval + team check-in views
 * Place in: src/components/ManagerView.jsx
 */

import { useState } from 'react';
import {
  useTeamSheets,
  useApproveSheet,
  useReturnSheet,
  useEditGoal,
  useSaveCheckin,
} from '../hooks/useGoalPortal';

const UOM_LABELS = {
  min_numeric: 'Min %',
  max_numeric: 'Max %',
  timeline:    'Timeline',
  zero:        'Zero',
};

const badgeStyle = (color) => ({
  background: color + '22',
  color,
  fontSize: 11,
  padding: '3px 10px',
  borderRadius: 20,
  fontWeight: 500,
  display: 'inline-block',
});

const STATUS_COLORS = {
  draft:      '#8b92a8',
  submitted:  '#f5a623',
  approved:   '#2ed9a3',
  locked:     '#2ed9a3',
  returned:   '#f05353',
};

// ─── Shared input style ───
const inputStyle = {
  background: '#1d2435',
  border: '1px solid #374057',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#e8eaf0',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const cardStyle = {
  background: '#1a2030',
  border: '1px solid #2a3348',
  borderRadius: 14,
  padding: 20,
  marginBottom: 14,
};

const btnPrimary = {
  background: '#4f8ef7', color: '#fff', border: 'none',
  borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
  fontSize: 13, fontWeight: 500,
};

const btnGhost = {
  background: 'transparent', color: '#8b92a8',
  border: '1px solid #2a3348', borderRadius: 8,
  padding: '7px 16px', cursor: 'pointer', fontSize: 13,
};

const btnSuccess = {
  background: 'rgba(46,217,163,0.12)', color: '#2ed9a3',
  border: '1px solid rgba(46,217,163,0.2)', borderRadius: 8,
  padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
};

const btnDanger = {
  background: 'rgba(240,83,83,0.12)', color: '#f05353',
  border: '1px solid rgba(240,83,83,0.2)', borderRadius: 8,
  padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
};

// ─── Modal ───
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#161b25', border: '1px solid #2a3348', borderRadius: 14, width: 540, maxHeight: '85vh', overflowY: 'auto' }}>
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

// ─── APPROVALS TAB ───
function ApprovalsTab() {
  const { data: sheets, isLoading } = useTeamSheets();
  const approveSheet = useApproveSheet();
  const returnSheet  = useReturnSheet();
  const [returnModal, setReturnModal] = useState(null); // sheetId
  const [returnReason, setReturnReason] = useState('');

  if (isLoading) return <div style={{ padding: 40, color: '#5c6480', textAlign: 'center' }}>Loading team sheets...</div>;

  const pending = (sheets || []).filter(s => s.status === 'submitted');
  const others  = (sheets || []).filter(s => s.status !== 'submitted');

  return (
    <div>
      {/* Pending */}
      <div style={{ fontSize: 12, color: '#5c6480', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
        Pending Review ({pending.length})
      </div>

      {pending.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#5c6480', padding: 40 }}>
          ✓ No pending submissions right now
        </div>
      )}

      {pending.map(sheet => {
        const goals = sheet.goals || [];
        const totalWeight = goals.reduce((s, g) => s + parseFloat(g.weightage || 0), 0);
        const isValid = Math.abs(totalWeight - 100) < 0.01;

        return (
          <div key={sheet.id} style={{ ...cardStyle, borderLeft: `3px solid ${isValid ? '#f5a623' : '#f05353'}` }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(79,142,247,0.15)', color: '#4f8ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
                  {sheet.employee?.full_name?.[0] || '?'}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>{sheet.employee?.full_name || 'Unknown'}</div>
                  <div style={{ fontSize: 12, color: '#5c6480' }}>
                    {sheet.employee?.department || 'No dept'} · Submitted {sheet.submitted_at ? new Date(sheet.submitted_at).toLocaleDateString('en-IN') : '—'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={badgeStyle('#f5a623')}>● Pending Review</span>
                <button style={btnGhost} onClick={() => { setReturnModal(sheet.id); setReturnReason(''); }}>
                  ↩ Return
                </button>
                <button
                  style={{ ...btnSuccess, opacity: isValid ? 1 : 0.4, cursor: isValid ? 'pointer' : 'not-allowed' }}
                  disabled={!isValid || approveSheet.isPending}
                  onClick={() => approveSheet.mutate(sheet.id)}>
                  ✓ Approve & Lock
                </button>
              </div>
            </div>

            {/* Weightage error */}
            {!isValid && (
              <div style={{ background: 'rgba(240,83,83,0.08)', border: '1px solid rgba(240,83,83,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#f05353' }}>
                ⚠ Total weightage is {totalWeight.toFixed(1)}% — must equal 100% before approval
              </div>
            )}

            {/* Goals table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a3348' }}>
                  {['Thrust Area', 'Goal Title', 'UoM', 'Target', 'Weightage'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#5c6480', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {goals.map(g => (
                  <tr key={g.id} style={{ borderBottom: '1px solid #1d2435' }}>
                    <td style={{ padding: '10px 12px', color: '#8b92a8' }}>{g.thrust_area}</td>
                    <td style={{ padding: '10px 12px', color: '#e8eaf0', fontWeight: 500 }}>{g.title}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={badgeStyle('#4f8ef7')}>{UOM_LABELS[g.uom_type] || g.uom_type}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#8b92a8' }}>{g.target_value || g.target_date || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#e8eaf0', fontFamily: 'monospace' }}>{g.weightage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: '10px 12px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#5c6480' }}>
                Total: <strong style={{ color: isValid ? '#2ed9a3' : '#f05353' }}>{totalWeight.toFixed(1)}%</strong> {isValid ? '✓' : '✗'}
              </span>
              <span style={{ fontSize: 12, color: '#5c6480' }}>{goals.length} goals</span>
            </div>
          </div>
        );
      })}

      {/* Previously actioned */}
      {others.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: '#5c6480', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '20px 0 12px' }}>
            Previously Actioned ({others.length})
          </div>
          {others.map(sheet => (
            <div key={sheet.id} style={{ ...cardStyle, borderLeft: `3px solid ${STATUS_COLORS[sheet.status] || '#2a3348'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(139,146,168,0.15)', color: '#8b92a8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
                    {sheet.employee?.full_name?.[0] || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#e8eaf0' }}>{sheet.employee?.full_name}</div>
                    <div style={{ fontSize: 12, color: '#5c6480' }}>{sheet.goals?.length || 0} goals</div>
                  </div>
                </div>
                <span style={badgeStyle(STATUS_COLORS[sheet.status] || '#8b92a8')}>
                  {sheet.status}
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Return modal */}
      <Modal
        open={!!returnModal}
        onClose={() => setReturnModal(null)}
        title="Return Sheet for Rework"
        footer={
          <>
            <button style={btnGhost} onClick={() => setReturnModal(null)}>Cancel</button>
            <button style={btnDanger} onClick={() => {
              if (!returnReason.trim()) { alert('Reason is required'); return; }
              returnSheet.mutate({ sheetId: returnModal, reason: returnReason });
              setReturnModal(null);
            }}>Return Sheet</button>
          </>
        }>
        <div>
          <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>
            Reason for return <span style={{ color: '#f05353' }}>*</span>
          </label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
            placeholder="Explain what needs to be fixed..."
            value={returnReason}
            onChange={e => setReturnReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}

// ─── TEAM CHECK-INS TAB ───
function TeamCheckinsTab() {
  const { data: sheets } = useTeamSheets();
  const saveCheckin = useSaveCheckin();
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [recommendation, setRecommendation] = useState('No change — continue as planned');

  const allSheets = (sheets || []).filter(s => ['locked', 'submitted', 'approved'].includes(s.status));

  return (
    <div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0' }}>Team check-in status</span>
          <span style={badgeStyle('#f5a623')}>
            {allSheets.filter(s => s.manager_checkins?.length).length} / {allSheets.length} reviewed
          </span>
        </div>

        {allSheets.length === 0 && (
          <div style={{ textAlign: 'center', color: '#5c6480', padding: '20px 0' }}>
            No approved sheets yet. Approve goal sheets first.
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          {allSheets.length > 0 && (
            <thead>
              <tr style={{ borderBottom: '1px solid #2a3348' }}>
                {['Employee', 'Goals', 'Sheet Status', 'Check-in', 'Action'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#5c6480', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {allSheets.map(sheet => {
              const hasCheckin = sheet.manager_checkins?.length > 0;
              return (
                <tr key={sheet.id} style={{ borderBottom: '1px solid #1d2435' }}>
                  <td style={{ padding: '12px', color: '#e8eaf0', fontWeight: 500 }}>{sheet.employee?.full_name}</td>
                  <td style={{ padding: '12px', color: '#8b92a8' }}>{sheet.goals?.length || 0}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={badgeStyle(STATUS_COLORS[sheet.status] || '#8b92a8')}>{sheet.status}</span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {hasCheckin
                      ? <span style={badgeStyle('#2ed9a3')}>Done</span>
                      : <span style={badgeStyle('#8b92a8')}>Pending</span>}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button style={hasCheckin ? btnGhost : btnPrimary} onClick={() => {
                      setSelected(sheet);
                      setComment(sheet.manager_checkins?.[0]?.comment || '');
                      setRecommendation(sheet.manager_checkins?.[0]?.recommendation || 'No change — continue as planned');
                    }}>
                      {hasCheckin ? 'View / Edit' : 'Add Comment'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Check-in modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Q1 Check-in — ${selected?.employee?.full_name}`}
        footer={
          <>
            <button style={btnGhost} onClick={() => setSelected(null)}>Cancel</button>
            <button style={btnPrimary} onClick={() => {
              if (!comment.trim()) { alert('Comment is required'); return; }
              saveCheckin.mutate({
                sheet_id: selected.id,
                cycle_id: selected.cycle_id,
                comment,
                recommendation,
              });
              setSelected(null);
            }}>Save Comment</button>
          </>
        }>
        <div>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#1d2435', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#5c6480', marginBottom: 4 }}>Goals</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#4f8ef7', fontFamily: 'monospace' }}>
                {selected?.goals?.length || 0}
              </div>
            </div>
            <div style={{ background: '#1d2435', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#5c6480', marginBottom: 4 }}>Sheet Status</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: STATUS_COLORS[selected?.status] || '#8b92a8', marginTop: 4 }}>
                {selected?.status}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>
              Check-in comment <span style={{ color: '#f05353' }}>*</span>
            </label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
              placeholder={'• What went well?\n• Any blockers or concerns?\n• Actions agreed upon?'}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8b92a8', display: 'block', marginBottom: 6 }}>Manager recommendation</label>
            <select style={inputStyle} value={recommendation} onChange={e => setRecommendation(e.target.value)}>
              <option>No change — continue as planned</option>
              <option>Revise target (requires Admin unlock)</option>
              <option>Flag for additional support</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── ROOT MANAGER VIEW ───
export default function ManagerView({ user }) {
  const [tab, setTab] = useState('approvals');
  const { data: sheets } = useTeamSheets();
  const pendingCount = (sheets || []).filter(s => s.status === 'submitted').length;

  const tabs = [
    { id: 'approvals',  label: 'Goal Approvals', badge: pendingCount },
    { id: 'checkins',   label: 'Team Check-ins' },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 0 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0' }}>Manager Portal</div>
        <div style={{ fontSize: 13, color: '#5c6480', marginTop: 4 }}>
          Welcome, {user?.full_name} · Review and approve your team's goal sheets
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#1d2435', borderRadius: 10, padding: 3, marginBottom: 24, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px', borderRadius: 7, border: 'none',
              background: tab === t.id ? '#1a2030' : 'transparent',
              color: tab === t.id ? '#e8eaf0' : '#5c6480',
              cursor: 'pointer', fontSize: 13,
              fontWeight: tab === t.id ? 500 : 400,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
            }}>
            {t.label}
            {t.badge > 0 && (
              <span style={{ background: '#f5a623', color: '#fff', fontSize: 10, borderRadius: 9, padding: '1px 6px', fontWeight: 600 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'approvals' && <ApprovalsTab />}
      {tab === 'checkins'  && <TeamCheckinsTab />}
    </div>
  );
}