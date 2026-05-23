// Sealed type — preuve structurelle du consentement au contenu (ADR-0009).
// Constructeur privé : impossible à instancier sans passer par fromApproval().
// commitGamadJson() accepte UNIQUEMENT ValidatedContractDraft → écriture incompilable
// sans consentement explicite. Le compilateur, pas une guard clause, est le gardien.

import type { GamadContractDraft } from '@gamad/contracts';

export class ValidatedContractDraft {
  private constructor(
    public readonly draft: GamadContractDraft,
    public readonly draftId: string,
    public readonly validatedAt: Date,
  ) {}

  /** Crée le token de consentement. draftId vide → erreur (consentement absent). */
  static fromApproval(draft: GamadContractDraft, draftId: string): ValidatedContractDraft {
    if (!draftId.trim()) {
      throw new Error('draft_id requis — consentement structurel absent (ADR-0009)');
    }
    return new ValidatedContractDraft(draft, draftId, new Date());
  }
}
