/**
 * Outage-switch state (MOCK-070 / MOCK-071).
 *
 * When enabled, the listed endpoints answer `500 { error: "simulated outage" }`.
 * An empty/omitted endpoint list means "all endpoints".
 */

export type OutageEndpoint = 'inventory' | 'purchaseOrders' | 'demand' | 'project';

export const ALL_ENDPOINTS: OutageEndpoint[] = [
  'inventory',
  'purchaseOrders',
  'demand',
  'project',
];

export interface OutageState {
  enabled: boolean;
  endpoints: OutageEndpoint[];
}

export interface OutageController {
  isDown(endpoint: OutageEndpoint): boolean;
  setOutage(enabled: boolean, endpoints?: OutageEndpoint[]): OutageState;
  getState(): OutageState;
}

export function makeOutage(): OutageController {
  let enabled = false;
  // Empty list = "all" when enabled.
  let endpoints: OutageEndpoint[] = [];

  return {
    isDown(endpoint: OutageEndpoint): boolean {
      if (!enabled) return false;
      return endpoints.length === 0 || endpoints.includes(endpoint);
    },
    setOutage(next: boolean, eps?: OutageEndpoint[]): OutageState {
      enabled = next;
      endpoints = Array.isArray(eps) ? eps.filter((e) => ALL_ENDPOINTS.includes(e)) : [];
      return this.getState();
    },
    getState(): OutageState {
      return {
        enabled,
        endpoints: endpoints.length === 0 ? ALL_ENDPOINTS.slice() : endpoints.slice(),
      };
    },
  };
}
