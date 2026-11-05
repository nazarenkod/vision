import { allowedJiraHosts, isAllowedJiraUrl, jiraHostProblem } from './jira-hosts';

describe('Jira hosts', () => {
  const hosts = allowedJiraHosts(' jira.bank.test , Jira2.Bank.Test,');

  it('takes a Jira address on an allowed host only', () => {
    expect(hosts).toEqual(['jira.bank.test', 'jira2.bank.test']);
    expect(isAllowedJiraUrl('https://jira.bank.test/secure', hosts)).toBe(true);
    expect(isAllowedJiraUrl('https://JIRA2.bank.test', hosts)).toBe(true);
    expect(isAllowedJiraUrl('https://jira.bank.test.evil.test', hosts)).toBe(false);
    expect(isAllowedJiraUrl('https://evil.test/?jira.bank.test', hosts)).toBe(false);
    expect(jiraHostProblem('https://evil.test', hosts)).toContain('jira.bank.test, jira2.bank.test');
  });

  it('allows nothing while no host is listed', () => {
    expect(isAllowedJiraUrl('https://jira.bank.test', allowedJiraHosts(undefined))).toBe(false);
    expect(jiraHostProblem('https://jira.bank.test', [])).toContain('VISION_JIRA_HOSTS lists no host');
  });
});
