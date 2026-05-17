/**
 * AtomQuest Goal Portal — Scoring Engine
 * Computes progress scores based on UoM type (BRD Section 2.2)
 */

/**
 * @typedef {'min_numeric'|'max_numeric'|'timeline'|'zero'} UomType
 * @typedef {'not_started'|'on_track'|'completed'} CheckinStatus
 *
 * @typedef {Object} ScoreResult
 * @property {number|null} score        - 0–100+ (null if not computable)
 * @property {string}      display      - Human-readable e.g. "87.5%"
 * @property {CheckinStatus} status     - Derived status
 * @property {string}      color        - CSS variable name
 */

/**
 * Compute progress score for a goal based on UoM type.
 *
 * @param {UomType}     uomType
 * @param {string|number} target      - Planned target value
 * @param {string|number} actual      - Actual achievement value
 * @param {Date|string} [targetDate]  - Deadline (Timeline UoM only)
 * @param {Date|string} [actualDate]  - Completion date (Timeline UoM only)
 * @returns {ScoreResult}
 */
export function computeScore(uomType, target, actual, targetDate = null, actualDate = null) {
  switch (uomType) {
    case 'min_numeric': return scoreMin(target, actual);
    case 'max_numeric': return scoreMax(target, actual);
    case 'timeline':    return scoreTimeline(targetDate, actualDate);
    case 'zero':        return scoreZero(actual);
    default:
      return { score: null, display: '—', status: 'not_started', color: 'var(--text3)' };
  }
}

/**
 * Min (Numeric / %) — Higher is better, e.g. Sales Revenue
 * Formula: Achievement ÷ Target × 100
 */
function scoreMin(target, actual) {
  const t = parseFloat(target);
  const a = parseFloat(actual);
  if (isNaN(t) || isNaN(a) || t === 0) return notComputable();
  const score = (a / t) * 100;
  return buildResult(score);
}

/**
 * Max (Numeric / %) — Lower is better, e.g. TAT, Cost
 * Formula: Target ÷ Achievement × 100
 */
function scoreMax(target, actual) {
  const t = parseFloat(target);
  const a = parseFloat(actual);
  if (isNaN(t) || isNaN(a) || a === 0) return notComputable();
  const score = (t / a) * 100;
  return buildResult(score);
}

/**
 * Timeline — Date-based completion
 * If completed on or before deadline → 100%
 * If completed after deadline → penalty proportional to days late
 * If not yet completed → estimate based on days elapsed
 */
function scoreTimeline(targetDate, actualDate) {
  if (!targetDate) return notComputable();

  const deadline = new Date(targetDate);
  const now = new Date();

  if (actualDate) {
    // Already completed
    const completed = new Date(actualDate);
    const daysLate = Math.floor((completed - deadline) / (1000 * 60 * 60 * 24));
    if (daysLate <= 0) {
      return buildResult(100); // On time or early
    }
    // 5% penalty per day late, floor at 0
    const penalty = Math.min(daysLate * 5, 100);
    return buildResult(Math.max(0, 100 - penalty));
  }

  // Not yet completed — estimate from time elapsed
  const totalDays = Math.floor((deadline - now) / (1000 * 60 * 60 * 24));
  if (totalDays < 0) {
    return buildResult(0); // Past deadline, not done
  }
  return { score: null, display: `${totalDays}d left`, status: 'on_track', color: 'var(--accent)' };
}

/**
 * Zero — Zero = Success (e.g. Safety incidents)
 * Formula: If actual = 0 → 100%, else 0%
 */
function scoreZero(actual) {
  const a = parseFloat(actual);
  if (isNaN(a)) return notComputable();
  const score = a === 0 ? 100 : 0;
  return buildResult(score);
}

// ─── Helpers ───

function buildResult(score) {
  const rounded = Math.round(score * 10) / 10;
  return {
    score: rounded,
    display: rounded + '%',
    status: deriveStatus(rounded),
    color: scoreColor(rounded),
  };
}

function notComputable() {
  return { score: null, display: '—', status: 'not_started', color: 'var(--text3)' };
}

/**
 * Derive check-in status from score
 * ≥ 80  → completed / on track (green)
 * 50–79 → on track (amber)
 * < 50  → at risk (red)
 */
function deriveStatus(score) {
  if (score >= 100) return 'completed';
  if (score >= 50)  return 'on_track';
  return 'not_started';
}

function scoreColor(score) {
  if (score >= 80)  return 'var(--green)';
  if (score >= 50)  return 'var(--amber)';
  return 'var(--red)';
}

/**
 * Compute weighted overall score for an entire goal sheet.
 * Only includes goals that have a computable score.
 *
 * @param {Array<{weightage: number, score: number|null}>} goals
 * @returns {{ overallScore: number, display: string, color: string }}
 */
export function computeSheetScore(goals) {
  const scoredGoals = goals.filter(g => g.score !== null);
  if (scoredGoals.length === 0) return { overallScore: 0, display: '—', color: 'var(--text3)' };

  const totalWeight = scoredGoals.reduce((sum, g) => sum + g.weightage, 0);
  if (totalWeight === 0) return { overallScore: 0, display: '—', color: 'var(--text3)' };

  const weightedSum = scoredGoals.reduce((sum, g) => sum + (g.score * g.weightage), 0);
  const overall = Math.round((weightedSum / totalWeight) * 10) / 10;

  return {
    overallScore: overall,
    display: overall + '%',
    color: scoreColor(overall),
  };
}

/**
 * Validate a goal sheet before submission.
 * Returns array of error messages (empty = valid).
 *
 * @param {Array<{weightage: number, title: string, target: string}>} goals
 * @returns {string[]}
 */
export function validateSheet(goals) {
  const errors = [];

  if (goals.length === 0) errors.push('Add at least 1 goal before submitting.');
  if (goals.length > 8)  errors.push('Maximum 8 goals allowed per employee.');

  const totalWeight = goals.reduce((s, g) => s + (parseFloat(g.weightage) || 0), 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    errors.push(`Total weightage must equal 100%. Currently: ${totalWeight.toFixed(1)}%`);
  }

  goals.forEach((g, i) => {
  const w = parseFloat(g.weightage) || 0;
  if (w < 10) errors.push(`Goal ${i + 1}: Minimum weightage is 10% (currently ${w}%).`);
  if (!g.title?.trim()) errors.push(`Goal ${i + 1}: Title is required.`);
  
  // Timeline goals use target_date, others use target
  const targetVal = g.uom_type === 'timeline' 
    ? (g.target_date || g.target) 
    : (g.target || g.target_value);
  if (!targetVal?.trim()) errors.push(`Goal ${i + 1}: Target is required.`);
});

  return errors;
}