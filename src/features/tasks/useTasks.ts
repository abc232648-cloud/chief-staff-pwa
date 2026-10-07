import { useCallback, useEffect, useState } from 'react';
import { ChiefApiError, type DataProvenance } from '../../api/types';
import {
  getFarmTasks,
  mutateFarmTask,
  type FarmTask,
  type FarmTaskCreate,
  type FarmTaskMutation,
  type FarmTaskOverview
} from '../../api/farm';
import type { StaffIdentity } from '../../types/capabilities';
import { taskFixturesFor } from './fixtures';

interface TaskResourceState {
  data: FarmTaskOverview | null;
  provenance: DataProvenance;
  fetchedAt: number | null;
  error: ChiefApiError | null;
}

export type TaskOperation = 'ACKNOWLEDGE' | 'START' | 'SUBMIT' | 'VERIFY' | 'REQUEST_CORRECTION' | 'ESCALATE' | 'CANCEL';

function unavailable(): TaskResourceState {
  return { data: null, provenance: 'unavailable', fetchedAt: null, error: null };
}

export function taskEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `staff_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

function commandFor(task: FarmTask, operation: TaskOperation, detail: string): FarmTaskMutation {
  const base = { event_id: taskEventId(), task_id: task.task_id, expected_revision: task.revision };
  if (operation === 'ACKNOWLEDGE' || operation === 'START') return { ...base, operation };
  if (operation === 'SUBMIT' || operation === 'VERIFY' || operation === 'REQUEST_CORRECTION') {
    return { ...base, operation, note: detail.trim() };
  }
  return { ...base, operation, reason: detail.trim() };
}

export function useTasks(identity: StaffIdentity) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<TaskResourceState>(() => identity.isSimulated
    ? { data: taskFixturesFor(identity.role), provenance: 'mock_isolated', fetchedAt: null, error: null }
    : unavailable());
  const [mutatingTaskId, setMutatingTaskId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<ChiefApiError | null>(null);

  useEffect(() => {
    if (identity.isSimulated) {
      setState({ data: taskFixturesFor(identity.role), provenance: 'mock_isolated', fetchedAt: null, error: null });
      setMutationError(null);
      return;
    }

    const controller = new AbortController();
    setState(unavailable());
    void getFarmTasks(controller.signal)
      .then(response => {
        if (controller.signal.aborted) return;
        setState({ data: response.data, provenance: response.provenance, fetchedAt: response.fetchedAt, error: null });
      })
      .catch(cause => {
        if (controller.signal.aborted) return;
        const error = cause instanceof ChiefApiError ? cause : new ChiefApiError({
          message: 'Chief task state could not be interpreted.', origin: 'protocol', code: 'UNKNOWN_TASK_ERROR', details: cause
        });
        setState({ data: null, provenance: 'unavailable', fetchedAt: null, error });
      });
    return () => controller.abort();
  }, [identity.isSimulated, identity.role, identity.userId, generation]);

  const refresh = useCallback(() => setGeneration(value => value + 1), []);

  const perform = useCallback(async (command: FarmTaskMutation, mutationKey: string): Promise<boolean> => {
    setMutationError(null);
    if (identity.isSimulated) {
      setMutationError(new ChiefApiError({
        message: 'Development task fixtures are read-only and cannot create Chief task events.',
        origin: 'client', code: 'DEV_TASK_MUTATION_BLOCKED'
      }));
      return false;
    }
    setMutatingTaskId(mutationKey);
    try {
      const response = await mutateFarmTask(command);
      if (!['RECORDED', 'ALREADY_RECORDED'].includes(response.data.status) || !response.data.revision) {
        throw new ChiefApiError({
          message: 'Chief did not confirm a valid task event receipt.',
          origin: 'protocol', code: 'UNCONFIRMED_TASK_EVENT', details: response.data
        });
      }
      refresh();
      return true;
    } catch (cause) {
      const error = cause instanceof ChiefApiError ? cause : new ChiefApiError({
        message: 'Task action failed before Chief confirmation.', origin: 'protocol', code: 'UNKNOWN_TASK_MUTATION_ERROR', details: cause
      });
      setMutationError(error);
      return false;
    } finally {
      setMutatingTaskId(null);
    }
  }, [identity.isSimulated, refresh]);

  const act = useCallback((task: FarmTask, operation: TaskOperation, detail = '') => {
    return perform(commandFor(task, operation, detail), task.task_id);
  }, [perform]);

  const create = useCallback((command: FarmTaskCreate) => {
    return perform(command, 'CREATE');
  }, [perform]);

  const reassign = useCallback((task: FarmTask, assignedTo: string, supervisorId: string | null, reason: string) => {
    return perform({
      event_id: taskEventId(),
      operation: 'REASSIGN',
      task_id: task.task_id,
      expected_revision: task.revision,
      assigned_to: assignedTo,
      supervisor_id: supervisorId,
      reason: reason.trim()
    }, task.task_id);
  }, [perform]);

  return { ...state, refresh, act, create, reassign, mutatingTaskId, mutationError };
}
