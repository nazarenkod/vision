/**
 * Jira only on the hosts the server allows (044): a project's Jira address is set by editors, and
 * the person filing a bug sends their own token there, so an address nobody vetted must never get
 * it. VISION_JIRA_HOSTS lists host names, comma-separated; without it Vision calls no Jira.
 */
export const JIRA_HOSTS_VARIABLE = 'VISION_JIRA_HOSTS';

export function allowedJiraHosts(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
}

export function isAllowedJiraUrl(url: string | null | undefined, hosts: string[]): boolean {
  if (!url || !hosts.length) return false;
  try {
    return hosts.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Why an address is refused, for the person who typed it. */
export function jiraHostProblem(url: string, hosts: string[]): string | null {
  if (isAllowedJiraUrl(url, hosts)) return null;
  return hosts.length
    ? `Jira at ${url} is not allowed: the server allows ${hosts.join(', ')} (${JIRA_HOSTS_VARIABLE})`
    : `Jira is not set up on this server: ${JIRA_HOSTS_VARIABLE} lists no host`;
}
