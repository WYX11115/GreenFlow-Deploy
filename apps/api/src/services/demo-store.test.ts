import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DemoStore } from './demo-store.js';

describe('evidence byte integrity', () => {
  it('hashes the exact stored bytes and detects a one-byte modification', () => {
    const store = new DemoStore();
    const originalBytes = Buffer.from('%PDF-1.4\nfictional delivery evidence\n%%EOF\n');
    const modifiedBytes = Buffer.from('%PDF-1.4\nfictional delivery evidence!\n%%EOF\n');
    const original = store.addEvidence('M1', 'original.pdf', 'application/pdf', originalBytes);
    const modified = store.addEvidence('M1', 'modified.pdf', 'application/pdf', modifiedBytes);

    expect(original.sha256).toBe(`0x${createHash('sha256').update(originalBytes).digest('hex')}`);
    expect(original.milestoneId).toBe('M1');
    expect(store.getEvidenceBytes(original.id)?.bytes).toEqual(originalBytes);
    expect(modified.sha256).not.toBe(original.sha256);
  });

  it('clears evidence and rejected-attempt metadata on reset', () => {
    const store = new DemoStore();
    store.addSample('M1');
    store.addAttempt({
      kind: 'UNKNOWN_VENDOR',
      code: 'VENDOR_NOT_APPROVED',
      message: 'Blocked.',
      actorAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      txHash: `0x${'11'.repeat(32)}`,
      blockNumber: '1'
    });

    store.reset();
    expect(store.evidence()).toEqual([]);
    expect(store.attempts()).toEqual([]);
  });

  it('uses the packaged fictional M1 PDF as the exact sample bytes', () => {
    const store = new DemoStore();
    const sample = store.addSample('M1');

    expect(sample.fileName).toBe('M1-equipment-delivery-demo.pdf');
    expect(sample.mimeType).toBe('application/pdf');
    expect(sample.sha256).toBe('0x33cab0225356c347271e1f6b92998f4b35dfa0be716d4bda3b8a8ef7fa58b257');
    expect(store.getEvidenceBytes(sample.id)?.bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
