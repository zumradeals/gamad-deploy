export const AGENT_IMAGE = 'ghcr.io/zumradeals/gamad-deploy/agent:latest';

export function buildDockerRunCommand(port: number, token: string): string {
  return [
    `docker stop gamad-agent 2>/dev/null || true`,
    `docker rm   gamad-agent 2>/dev/null || true`,
    `docker pull ${AGENT_IMAGE}`,
    `docker run -d \\`,
    `  --name gamad-agent \\`,
    `  --restart unless-stopped \\`,
    `  -p ${port}:${port} \\`,
    `  -e "AGENT_TOKEN=${token}" \\`,
    `  -v /var/lib/gamad:/var/lib/gamad \\`,
    `  -v /var/run/docker.sock:/var/run/docker.sock \\`,
    `  -v /etc/nginx:/etc/nginx \\`,
    `  -v /etc/letsencrypt:/etc/letsencrypt \\`,
    `  --privileged \\`,
    `  ${AGENT_IMAGE}`,
  ].join('\n');
}

/** Version masquée pour l'affichage sur la page détail (token inconnu après création). */
export function buildMaskedDockerRunCommand(port: number, tokenSuffix: string): string {
  const masked = `${'•'.repeat(60)}${tokenSuffix}`;
  return buildDockerRunCommand(port, masked);
}
