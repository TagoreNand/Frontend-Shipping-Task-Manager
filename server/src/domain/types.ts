export type TaskStatus = 'backlog' | 'in-progress' | 'complete';
export type ShipMode = 'ocean' | 'air' | 'rail' | 'ground';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  ref: string;
  title: string;
  description: string;
  mode: ShipMode;
  origin: string;
  destination: string;
  priority: Priority;
  status: TaskStatus;
  etaAt: string;
  updatedAt: string;
  order: string;
  /** Customer (username) who owns this shipment; undefined = internal/unassigned. */
  owner?: string;
  transaction?: Transaction;
}

export type TxnCustomerStatus = 'pending' | 'processing' | 'cleared' | 'failed';
export type RiskDecision = 'approve' | 'review' | 'block';
export type ReviewStatus = 'auto' | 'pending' | 'approved' | 'blocked';

/** Internal risk assessment — redacted from non-admin (customer) views. */
export interface TransactionRisk {
  score: number;
  decision: RiskDecision;
  reasons: string[];
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  accountAgeDays: number;
  restrictedLane: boolean;
  customerStatus: TxnCustomerStatus;
  createdAt: string;
  risk?: TransactionRisk;
}

export interface MoveTaskInput {
  toStatus: TaskStatus;
  toIndex: number;
}
