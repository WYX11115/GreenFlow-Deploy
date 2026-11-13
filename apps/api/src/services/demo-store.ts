import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { EvidenceView, MilestoneId, RejectedAttemptView } from '@greenflow/shared';

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const M1_SAMPLE_PATH = new URL('../../../web/public/assets/M1-equipment-delivery-demo.pdf', import.meta.url);

interface StoredEvidence extends EvidenceView {
  bytes: Buffer;
}

export class DemoStore {
  #evidence = new Map<string, StoredEvidence>();
  #attempts: RejectedAttemptView[] = [];

  addEvidence(milestoneId: MilestoneId, fileName: string, mimeType: string, bytes: Buffer): EvidenceView {
    if (!ALLOWED_TYPES.has(mimeType)) throw new Error('UNSUPPORTED_EVIDENCE_TYPE');
    if (bytes.length === 0 || bytes.length > MAX_EVIDENCE_BYTES) {
      throw new Error('INVALID_EVIDENCE_SIZE');
    }
    const id = randomUUID();
    const item: StoredEvidence = {
      id,
      milestoneId,
      fileName: fileName.slice(0, 120),
      mimeType: mimeType as EvidenceView['mimeType'],
      size: bytes.length,
      sha256: `0x${createHash('sha256').update(bytes).digest('hex')}`,
      createdAt: new Date().toISOString(),
      fileUrl: `/api/evidence/${id}/file`,
      bytes
    };
    this.#evidence.set(id, item);
    return this.publicEvidence(item);
  }

  addSample(milestoneId: MilestoneId): EvidenceView {
    const description = milestoneId === 'M1' ? 'equipment delivery' : 'installation completion';
    const bytes = milestoneId === 'M1'
      ? readFileSync(M1_SAMPLE_PATH)
      : Buffer.from(
          '%PDF-1.4\n% GreenFlow fictional evidence\n1 0 obj<</Type/Catalog>>endobj\n' +
            `2 0 obj<</Length 87>>stream\nSolarSupply ${description} certificate. ` +
            'Fictional teaching-demo document; no real-world impact claim.\nendstream\nendobj\n%%EOF\n'
        );
    return this.addEvidence(milestoneId, `${milestoneId}-${description.replaceAll(' ', '-')}-demo.pdf`, 'application/pdf', bytes);
  }

  getEvidence(id: string): EvidenceView | undefined {
    const item = this.#evidence.get(id);
    return item ? this.publicEvidence(item) : undefined;
  }

  getEvidenceBytes(id: string): { item: EvidenceView; bytes: Buffer } | undefined {
    const stored = this.#evidence.get(id);
    if (!stored) return undefined;
    return { item: this.publicEvidence(stored), bytes: stored.bytes };
  }

  evidence(): EvidenceView[] {
    return [...this.#evidence.values()].map((item) => this.publicEvidence(item));
  }

  addAttempt(attempt: Omit<RejectedAttemptView, 'id' | 'createdAt'>) {
    const item = { ...attempt, id: randomUUID(), createdAt: new Date().toISOString() };
    this.#attempts.unshift(item);
    return item;
  }

  attempts(): RejectedAttemptView[] {
    return [...this.#attempts];
  }

  reset() {
    this.#evidence.clear();
    this.#attempts = [];
  }

  private publicEvidence({ bytes: _bytes, ...item }: StoredEvidence): EvidenceView {
    return item;
  }
}
