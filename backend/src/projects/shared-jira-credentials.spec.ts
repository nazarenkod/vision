import { wipeSharedJiraCredentials } from './shared-jira-credentials';

type Row = Record<string, string | null>;

// a tiny stand-in for updateMany over the two OR-ed "not null" conditions
const prismaOver = (rows: Row[]) => ({
  project: {
    updateMany: jest.fn(async ({ where, data }) => {
      const matches = rows.filter((row) =>
        where.OR.some((condition: Record<string, unknown>) => {
          const [column] = Object.keys(condition);
          return row[column] !== null;
        })
      );
      matches.forEach((row) => Object.assign(row, data));
      return { count: matches.length };
    }),
  },
});

describe('wipeSharedJiraCredentials', () => {
  it('wipes stored shared Jira tokens and emails, and only them', async () => {
    const rows: Row[] = [
      {
        id: 'a',
        jiraUrl: 'https://jira',
        jiraToken: 'secret',
        jiraEmail: 'bot@example.com',
        jiraIssueType: 'Bug',
        jiraLinkType: 'Relates',
      },
      {
        id: 'b',
        jiraUrl: 'https://jira',
        jiraToken: null,
        jiraEmail: 'left@example.com',
        jiraIssueType: null,
        jiraLinkType: null,
      },
      { id: 'c', jiraUrl: null, jiraToken: null, jiraEmail: null, jiraIssueType: null, jiraLinkType: null },
    ];
    const prisma = prismaOver(rows);

    expect(await wipeSharedJiraCredentials(prisma as never)).toBe(2);
    expect(rows.map((row) => [row.jiraToken, row.jiraEmail])).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
    expect(rows[0]).toMatchObject({ jiraUrl: 'https://jira', jiraIssueType: 'Bug', jiraLinkType: 'Relates' });
    expect(prisma.project.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ jiraToken: { not: null } }, { jiraEmail: { not: null } }] },
      data: { jiraToken: null, jiraEmail: null },
    });
  });

  it('changes nothing when run again', async () => {
    const rows: Row[] = [{ id: 'a', jiraUrl: 'https://jira', jiraToken: 'secret', jiraEmail: null }];
    const prisma = prismaOver(rows);
    await wipeSharedJiraCredentials(prisma as never);
    expect(await wipeSharedJiraCredentials(prisma as never)).toBe(0);
  });
});
