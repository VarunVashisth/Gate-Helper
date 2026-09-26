import type { GateHelperApi } from '../../shared/contracts/api';

declare global {
  interface Window {
    gateHelper: GateHelperApi;
  }
}

export {};

