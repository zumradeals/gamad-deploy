// INV-09 — Port certbot isolé. Le domaine et l'email sont validés par PdnSecurityValidator
// avant que ce port soit appelé. Jamais de flag shell arbitraire.

export abstract class CertbotExecutorPort {
  abstract obtainCertificate(domain: string, email: string): Promise<void>;
}
