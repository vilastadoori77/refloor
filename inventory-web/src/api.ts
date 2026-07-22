// Typed fetch wrappers for the Inventory Service (WEB-003 isolation invariant).
//
// The browser ONLY ever talks to `/api/*`. There is deliberately no code path
// here that can reach `/BC/*` or any middleware URL — that is the whole point
// of the service layer. Every network read in the app goes through one of the
// functions below, which all funnel through `getJson`.

import type {
  ApiEnvelope,
  ConsolidatedItem,
  LocationOption,
  ProjectView,
  SaleHeader,
  StatusResponse,
} from '@inventory/shared';

// Base path. In dev, VITE_API_BASE_URL is unset → '' → relative '/api', which the
// Vite proxy forwards to the service on :4100. In Azure, deploy injects
// VITE_API_BASE_URL = the inventory-service HTTPS URL at build time (AZ-012), so
// calls go straight to the service host. Either way the browser only ever reaches
// the service — never the middleware (WEB-003).
const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`;

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Central JSON fetch. Throws {@link ApiError} on non-2xx (e.g. 503). */
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.text();
      if (body) detail = body;
    } catch {
      /* ignore body read errors */
    }
    throw new ApiError(res.status, `GET ${url} failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as T;
}

export interface InventoryFilterParams {
  location?: string;
  category?: string;
  search?: string;
}

function buildQuery(params: InventoryFilterParams): string {
  const qs = new URLSearchParams();
  if (params.location && params.location !== 'All') qs.set('location', params.location);
  if (params.category && params.category !== 'All') qs.set('category', params.category);
  if (params.search && params.search.trim() && params.search !== 'All') {
    qs.set('search', params.search.trim());
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// GET /api/inventory?location=&category=&search=
export function getInventory(
  params: InventoryFilterParams = {},
  signal?: AbortSignal,
): Promise<ApiEnvelope<ConsolidatedItem[]>> {
  return getJson<ApiEnvelope<ConsolidatedItem[]>>(
    `${API_BASE}/inventory${buildQuery(params)}`,
    signal,
  );
}

// GET /api/locations
export function getLocations(signal?: AbortSignal): Promise<ApiEnvelope<LocationOption[]>> {
  return getJson<ApiEnvelope<LocationOption[]>>(`${API_BASE}/locations`, signal);
}

// GET /api/categories
export function getCategories(signal?: AbortSignal): Promise<ApiEnvelope<string[]>> {
  return getJson<ApiEnvelope<string[]>>(`${API_BASE}/categories`, signal);
}

// GET /api/projects
export function getProjects(signal?: AbortSignal): Promise<ApiEnvelope<SaleHeader[]>> {
  return getJson<ApiEnvelope<SaleHeader[]>>(`${API_BASE}/projects`, signal);
}

// GET /api/projects/:projectNo  (may return 503 — caller handles ApiError)
export function getProject(
  projectNo: string,
  signal?: AbortSignal,
): Promise<ApiEnvelope<ProjectView>> {
  return getJson<ApiEnvelope<ProjectView>>(
    `${API_BASE}/projects/${encodeURIComponent(projectNo)}`,
    signal,
  );
}

// GET /api/status  (NOT enveloped — returns StatusResponse directly)
export function getStatus(signal?: AbortSignal): Promise<StatusResponse> {
  return getJson<StatusResponse>(`${API_BASE}/status`, signal);
}

// PUT /api/admin/config — optional admin control for refreshSeconds (WEB-063,
// SVC-011). This is deliberately SEPARATE from the header's cache-only refresh
// (WEB-006): it changes the service refresh cadence and is protected per SVC-045.
export async function putConfig(body: { refreshSeconds: number }): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `PUT /api/admin/config failed (${res.status})`);
  }
}
