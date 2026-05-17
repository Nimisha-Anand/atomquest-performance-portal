/**
 * GoalSheet.jsx — Employee goal creation and editing
 * Full BRD compliance: max 8 goals, min 10% weightage, total = 100%
 */

import { useState, useCallback, useEffect } from "react";
import { useMySheet, useSaveDraft, useSubmitSheet } from "../hooks/useGoalPortal";
import { validateSheet, computeScore } from "../lib/scoring.js";

const THRUST_AREAS = [
  'Revenue Growth', 'Cost Efficiency', 'Safety & Quality',
  'Delivery / Execution', 'Customer Experience',
  'Process Improvement', 'People & Learning', 'Innovation',
];

const UOM_TYPES = [
  { value: 'min_numeric', label: 'Min (Numeric / %)', hint: 'Higher is better — e.g. Sales Revenue' },
  { value: 'max_numeric', label: 'Max (Numeric / %)', hint: 'Lower is better — e.g. TAT, Cost' },
  { value: 'timeline',    label: 'Timeline',           hint: 'Date-based completion' },
  { value: 'zero',        label: 'Zero',               hint: 'Zero = Success — e.g. Safety incidents' },
];

export default function GoalSheet() {
  const { data, isLoading } = useMySheet();
  const saveDraft   = useSaveDraft();
  const submitSheet = useSubmitSheet();

  const [goals, setGoals] = useState([]);
  const [errors, setErrors] = useState([]);

  // Crucial Fix: Sync remote Supabase data to local form state as soon as it loads
 useEffect(() => {
  if (isLoading) return; // wait until loading is done

  if (data?.goals && Array.isArray(data.goals) && data.goals.length > 0) {
    // Use data.goals (top level) not data.sheet.goals
    setGoals(data.goals.map(g => ({
      ...g,
      target: g.target_value || g.target || '',
    })));
  } else {
    setGoals([
      { id: crypto.randomUUID(), thrust_area: '', title: '', description: '', uom_type: 'min_numeric', target: '', target_date: '', weightage: '' }
    ]);
  }
}, [data, isLoading]);

  const isLocked = data?.sheet?.is_locked || data?.sheet?.status === 'approved';;

  const totalWeight = goals.reduce((s, g) => s + (parseFloat(g.weightage) || 0), 0);
  const remaining   = 100 - totalWeight;
  const weightOk    = Math.abs(totalWeight - 100) < 0.01;

  const updateGoal = useCallback((id, field, val) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, [field]: val } : g));
  }, []);

  const addGoal = () => {
    if (goals.length >= 8) return;
    setGoals(prev => [...prev, {
      id: crypto.randomUUID(), thrust_area: '', title: '', description: '',
      uom_type: 'min_numeric', target: '', target_date: '', weightage: '',
    }]);
  };

  const removeGoal = (id) => {
    if (goals.length <= 1) return;
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const handleSave = () => {
  setErrors([]);
  
  // Map local state field "target" → DB column "target_value"
  const mapped = goals.map(g => ({
    ...g,
    target_value: g.target,  // ← rename for the API
  }));

  saveDraft.mutate(mapped, {
    onSuccess: () => {
      alert("Draft saved successfully!");
    },
    onError: (err) => {
      setErrors([err.message || "Failed to save draft backend validation error."]);
    }
    });
  };

  const handleSubmit = () => {
    const errs = validateSheet(goals);
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    
    if (!window.confirm("Are you sure you want to submit? This locks editing until reviewed.")) return;
    
    submitSheet.mutate(data.sheet.id, {
      onSuccess: () => {
        alert("Goal sheet submitted for manager approval!");
      },
      onError: (err) => {
        setErrors([err.message || "Submission failed."]);
      }
    });
  };

  const weightColor = totalWeight === 100 ? '#2ed9a3' : totalWeight > 100 ? '#f05353' : '#f5a623';

  if (isLoading) return <LoadingState />;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 0 60px' }}>

      {/* Cycle Banner */}
      <CycleBanner cycle={data?.cycle} sheet={data?.sheet} />

      {/* Weightage Summary Card */}
      <div className="card" style={{ marginBottom: 16, background: 'var(--bg2)', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="card-title" style={{ fontWeight: 600 }}>Weightage allocation</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              {goals.length}/8 goals · Remaining: <strong style={{ color: weightColor }}>{remaining.toFixed(1)}%</strong>
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 600, color: weightColor }}>
              {totalWeight.toFixed(1)}%
            </span>
          </div>
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.3s, background 0.3s',
            width: `${Math.min(totalWeight, 100)}%`,
            background: weightColor,
          }} />
        </div>
        {/* Per-goal weight mini-bars */}
        <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
          {goals.map((g, i) => (
            <div key={g.id} title={`Goal ${i+1}: ${g.weightage || 0}%`} style={{
              flex: parseFloat(g.weightage) || 0,
              height: 3, borderRadius: 2,
              background: `hsl(${(i * 47) % 360}, 60%, 55%)`,
              transition: 'flex 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div style={{
          background: 'rgba(240,83,83,0.08)', border: '1px solid rgba(240,83,83,0.25)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
        }}>
          {errors.map((e, i) => <div key={i} style={{ fontSize: 13, color: 'var(--red)', marginBottom: 4 }}>✕ {e}</div>)}
        </div>
      )}

      {/* Goals List */}
      {goals.map((goal, index) => (
        <GoalRow
          key={goal.id}
          goal={goal}
          index={index}
          isLocked={isLocked}
          onUpdate={updateGoal}
          onRemove={removeGoal}
          canRemove={goals.length > 1}
        />
      ))}

      {/* Add Goal */}
      {!isLocked && goals.length < 8 && (
        <button
          onClick={addGoal}
          style={{
            width: '100%', padding: '12px', marginTop: 8,
            background: 'transparent', border: '1px dashed var(--border2)',
            borderRadius: 10, color: 'var(--text3)', cursor: 'pointer',
            fontSize: 13, fontFamily: 'var(--font)',
            transition: 'all 0.15s',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)'; }}
          onMouseOut={e => { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.color='var(--text3)'; }}
        >
          + Add another goal <span style={{ fontSize: 11, marginLeft: 4 }}>({8 - goals.length} remaining)</span>
        </button>
      )}

      {/* Action Bar */}
      {!isLocked && (
        <div style={{
          position: 'sticky', bottom: 0, background: 'var(--bg)',
          borderTop: '1px solid var(--border)', marginTop: 20,
          padding: '14px 0', display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button 
            className="btn btn-ghost" 
            onClick={handleSave} 
            disabled={saveDraft.isPending}
            style={{ padding: '8px 16px', cursor: 'pointer' }}
          >
            {saveDraft.isPending ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitSheet.isPending || !weightOk}
            style={{ 
              padding: '8px 16px', 
              cursor: weightOk ? 'pointer' : 'not-allowed',
              background: weightOk ? 'var(--accent, #4f8ef7)' : '#cbd5e1',
              color: '#fff',
              border: 'none',
              borderRadius: 6
            }}
            title={!weightOk ? `Total weightage must be 100% (currently ${totalWeight.toFixed(1)}%)` : ''}
          >
            {submitSheet.isPending ? 'Submitting...' : 'Submit for Approval →'}
          </button>
        </div>
      )}

      {isLocked && (
        <div style={{
          background: 'rgba(46,217,163,0.06)', border: '1px solid rgba(46,217,163,0.2)',
          borderRadius: 8, padding: '12px 16px', marginTop: 16, fontSize: 13, color: 'var(--green)',
        }}>
          🔒 Goal sheet approved and locked. Contact Admin if changes are needed.
        </div>
      )}
    </div>
  );
}

// ─── Goal Row Component ───
function GoalRow({ goal, index, isLocked, onUpdate, onRemove, canRemove }) {
  const uomInfo = UOM_TYPES.find(u => u.value === goal.uom_type);

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: 16, marginBottom: 10,
      opacity: isLocked ? 0.85 : 1,
    }}>
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 24, height: 24, background: 'var(--bg3)', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0,
        }}>{index + 1}</div>

        <select
          className="form-select"
          style={{ width: 200, padding: '6px', borderRadius: 6 }}
          value={goal.thrust_area || ''}
          onChange={e => onUpdate(goal.id, 'thrust_area', e.target.value)}
          disabled={isLocked}
        >
          <option value="">— Select Thrust Area —</option>
          {THRUST_AREAS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <input
          className="form-input"
          style={{ flex: 1, padding: '6px', borderRadius: 6, border: '1px solid var(--border)' }}
          placeholder="Goal title..."
          value={goal.title || ''}
          onChange={e => onUpdate(goal.id, 'title', e.target.value)}
          disabled={isLocked}
        />

        {!isLocked && canRemove && (
          <button
            onClick={() => onRemove(goal.id)}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text3)',
              cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
              fontSize: 16, lineHeight: 1, flexShrink: 0,
              transition: 'color 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text3)'}
            title="Remove goal"
          >✕</button>
        )}
      </div>

      {/* Detail row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr', gap: 12 }}>
        <div>
          <label className="form-label" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            UoM Type <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <select
            className="form-select"
            style={{ width: '100%', padding: '6px', borderRadius: 6 }}
            value={goal.uom_type || 'min_numeric'}
            onChange={e => onUpdate(goal.id, 'uom_type', e.target.value)}
            disabled={isLocked || goal.is_shared}
          >
            {UOM_TYPES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
          {uomInfo && <div className="form-hint" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{uomInfo.hint}</div>}
        </div>

        <div>
          <label className="form-label" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            Target <span style={{ color: 'var(--red)' }}>*</span>
            {goal.is_shared && <span style={{ color: 'var(--text3)', marginLeft: 6, fontWeight: 400 }}>(read-only)</span>}
          </label>
          {goal.uom_type === 'timeline' ? (
            <input
              className="form-input" type="date"
              style={{ width: '100%', padding: '5px', borderRadius: 6, border: '1px solid var(--border)' }}
              value={goal.target_date || ''}
              onChange={e => onUpdate(goal.id, 'target_date', e.target.value)}
              disabled={isLocked || goal.is_shared}
            />
          ) : (
            <input
              className="form-input"
              style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px solid var(--border)' }}
              placeholder={goal.uom_type === 'zero' ? '0' : 'e.g. 100, 15%'}
              value={goal.target || ''}
              onChange={e => onUpdate(goal.id, 'target', e.target.value)}
              disabled={isLocked || goal.is_shared}
            />
          )}
        </div>

        <div>
          <label className="form-label" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            Weightage % <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input
            className="form-input"
            type="number" min="10" max="100" step="5"
            placeholder="10–100"
            value={goal.weightage || ''}
            onChange={e => onUpdate(goal.id, 'weightage', parseFloat(e.target.value) || '')}
            disabled={isLocked}
            style={{
                  width: '100%', padding: '6px', borderRadius: 6,
                  border: '1px solid',
                  borderColor: goal.weightage && goal.weightage < 10 ? 'var(--red, #f05353)' : 'var(--border)',
                  color: goal.weightage && goal.weightage < 10 ? 'var(--red, #f05353)' : '#e8eaf0',
                  background: '#1d2435',
                  colorScheme: 'dark',
              }}
          />
          {goal.weightage && goal.weightage < 10 &&
            <div className="form-error" style={{ color: 'var(--red, #f05353)', fontSize: 11, marginTop: 2 }}>Min 10%</div>}
        </div>

        <div>
          <label className="form-label" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Status</label>
          <select 
            className="form-select" 
            style={{ width: '100%', padding: '6px', borderRadius: 6 }}
            value={goal.status || 'not_started'} 
            onChange={e => onUpdate(goal.id, 'status', e.target.value)}
            disabled={isLocked}
          >
            <option value="not_started">Not Started</option>
            <option value="on_track">On Track</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Optional description */}
      {!isLocked && (
        <div style={{ marginTop: 10 }}>
          <textarea
            className="form-textarea"
            style={{ width: '100%', minHeight: 48, fontSize: 12, padding: '6px', borderRadius: 6, border: '1px solid var(--border)' }}
            placeholder="Optional: add context or success criteria..."
            value={goal.description || ''}
            onChange={e => onUpdate(goal.id, 'description', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function CycleBanner({ cycle, sheet }) {
  const statusMap = {
    draft:        { color: '#4f8ef7', label: 'Draft' },
    submitted:    { color: '#f5a623', label: 'Pending Approval' },
    under_review: { color: '#f5a623', label: 'Under Review' },
    approved:     { color: '#2ed9a3', label: 'Approved ✓' },
    returned:     { color: '#f05353', label: 'Returned — Please Revise' },
  };
  const s = statusMap[sheet?.status || 'draft'];

  return (
    <div style={{
      background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.2)',
      borderRadius: 10, padding: '14px 18px', display: 'flex',
      alignItems: 'center', gap: 14, marginBottom: 20,
    }}>
      <div style={{
        width: 36, height: 36, background: 'rgba(79,142,247,0.12)',
        borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>📋</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#4f8ef7' }}>
          {cycle?.label || 'Phase 1 — Goal Setting Window Open'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
          {cycle?.fiscal_year || 'FY 2025-26'} · Submit by {cycle?.window_closes || '31 May 2025'} · Max 8 goals · Total weightage = 100%
        </div>
        {sheet?.return_reason && (
          <div style={{ fontSize: 12, color: '#f05353', marginTop: 4 }}>
            <strong>Manager note:</strong> {sheet.return_reason}
          </div>
        )}
      </div>
      <span style={{
        background: (s?.color || '#4f8ef7') + '22', color: s?.color || '#4f8ef7',
        fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500,
      }}>{s?.label}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
      Loading goal sheet...
    </div>
  );
}