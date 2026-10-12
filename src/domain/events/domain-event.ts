// Envelope shared by every event this service publishes (CLAUDE.md: eventId,
// eventType, version, occurredAt, aggregate id). The trace context is added
// by the outbox writer as a message header.
export interface DomainEvent<T = unknown> {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  aggregateId: string;
  topic: string;
  data: T;
}
