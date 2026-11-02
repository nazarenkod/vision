import { jiraAccess } from './jira-access';

const prismaWith = (user: { jiraToken: string | null; jiraEmail: string | null } | null) =>
  ({
    project: {
      findUnique: jest.fn().mockResolvedValue({
        jiraUrl: 'https://jira.example.com',
        jiraToken: 'shared-token',
        jiraEmail: 'shared@example.com',
        jiraIssueType: 'Bug',
        jiraLinkType: 'Relates',
      }),
    },
    user: { findUnique: jest.fn().mockResolvedValue(user) },
  }) as never;

describe('jiraAccess', () => {
  it("never falls back to the project's shared token", async () => {
    await expect(jiraAccess(prismaWith({ jiraToken: null, jiraEmail: null }), 'project', 'person')).rejects.toThrow(
      'Add your Jira token in your profile'
    );
    await expect(jiraAccess(prismaWith(null), 'project')).rejects.toThrow('Add your Jira token in your profile');
  });

  it('asks for a personal token when the person has none', async () => {
    await expect(jiraAccess(prismaWith({ jiraToken: '', jiraEmail: null }), 'project', 'person')).rejects.toThrow(
      'Add your Jira token in your profile to work with Jira from Vision'
    );
  });

  it("goes to Jira with the person's own token and the project's issue and link types", async () => {
    const prisma = prismaWith({ jiraToken: 'mine', jiraEmail: 'me@example.com' });
    const access = await jiraAccess(prisma, 'project', 'person');
    expect(access.issueType).toBe('Bug');
    expect(access.linkType).toBe('Relates');
    expect(JSON.stringify(access.jira)).not.toContain('shared-token');
    expect(JSON.stringify(access.jira)).toContain('mine');
  });
});
