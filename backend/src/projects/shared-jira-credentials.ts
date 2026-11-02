import { PrismaService } from '../prisma/prisma.service';

/**
 * Wipes the shared Jira token and its email that projects kept before 035
 * (ADR-0025). The columns stay (ADR-0003); only the values go. Run again, it
 * finds nothing to change. Returns how many projects it cleaned.
 */
export async function wipeSharedJiraCredentials(prisma: Pick<PrismaService, 'project'>): Promise<number> {
  const { count } = await prisma.project.updateMany({
    where: { OR: [{ jiraToken: { not: null } }, { jiraEmail: { not: null } }] },
    data: { jiraToken: null, jiraEmail: null },
  });
  return count;
}
