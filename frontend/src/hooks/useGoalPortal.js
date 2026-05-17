/**
 * AtomQuest Goal Portal — React Query Hooks
 * All API calls go through these hooks for caching + optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { toast } from "react-hot-toast";

// ─── API client ───
async function api(method, path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.errors?.[0] || 'Request failed');
  return json;
}

const get  = (path)          => api('GET',   path);
const post = (path, body)    => api('POST',  path, body);
const patch= (path, body)    => api('PATCH', path, body);

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────
// EMPLOYEE HOOKS
// ─────────────────────────────────────────────
export function useMySheet() {
  return useQuery({
    queryKey: ['mySheet'],
    queryFn: () => get('/sheets/my'),
  });
}

export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goals) => post('/sheets', { goals }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mySheet'] }),
    onError: (e) => toast.error(e.message),
  });
}

export function useSubmitSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sheetId) => post(`/sheets/${sheetId}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mySheet'] });
      toast.success('Goal sheet submitted for approval!');
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useUpsertAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => post('/achievements', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mySheet'] });
      qc.invalidateQueries({ queryKey: ['teamSheets'] });
      toast.success('Achievement saved');
    },
    onError: (e) => toast.error(e.message),
  });
}

// ─────────────────────────────────────────────
// MANAGER HOOKS
// ─────────────────────────────────────────────
export function useTeamSheets() {
  return useQuery({
    queryKey: ['teamSheets'],
    queryFn: () => get('/manager/team-sheets'),
  });
}

export function useApproveSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sheetId) => patch(`/manager/sheets/${sheetId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teamSheets'] });
      toast.success('Goal sheet approved and locked!');
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useReturnSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sheetId, reason }) => patch(`/manager/sheets/${sheetId}/return`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teamSheets'] });
      toast.success('Sheet returned for rework');
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useEditGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, ...data }) => patch(`/manager/goals/${goalId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teamSheets'] }),
    onError: (e) => toast.error(e.message),
  });
}

export function useSaveCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => post('/manager/checkins', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teamSheets'] });
      toast.success('Check-in comment saved');
    },
    onError: (e) => toast.error(e.message),
  });
}

// ─────────────────────────────────────────────
// ADMIN HOOKS
// ─────────────────────────────────────────────
export function useCompletionDashboard() {
  return useQuery({
    queryKey: ['completionDashboard'],
    queryFn: () => get('/admin/reports/completion'),
    refetchInterval: 30_000, // poll every 30s for real-time dashboard
  });
}

export function useAuditLog(entityId) {
  return useQuery({
    queryKey: ['auditLog', entityId],
    queryFn: () => get(`/admin/audit-log${entityId ? `?entity_id=${entityId}` : ''}`),
  });
}

export function usePushSharedGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => post('/admin/shared-goals', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['completionDashboard'] });
      toast.success(res.message);
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useUnlockSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sheetId, reason }) => post(`/admin/sheets/${sheetId}/unlock`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teamSheets'] });
      qc.invalidateQueries({ queryKey: ['auditLog'] });
      toast.success('Sheet unlocked. Change logged to audit trail.');
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useUpdateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cycleId, status }) => patch(`/admin/cycles/${cycleId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycles'] });
      toast.success('Cycle window updated');
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useCycles() {
  return useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const { data } = await supabase.from('cycles').select('*').order('window_opens');
      return data;
    },
  });
}