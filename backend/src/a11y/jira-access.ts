import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JiraClient } from './jira.client';

export interface JiraAccess {
  jira: JiraClient;
  issueType: string | null;
  linkType: string | null;
}

/**
 * Jira as the person acting, with their own token only (ADR-0025): a bug is
 * always filed by its real author with their rights. Accessibility bugs and
 * bugs from the comparison both go through it.
 */
export async function jiraAccess(prisma: PrismaService, projectId: string, userId?: string): Promise<JiraAccess> {
  const [project, user] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { jiraToken: true, jiraEmail: true } }) : null,
  ]);
  if (!project?.jiraUrl) {
    throw new BadRequestException('Jira is not set up for this project: add its URL in project settings');
  }
  if (!user?.jiraToken) {
    throw new BadRequestException('Add your Jira token in your profile to work with Jira from Vision');
  }
  return {
    jira: new JiraClient({ url: project.jiraUrl, token: user.jiraToken, email: user.jiraEmail }),
    issueType: project.jiraIssueType,
    linkType: project.jiraLinkType,
  };
}
