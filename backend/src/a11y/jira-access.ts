import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JiraClient } from './jira.client';

export interface JiraAccess {
  jira: JiraClient;
  issueType: string | null;
  linkType: string | null;
}

/**
 * Jira as the person acting: their own token, else the project's shared one
 * (ADR-0010). Accessibility bugs and bugs from the comparison both go through it.
 */
export async function jiraAccess(prisma: PrismaService, projectId: string, userId?: string): Promise<JiraAccess> {
  const [project, user] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    userId ? prisma.user.findUnique({ where: { id: userId } }) : null,
  ]);
  if (!project?.jiraUrl) {
    throw new BadRequestException('Jira is not set up for this project: add its URL in project settings');
  }
  const credentials = user?.jiraToken
    ? { token: user.jiraToken, email: user.jiraEmail }
    : project.jiraToken
      ? { token: project.jiraToken, email: project.jiraEmail }
      : null;
  if (!credentials) {
    throw new BadRequestException('Add your Jira token in your profile to work with Jira from Vision');
  }
  return {
    jira: new JiraClient({ url: project.jiraUrl, ...credentials }),
    issueType: project.jiraIssueType,
    linkType: project.jiraLinkType,
  };
}
