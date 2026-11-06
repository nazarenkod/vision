import { sealSecret } from '../shared/secret-box';
import { jiraAccess, settingsJira } from './jira-access';
import { JiraClient } from './jira.client';

const env = { VISION_SECRET_KEY: 'jira-access-test-key', VISION_JIRA_HOSTS: 'jira.example.com' };

const prismaWith = (
  user: { jiraToken: string | null; jiraEmail: string | null } | null,
  jiraUrl = 'https://jira.example.com'
) =>
  ({
    project: {
      findUnique: jest.fn().mockResolvedValue({
        jiraUrl,
        jiraToken: 'shared-token',
        jiraEmail: 'shared@example.com',
        jiraIssueType: 'Bug',
        jiraLinkType: 'Relates',
      }),
    },
    user: { findUnique: jest.fn().mockResolvedValue(user) },
  }) as never;

const sealed = (token: string) => sealSecret(token, env);

describe('jiraAccess', () => {
  it("never falls back to the project's shared token", async () => {
    await expect(
      jiraAccess(prismaWith({ jiraToken: null, jiraEmail: null }), 'project', 'person', env)
    ).rejects.toThrow('Add your Jira token in your profile');
    await expect(jiraAccess(prismaWith(null), 'project', undefined, env)).rejects.toThrow(
      'Add your Jira token in your profile'
    );
  });

  it('asks for a personal token when the person has none', async () => {
    await expect(jiraAccess(prismaWith({ jiraToken: '', jiraEmail: null }), 'project', 'person', env)).rejects.toThrow(
      'Add your Jira token in your profile to work with Jira from Vision'
    );
  });

  it('asks for the token again when it was sealed with another key', async () => {
    const other = sealSecret('mine', { VISION_SECRET_KEY: 'another-key' });
    await expect(
      jiraAccess(prismaWith({ jiraToken: other, jiraEmail: null }), 'project', 'person', env)
    ).rejects.toThrow('Add your Jira token in your profile');
  });

  it("goes to Jira with the person's own token and the project's issue and link types", async () => {
    const prisma = prismaWith({ jiraToken: sealed('mine'), jiraEmail: 'me@example.com' });
    const access = await jiraAccess(prisma, 'project', 'person', env);
    expect(access.issueType).toBe('Bug');
    expect(access.linkType).toBe('Relates');
    expect(JSON.stringify(access.jira)).not.toContain('shared-token');
    expect(JSON.stringify(access.jira)).toContain('mine');
  });

  it('sends the token to an allowed Jira only', async () => {
    const person = { jiraToken: sealed('mine'), jiraEmail: 'me@example.com' };
    const access = await jiraAccess(prismaWith(person), 'project', 'person', env);
    expect(access.jira).toBeInstanceOf(JiraClient);
    await expect(
      jiraAccess(prismaWith(person, 'https://jira.attacker.example'), 'project', 'person', env)
    ).rejects.toThrow('Jira at https://jira.attacker.example is not allowed: the server allows jira.example.com');
  });

  it('calls no Jira while no host is allowed', async () => {
    const person = { jiraToken: sealed('mine'), jiraEmail: 'me@example.com' };
    await expect(
      jiraAccess(prismaWith(person), 'project', 'person', { VISION_SECRET_KEY: env.VISION_SECRET_KEY })
    ).rejects.toThrow('Jira is not set up on this server: VISION_JIRA_HOSTS lists no host');
  });
});

describe('settingsJira', () => {
  const people = (user: { jiraToken: string | null; jiraEmail: string | null } | null) =>
    ({ user: { findUnique: jest.fn().mockResolvedValue(user) } }) as never;

  it("reads the setting lists with the person's own token only", async () => {
    const prisma = people({ jiraToken: sealed('mine'), jiraEmail: 'me@example.com' });
    const jira = await settingsJira(prisma, 'https://jira.example.com', 'person', env);
    expect(jira).toBeInstanceOf(JiraClient);
    expect(JSON.stringify(jira)).toContain('mine');
    expect(await settingsJira(people({ jiraToken: null, jiraEmail: null }), 'https://jira.example.com', 'person', env)).toEqual(
      { problem: 'noToken' }
    );
  });

  it('reads no Jira for an address the server does not allow', async () => {
    const prisma = people({ jiraToken: sealed('mine'), jiraEmail: null });
    expect(await settingsJira(prisma, 'https://evil.example.org', 'person', env)).toEqual({ problem: 'hostNotAllowed' });
    expect(await settingsJira(prisma, '  ', 'person', env)).toEqual({ problem: 'notSet' });
    expect((prisma as unknown as { user: { findUnique: jest.Mock } }).user.findUnique).not.toHaveBeenCalled();
  });
});
