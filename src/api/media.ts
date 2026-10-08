import { chiefApiClient } from './client';
import type { ApiResponse } from './types';

export interface FarmPhotoMetadata {
  id: string;
  work_id: string;
  actor_id: string;
  received_at: string;
  sha256: string;
  bytes: number;
}

export interface FarmPhotoUploadPayload {
  event_id: string;
  work_id: string;
  image_base64: string;
}

export interface FarmPhotoReceipt {
  status: 'RECORDED' | 'ALREADY_RECORDED';
  record: FarmPhotoMetadata;
}

export function uploadFarmPhoto(payload: FarmPhotoUploadPayload, signal?: AbortSignal): Promise<ApiResponse<FarmPhotoReceipt>> {
  return chiefApiClient.post<FarmPhotoReceipt>('/api/farm/photos', payload, signal);
}

export function getFarmPhotos(workId: string, signal?: AbortSignal): Promise<ApiResponse<FarmPhotoMetadata[]>> {
  return chiefApiClient.get<FarmPhotoMetadata[]>(`/api/farm/photos?work_id=${encodeURIComponent(workId)}`, signal);
}

export async function blobSha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}
