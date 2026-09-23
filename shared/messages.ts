import type { ScanOptions, ScanPayload } from './types';

export type ContentRequest =
  | { type: 'PING' }
  | { type: 'SCAN_PAGE'; options: ScanOptions }
  | { type: 'CLEAR_HIGHLIGHTS' }
  | { type: 'LOCATE_RESULT'; resultId: string };

export type BackgroundRequest =
  | { type: 'GET_ACTIVE_TAB' }
  | { type: 'ENSURE_CONTENT_SCRIPT'; tabId: number };

export type BackgroundResponse =
  | { ok: true; tab?: chrome.tabs.Tab }
  | { ok: false; code: 'NO_TAB' | 'RESTRICTED_PAGE' | 'PERMISSION_REQUIRED' | 'INJECTION_FAILED'; message: string };

export interface DynamicScanMessage {
  type: 'DYNAMIC_SCAN_RESULTS';
  payload: ScanPayload;
}

export const isDynamicScanMessage = (value: unknown): value is DynamicScanMessage => {
  if (!value || typeof value !== 'object') return false;
  return (value as { type?: string }).type === 'DYNAMIC_SCAN_RESULTS';
};
