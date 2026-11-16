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

describe('Jira hosts: scheme and port (051)', () => {
  const hosts = allowedJiraHosts('jira.bank.test');

  it('takes an https address on an allowed host as before', () => {
    expect(isAllowedJiraUrl('https://jira.bank.test', hosts)).toBe(true);
    expect(isAllowedJiraUrl('https://jira.bank.test/jira/secure/Dashboard.jspa', hosts)).toBe(true);
    expect(isAllowedJiraUrl('https://jira.bank.test:443/', hosts)).toBe(true);
  });

  it('sends a token only over https on the standard port of an allowed host', () => {
    expect(isAllowedJiraUrl('http://jira.bank.test', hosts)).toBe(false);
    expect(isAllowedJiraUrl('https://jira.bank.test:8443', hosts)).toBe(false);
    expect(isAllowedJiraUrl('http://jira.bank.test:443', hosts)).toBe(false);
    expect(isAllowedJiraUrl('ftp://jira.bank.test', hosts)).toBe(false);
    expect(jiraHostProblem('http://jira.bank.test', hosts)).toContain('https');
  });

  it('takes the scheme and port an entry names', () => {
    const stand = allowedJiraHosts('jira.bank.test, http://127.0.0.1:4810, https://jira.dc.test:8443');
    expect(isAllowedJiraUrl('http://127.0.0.1:4810/rest', stand)).toBe(true);
    expect(isAllowedJiraUrl('http://127.0.0.1:4811', stand)).toBe(false);
    expect(isAllowedJiraUrl('https://127.0.0.1:4810', stand)).toBe(false);
    expect(isAllowedJiraUrl('http://127.0.0.1', stand)).toBe(false);
    expect(isAllowedJiraUrl('https://jira.dc.test:8443', stand)).toBe(true);
    expect(isAllowedJiraUrl('https://jira.dc.test', stand)).toBe(false);
    expect(isAllowedJiraUrl('https://jira.bank.test', stand)).toBe(true);
  });

  it('does not take credentials in the address', () => {
    expect(isAllowedJiraUrl('https://someone:secret@jira.bank.test', hosts)).toBe(false);
  });
});
