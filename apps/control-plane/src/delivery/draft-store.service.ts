// Stockage temporaire des drafts gamad.json en attente de consentement (ADR-0009).
// TTL 15 min — au-delà, le draft est périmé et l'utilisateur doit relancer analyze.
// Tenant-scopé : un draft d'une org est invisible depuis une autre (INV-06).
// En production, remplacer par Redis pour la persistance entre instances (P-07+).

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { GamadContractDraft } from '@gamad/contracts';

const TTL_MS = 15 * 60_000; // 15 minutes

interface DraftEntry {
  draft: GamadContractDraft;
  orgId: string;
  expiresAt: number;
}

@Injectable()
export class DraftStoreService {
  private readonly entries = new Map<string, DraftEntry>();

  save(draft: GamadContractDraft, orgId: string): string {
    const draftId = randomUUID();
    this.entries.set(draftId, { draft, orgId, expiresAt: Date.now() + TTL_MS });
    return draftId;
  }

  /** Retourne le draft si valide + appartient au tenant. Null sinon (expiré ou inconnu). */
  retrieve(draftId: string, orgId: string): GamadContractDraft | null {
    const entry = this.entries.get(draftId);
    if (!entry) return null;
    if (entry.orgId !== orgId) return null; // INV-06 : isolation tenant
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(draftId);
      return null;
    }
    return entry.draft;
  }

  /** Invalide un draft après usage — usage unique (draft_id non rejouable). */
  consume(draftId: string): void {
    this.entries.delete(draftId);
  }
}
