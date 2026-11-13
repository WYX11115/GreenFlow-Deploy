/**
 * Phase 3 keeps evidence and rejected-attempt metadata in resettable process memory for the
 * single-presenter demo. This boundary is reserved for a future SQLite migration if metadata must
 * survive restarts. Chain state must never be copied here as an authoritative balance or
 * permission source.
 */
export const metadataSchemaPhase = 3 as const;

