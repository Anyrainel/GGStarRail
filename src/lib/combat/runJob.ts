import {
  type CombatCatalog,
  type CompareEntry,
  type CompareRequest,
  compareJob,
  type IdealRequest,
  type IdealResponse,
  type InvestmentRequest,
  type InvestmentResponse,
  idealJob,
  investmentJob,
  type OptimizeRequest,
  type OptimizeResponse,
  optimizeJob,
  type SimulateResponse,
  simulateJob,
  type TeamRequest,
} from "./jobs";

export type CombatJob =
  | { kind: "simulate"; request: TeamRequest }
  | { kind: "optimize"; request: OptimizeRequest }
  | { kind: "ideal"; request: IdealRequest }
  | { kind: "compare"; request: CompareRequest }
  | { kind: "investment"; request: InvestmentRequest };

interface CombatJobResults {
  simulate: SimulateResponse;
  optimize: OptimizeResponse;
  ideal: IdealResponse;
  compare: CompareEntry[];
  investment: InvestmentResponse;
}

export type CombatJobResult<K extends CombatJob["kind"]> = CombatJobResults[K];

export interface CombatJobMessage {
  id: number;
  job: CombatJob;
  beta: boolean;
}

function dispatch(catalog: CombatCatalog, job: CombatJob): unknown {
  switch (job.kind) {
    case "simulate":
      return simulateJob(catalog, job.request);
    case "optimize":
      return optimizeJob(catalog, job.request);
    case "ideal":
      return idealJob(catalog, job.request);
    case "compare":
      return compareJob(catalog, job.request);
    case "investment":
      return investmentJob(catalog, job.request);
  }
}

export function runJob<K extends CombatJob["kind"]>(
  catalog: CombatCatalog,
  job: Extract<CombatJob, { kind: K }>
): CombatJobResult<K> {
  return dispatch(catalog, job) as CombatJobResult<K>;
}
