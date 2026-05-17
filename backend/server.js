/**
 * AtomQuest Goal Portal — Express Backend
 * 
 * Setup:
 *   npm install express cors @supabase/supabase-js dotenv
 *   node server.js  (or: nodemon server.js)
 * 
 * Env vars needed (.env in this folder):
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY=<service_role key from Supabase settings>
 *   PORT=3001
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Admin client (bypasses RLS for server-side operations)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── AUTH MIDDLEWARE ───
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return res.status(401).json({ error: 'User profile not found' });

  req.user = profile;        // ← profile, not the raw Supabase user
  req.userProfile = profile; // ← keep this too so nothing breaks
  next();
}

// Role guard factory
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userProfile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// ─── AUDIT LOG HELPER ───
async function logAudit({ entityType, entityId, actorId, actorName, action, oldValue, newValue, reason }) {
  await supabaseAdmin.from('audit_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    actor_id: actorId,
    actor_name: actorName,
    action,
    old_value: oldValue || null,
    new_value: newValue || null,
    reason: reason || null,
  });
}

// ═══════════════════════════════════════════════════════════════
// EMPLOYEE ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/sheets/my — get current employee's goal sheet for active cycle
app.get('/api/sheets/my', authenticate, async (req, res) => {
  try {
    // Find active cycle
    const { data: cycle } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('status', 'active')
      .order('window_opens', { ascending: false })
      .limit(1)
      .single();

    if (!cycle) return res.json({ sheet: null, goals: [], cycle: null });

    // Get or create sheet for this employee + cycle
    let { data: sheet } = await supabaseAdmin
      .from('goal_sheets')
      .select('*')
      .eq('employee_id', req.userProfile.id)
      .eq('cycle_id', cycle.id)
      .single();

    if (!sheet) {
      const { data: newSheet } = await supabaseAdmin
        .from('goal_sheets')
        .insert({ employee_id: req.userProfile.id, cycle_id: cycle.id })
        .select()
        .single();
      sheet = newSheet;
    }

    // Get goals + achievements
    const { data: goals } = await supabaseAdmin
      .from('goals')
      .select(`*, achievements(*)`)
      .eq('sheet_id', sheet.id)
      .order('sort_order');

    res.json({ sheet, goals: goals || [], cycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sheets — save/upsert goal sheet (draft)
app.post('/api/sheets', authenticate, async (req, res) => {
  const { goals } = req.body;
  if (!Array.isArray(goals)) return res.status(400).json({ error: 'goals must be an array' });

  try {
    // Get active cycle
    const { data: cycle } = await supabaseAdmin
      .from('cycles').select('id').eq('status', 'active').limit(1).single();
    if (!cycle) return res.status(400).json({ error: 'No active cycle' });

    // Get or create sheet
    let { data: sheet } = await supabaseAdmin
      .from('goal_sheets')
      .select('id, status')
      .eq('employee_id', req.userProfile.id)
      .eq('cycle_id', cycle.id)
      .single();

    if (sheet?.status === 'locked') {
      return res.status(403).json({ error: 'Sheet is locked. Request Admin unlock.' });
    }

    if (!sheet) {
      const { data: newSheet } = await supabaseAdmin
        .from('goal_sheets')
        .insert({ employee_id: req.userProfile.id, cycle_id: cycle.id })
        .select().single();
      sheet = newSheet;
    }

    // Delete old goals and re-insert (simple upsert strategy)
    await supabaseAdmin.from('goals').delete().eq('sheet_id', sheet.id);

    const goalsToInsert = goals.map((g, i) => ({
      sheet_id: sheet.id,
      thrust_area: g.thrust_area,
      title: g.title,
      description: g.description || null,
      uom_type: g.uom_type,
      target_value: g.target_value || g.target || '',
      target_date: g.target_date || null,  // ← already there, confirm this line exists
      weightage: parseFloat(g.weightage),
      sort_order: i,
    }));

    const { data: savedGoals, error } = await supabaseAdmin
      .from('goals').insert(goalsToInsert).select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({ sheet, goals: savedGoals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sheets/:sheetId/submit — submit for manager approval
app.post('/api/sheets/:sheetId/submit', authenticate, async (req, res) => {
  const { sheetId } = req.params;

  try {
    const { data: sheet } = await supabaseAdmin
      .from('goal_sheets').select('*, goals(*)')
      .eq('id', sheetId)
      .eq('employee_id', req.userProfile.id)
      .single();

    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    if (sheet.status === 'submitted') return res.status(400).json({ error: 'Already submitted' });

    // Validate
    const goals = sheet.goals || [];
    const errors = [];
    if (goals.length === 0) errors.push('Add at least 1 goal.');
    if (goals.length > 8)  errors.push('Maximum 8 goals allowed.');
    const totalWeight = goals.reduce((s, g) => s + parseFloat(g.weightage), 0);
    if (Math.abs(totalWeight - 100) > 0.01) errors.push(`Total weightage must be 100% (currently ${totalWeight.toFixed(1)}%).`);
    goals.forEach((g, i) => {
      if (parseFloat(g.weightage) < 10) errors.push(`Goal ${i+1}: Minimum weightage is 10%.`);
      if (!g.title?.trim()) errors.push(`Goal ${i+1}: Title is required.`);
    });

    if (errors.length > 0) return res.status(422).json({ errors });

    const { data: updated } = await supabaseAdmin
      .from('goal_sheets')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', sheetId)
      .select().single();

    await logAudit({
      entityType: 'goal_sheet', entityId: sheetId,
      actorId: req.userProfile.id, actorName: req.userProfile.full_name,
      action: 'submitted',
      newValue: { goals_count: goals.length, total_weightage: totalWeight }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/achievements — upsert achievement for a goal in a cycle
app.post('/api/achievements', authenticate, async (req, res) => {
  const { goal_id, cycle_id, actual_value, actual_date, progress_score, status, employee_notes } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('achievements')
      .upsert({
        goal_id, cycle_id,
        actual_value, actual_date: actual_date || null,
        progress_score: progress_score ?? null,
        status: status || 'not_started',
        employee_notes: employee_notes || null,
      }, { onConflict: 'goal_id,cycle_id' })
      .select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// MANAGER ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/manager/team-sheets — get all direct reports' sheets
app.get('/api/manager/team-sheets', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { data: teamMembers } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, department')
      .eq('manager_id', req.userProfile.id)
      .eq('is_active', true);

    if (!teamMembers?.length) return res.json([]);

    const teamIds = teamMembers.map(u => u.id);

    const { data: sheets } = await supabaseAdmin
      .from('goal_sheets')
      .select(`
        *,
        goals(*, achievements(*)),
        manager_checkins(*)
      `)
      .in('employee_id', teamIds)
      .order('submitted_at', { ascending: false });

    // Merge employee info
    const result = (sheets || []).map(sheet => ({
      ...sheet,
      employee: teamMembers.find(u => u.id === sheet.employee_id),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/manager/sheets/:sheetId/approve
app.patch('/api/manager/sheets/:sheetId/approve', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const { sheetId } = req.params;

  try {
    const { data: sheet } = await supabaseAdmin
      .from('goal_sheets').select('*, goals(*), users!employee_id(full_name)')
      .eq('id', sheetId).single();

    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });
    if (sheet.status !== 'submitted') return res.status(400).json({ error: 'Sheet must be submitted before approval' });

    // Validate weightage
    const total = (sheet.goals || []).reduce((s, g) => s + parseFloat(g.weightage), 0);
    if (Math.abs(total - 100) > 0.01) {
      return res.status(422).json({ error: `Cannot approve: total weightage is ${total}% (must be 100%)` });
    }

    const { data: updated } = await supabaseAdmin
      .from('goal_sheets')
      .update({
        status: 'locked',
        approved_at: new Date().toISOString(),
        approved_by: req.userProfile.id,
      })
      .eq('id', sheetId)
      .select().single();

    await logAudit({
      entityType: 'goal_sheet', entityId: sheetId,
      actorId: req.userProfile.id, actorName: req.userProfile.full_name,
      action: 'approved',
      newValue: { goals_count: sheet.goals.length }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/manager/sheets/:sheetId/return
app.patch('/api/manager/sheets/:sheetId/return', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const { sheetId } = req.params;
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: 'Return reason is required' });

  try {
    const { data: updated } = await supabaseAdmin
      .from('goal_sheets')
      .update({ status: 'returned', returned_at: new Date().toISOString(), return_reason: reason })
      .eq('id', sheetId).select().single();

    await logAudit({
      entityType: 'goal_sheet', entityId: sheetId,
      actorId: req.userProfile.id, actorName: req.userProfile.full_name,
      action: 'returned', reason
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/manager/goals/:goalId — inline edit goal during review
app.patch('/api/manager/goals/:goalId', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const { goalId } = req.params;
  const allowed = ['title', 'target_value', 'target_date', 'weightage', 'thrust_area', 'uom_type'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

  try {
    const { data: old } = await supabaseAdmin.from('goals').select('*').eq('id', goalId).single();
    const { data: updated, error } = await supabaseAdmin.from('goals').update(updates).eq('id', goalId).select().single();
    if (error) return res.status(400).json({ error: error.message });

    await logAudit({
      entityType: 'goal', entityId: goalId,
      actorId: req.userProfile.id, actorName: req.userProfile.full_name,
      action: 'edited', oldValue: old, newValue: updates
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/manager/checkins — save check-in comment
app.post('/api/manager/checkins', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const { sheet_id, cycle_id, comment, recommendation } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('manager_checkins')
      .upsert({
        sheet_id, cycle_id,
        manager_id: req.userProfile.id,
        comment, recommendation,
        checked_in_at: new Date().toISOString(),
      }, { onConflict: 'sheet_id,cycle_id' })
      .select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/reports/completion — dashboard stats
app.get('/api/admin/reports/completion', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { count: totalEmployees } = await supabaseAdmin
      .from('users').select('*', { count: 'exact', head: true })
      .eq('role', 'employee').eq('is_active', true);

    const { count: submitted } = await supabaseAdmin
      .from('goal_sheets').select('*', { count: 'exact', head: true })
      .in('status', ['submitted', 'approved', 'locked']);

    const { count: pending } = await supabaseAdmin
      .from('goal_sheets').select('*', { count: 'exact', head: true })
      .eq('status', 'submitted');

    // Department breakdown
    const { data: deptData } = await supabaseAdmin.rpc('get_dept_completion').catch(() => ({ data: [] }));

    // Manager completion rates
    const { data: managers } = await supabaseAdmin
      .from('users').select('id, full_name')
      .eq('role', 'manager').eq('is_active', true);

    const managerStats = await Promise.all((managers || []).map(async (mgr) => {
      const { count: teamSize } = await supabaseAdmin
        .from('users').select('*', { count: 'exact', head: true })
        .eq('manager_id', mgr.id).eq('is_active', true);
      const { count: checkins } = await supabaseAdmin
        .from('manager_checkins').select('*', { count: 'exact', head: true })
        .eq('manager_id', mgr.id);
      return { ...mgr, team_size: teamSize || 0, checkins_done: checkins || 0 };
    }));

    res.json({
      total_employees: totalEmployees || 0,
      goals_submitted: submitted || 0,
      pending_approval: pending || 0,
      submission_rate: totalEmployees ? Math.round((submitted / totalEmployees) * 100) : 0,
      manager_stats: managerStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit-log
app.get('/api/admin/audit-log', authenticate, requireRole('admin'), async (req, res) => {
  const { entity_id, limit = 50 } = req.query;
  try {
    let query = supabaseAdmin
      .from('audit_log').select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (entity_id) query = query.eq('entity_id', entity_id);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/shared-goals — push KPI to department
app.post('/api/admin/shared-goals', authenticate, requireRole('admin'), async (req, res) => {
  const { title, thrust_area, uom_type, target_value, target_date, department, cycle_id } = req.body;

  try {
    const { data: shared, error } = await supabaseAdmin
      .from('shared_goals')
      .insert({ title, thrust_area, uom_type, target_value, target_date, department, cycle_id, pushed_by: req.userProfile.id })
      .select().single();

    if (error) return res.status(400).json({ error: error.message });

    // Find target employees
    let empQuery = supabaseAdmin.from('users').select('id').eq('role', 'employee').eq('is_active', true);
    if (department) empQuery = empQuery.eq('department', department);
    const { data: employees } = await empQuery;

    // Get active cycle sheets and push goal to each
    const { data: sheets } = await supabaseAdmin
      .from('goal_sheets').select('id')
      .in('employee_id', (employees || []).map(e => e.id))
      .eq('cycle_id', cycle_id || '');

    let pushed = 0;
    for (const sheet of (sheets || [])) {
      await supabaseAdmin.from('goals').insert({
        sheet_id: sheet.id,
        thrust_area, title, uom_type, target_value,
        target_date: target_date || null,
        weightage: 10,  // default; employee can adjust
        is_shared: true,
        shared_from: shared.id,
      });
      pushed++;
    }

    await logAudit({
      entityType: 'shared_goal', entityId: shared.id,
      actorId: req.userProfile.id, actorName: req.userProfile.full_name,
      action: 'pushed_shared_goal',
      newValue: { department, pushed_to: pushed }
    });

    res.json({ ...shared, message: `Pushed to ${pushed} employees` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/sheets/:sheetId/unlock
app.post('/api/admin/sheets/:sheetId/unlock', authenticate, requireRole('admin'), async (req, res) => {
  const { sheetId } = req.params;
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: 'Unlock reason is required' });

  try {
    const { data: updated } = await supabaseAdmin
      .from('goal_sheets')
      .update({ status: 'approved' })  // back to approved so employee can edit
      .eq('id', sheetId).select().single();

    await logAudit({
      entityType: 'goal_sheet', entityId: sheetId,
      actorId: req.userProfile.id, actorName: req.userProfile.full_name,
      action: 'unlocked', reason
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/cycles/:cycleId
app.patch('/api/admin/cycles/:cycleId', authenticate, requireRole('admin'), async (req, res) => {
  const { cycleId } = req.params;
  const { status } = req.body;
  if (!['upcoming', 'active', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { data: updated, error } = await supabaseAdmin
      .from('cycles').update({ status }).eq('id', cycleId).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users — list all users (admin only)
app.get('/api/admin/users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users').select('*').order('full_name');
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:userId — update user role/manager
app.patch('/api/admin/users/:userId', authenticate, requireRole('admin'), async (req, res) => {
  const { userId } = req.params;
  const allowed = ['role', 'manager_id', 'department', 'is_active'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

  try {
    const { data, error } = await supabaseAdmin
      .from('users').update(updates).eq('id', userId).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH CHECK ───
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── START ───
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ AtomQuest API running on http://localhost:${PORT}`));