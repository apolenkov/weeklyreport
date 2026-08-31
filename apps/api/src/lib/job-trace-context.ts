/** Optional W3C trace and request correlation data carried by queue jobs. */
export interface JobTraceContext {
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly correlationId?: string;
}
