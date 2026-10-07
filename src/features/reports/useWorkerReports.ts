import { useCallback, useEffect, useState } from 'react';
import { ChiefApiError, type DataProvenance } from '../../api/types';
import {
  getWorkerReports,
  submitWorkerReport,
  type WorkerReportOverview,
  type WorkerReportPayload,
  type WorkerReportReceipt
} from '../../api/reports';
import type { StaffIdentity } from '../../types/capabilities';
import { developmentReportOverview } from './fixtures';

interface ReportResourceState {
  data: WorkerReportOverview | null;
  provenance: DataProvenance;
  fetchedAt: number | null;
  error: ChiefApiError | null;
}

function unavailable(): ReportResourceState {
  return { data: null, provenance: 'unavailable', fetchedAt: null, error: null };
}

export function reportEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `report_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export function useWorkerReports(identity: StaffIdentity) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<ReportResourceState>(() => identity.isSimulated
    ? { data: developmentReportOverview, provenance: 'mock_isolated', fetchedAt: null, error: null }
    : unavailable());
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<ChiefApiError | null>(null);
  const [lastReceipt, setLastReceipt] = useState<WorkerReportReceipt | null>(null);

  useEffect(() => {
    if (identity.isSimulated) {
      setState({ data: developmentReportOverview, provenance: 'mock_isolated', fetchedAt: null, error: null });
      setSubmissionError(null);
      setLastReceipt(null);
      return;
    }
    const controller = new AbortController();
    setState(unavailable());
    void getWorkerReports(controller.signal)
      .then(response => {
        if (controller.signal.aborted) return;
        setState({ data: response.data, provenance: response.provenance, fetchedAt: response.fetchedAt, error: null });
      })
      .catch(cause => {
        if (controller.signal.aborted) return;
        const error = cause instanceof ChiefApiError ? cause : new ChiefApiError({
          message: 'Chief worker-report history could not be interpreted.',
          origin: 'protocol', code: 'UNKNOWN_REPORT_HISTORY_ERROR', details: cause
        });
        setState({ data: null, provenance: 'unavailable', fetchedAt: null, error });
      });
    return () => controller.abort();
  }, [identity.isSimulated, identity.userId, generation]);

  const refresh = useCallback(() => setGeneration(value => value + 1), []);

  const submit = useCallback(async (payload: WorkerReportPayload): Promise<WorkerReportReceipt | null> => {
    setSubmissionError(null);
    setLastReceipt(null);
    if (identity.isSimulated) {
      setSubmissionError(new ChiefApiError({
        message: 'Development report fixtures are read-only and cannot submit evidence to Chief.',
        origin: 'client', code: 'DEV_REPORT_SUBMISSION_BLOCKED'
      }));
      return null;
    }
    setSubmitting(true);
    try {
      const response = await submitWorkerReport(payload);
      const receipt = response.data;
      if (!['RECEIVED', 'ALREADY_RECEIVED'].includes(receipt.status) || receipt.evidence_status !== 'HUMAN_REPORTED' || !receipt.report_id) {
        throw new ChiefApiError({
          message: 'Chief response did not confirm a valid human-reported receipt.',
          origin: 'protocol', code: 'UNCONFIRMED_REPORT_RECEIPT', details: receipt
        });
      }
      setLastReceipt(receipt);
      refresh();
      return receipt;
    } catch (cause) {
      const error = cause instanceof ChiefApiError ? cause : new ChiefApiError({
        message: 'Report submission failed before Chief receipt confirmation.',
        origin: 'protocol', code: 'UNKNOWN_REPORT_SUBMISSION_ERROR', details: cause
      });
      setSubmissionError(error);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [identity.isSimulated, refresh]);

  return { ...state, submitting, submissionError, lastReceipt, refresh, submit };
}
