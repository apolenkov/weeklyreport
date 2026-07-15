export interface AdminJobHandle {
  readonly id?: string;
  readonly name: string;
  readonly failedReason?: string | null;
  readonly stacktrace?: readonly string[];
  readonly attemptsMade?: number;
  readonly timestamp: number;
  readonly data: unknown;
  retry(): Promise<void>;
  remove(): Promise<void>;
}

export interface AdminJobsQueue {
  getFailed(start: number, end: number): Promise<readonly AdminJobHandle[]>;
  getJob(id: string): Promise<AdminJobHandle | undefined>;
}
