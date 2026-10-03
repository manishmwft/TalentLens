import { CandidateEvent } from '../models/CandidateEvent.js';

export async function recordCandidateEvent({
  organization,
  screening,
  candidate,
  interview = null,
  actor = null,
  type,
  title,
  description = '',
  metadata = {},
  occurredAt = new Date(),
}) {
  return CandidateEvent.create({
    organization,
    screening,
    candidate,
    interview,
    actor: actor?._id || actor || null,
    actorName: actor?.name || 'System',
    actorRole: actor?.role || 'system',
    type,
    title,
    description,
    metadata,
    occurredAt,
  });
}

export function serializeCandidateEvent(event) {
  return {
    id: event._id?.toString?.() || String(event.id || ''),
    type: event.type,
    title: event.title,
    description: event.description || '',
    actor: {
      id: event.actor?._id?.toString?.() || event.actor?.toString?.() || null,
      name: event.actor?.name || event.actorName || 'System',
      role: event.actor?.role || event.actorRole || 'system',
    },
    metadata: event.metadata || {},
    interviewId: event.interview?._id?.toString?.() || event.interview?.toString?.() || null,
    occurredAt: event.occurredAt || event.createdAt,
    source: event.source || 'event',
  };
}
