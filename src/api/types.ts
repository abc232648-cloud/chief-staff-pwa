export type DataProvenance = 'live' | 'cached' | 'mock_isolated' | 'unavailable';

export type ApiErrorOrigin = 'chief' | 'transport' | 'client' | 'protocol';

export interface ApiResponse<T> {
  data: T;
  status: number;
  correlationId: string | null;
  fetchedAt: number;
  provenance: 'live';
}

export class ChiefApiError extends Error {
  readonly origin: ApiErrorOrigin;
  readonly status?: number;
  readonly code: string;
  readonly correlationId?: string | null;
  readonly details?: unknown;

  constructor(params: {
    message: string;
    origin: ApiErrorOrigin;
    code: string;
    status?: number;
    correlationId?: string | null;
    details?: unknown;
  }) {
    super(params.message);
    this.name = 'ChiefApiError';
    this.origin = params.origin;
    this.status = params.status;
    this.code = params.code;
    this.correlationId = params.correlationId;
    this.details = params.details;
  }
}

export interface ResourceState<T> {
  data: T | null;
  provenance: DataProvenance;
  fetchedAt: number | null;
  error: ChiefApiError | null;
}

export const unavailableResource = <T>(error: ChiefApiError | null = null): ResourceState<T> => ({
  data: null,
  provenance: 'unavailable',
  fetchedAt: null,
  error
});
