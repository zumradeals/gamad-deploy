import { CertbotExecutorPort } from '../ports/certbot-executor.port';

export class CertbotExecutorStub extends CertbotExecutorPort {
  readonly obtained: Array<{ domain: string; email: string }> = [];
  private _fail = false;

  setFail(fail: boolean): void { this._fail = fail; }

  override async obtainCertificate(domain: string, email: string): Promise<void> {
    this.obtained.push({ domain, email });
    if (this._fail) throw new Error('CertbotExecutorStub : obtention certificat simulée en échec');
  }
}
