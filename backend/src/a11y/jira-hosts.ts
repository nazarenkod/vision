/**
 * Jira only on the hosts the server allows (044): a project's Jira address is set by editors, and
 * the person filing a bug sends their own token there, so an address nobody vetted must never get
 * it. VISION_JIRA_HOSTS lists host names, comma-separated; without it Vision calls no Jira.
 *
 * A host name alone allows https on the standard port, as Jira Cloud and a usual Data Center are
 * reached: plain http or another port would hand the token to whoever listens there (051,
 * VIS-SEC-008). An entry with a scheme and a port (`http://127.0.0.1:4810`) allows exactly those,
 * for a test stand or a Jira on its own port.
 */
export const JIRA_HOSTS_VARIABLE = 'VISION_JIRA_HOSTS';

interface JiraHostEntry {
  hostname: string;
  protocol: string;
  // '' is the standard port of the protocol, as URL gives it
  port: string;
}

export function allowedJiraHosts(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
}

function entryOf(host: string): JiraHostEntry | null {
  if (!host.includes('://')) return { hostname: host, protocol: 'https:', port: '' };
  try {
    const url = new URL(host);
    return { hostname: url.hostname, protocol: url.protocol, port: url.port };
  } catch {
    return null;
  }
}

export function isAllowedJiraUrl(url: string | null | undefined, hosts: string[]): boolean {
  if (!url || !hosts.length) return false;
  let address: URL;
  try {
    address = new URL(url);
  } catch {
    return false;
  }
  // a name and a password in the address would go along with the token
  if (address.username || address.password) return false;
  const hostname = address.hostname.toLowerCase();
  return hosts
    .map(entryOf)
    .some(
      (entry) =>
        !!entry && entry.hostname === hostname && entry.protocol === address.protocol && entry.port === address.port
    );
}

/** Why an address is refused, for the person who typed it. */
export function jiraHostProblem(url: string, hosts: string[]): string | null {
  if (isAllowedJiraUrl(url, hosts)) return null;
  return hosts.length
    ? `Jira at ${url} is not allowed: the server allows ${hosts.join(', ')} (${JIRA_HOSTS_VARIABLE}), ` +
        'over https on the standard port unless an entry names its scheme and port'
    : `Jira is not set up on this server: ${JIRA_HOSTS_VARIABLE} lists no host`;
}
