import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { openSecret } from '../shared/secret-box';
import { JiraClient } from './jira.client';
import { JiraTypesProblem } from './jira-types';
import { allowedJiraHosts, JIRA_HOSTS_VARIABLE, jiraHostProblem } from './jira-hosts';

export interface JiraAccess {
  jira: JiraClient;
  issueType: string | null;
  linkType: string | null;
}

/**
 * Jira as the person acting, with their own token only (ADR-0025): a bug is
 * always filed by its real author with their rights. Accessibility bugs and
 * bugs from the comparison both go through it. The token goes only to a host
 * the server allows (044): an editor could point the project at any address.
 */
export async function jiraAccess(
  prisma: PrismaService,
  projectId: string,
  userId?: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<JiraAccess> {
  const [project, user] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { jiraToken: true, jiraEmail: true } }) : null,
  ]);
  if (!project?.jiraUrl) {
    throw new BadRequestException('Jira is not set up for this project: add its URL in project settings');
  }
  const hostProblem = jiraHostProblem(project.jiraUrl, allowedJiraHosts(env[JIRA_HOSTS_VARIABLE]));
  if (hostProblem) throw new BadRequestException(hostProblem);
  // a token sealed with another key reads as none: the person enters it again
  const token = openSecret(user?.jiraToken, env);
  if (!token) {
    throw new BadRequestException('Add your Jira token in your profile to work with Jira from Vision');
  }
  return {
    jira: new JiraClient({ url: project.jiraUrl, token, email: user.jiraEmail }),
    issueType: project.jiraIssueType,
    linkType: project.jiraLinkType,
  };
}

/**
 * Jira at an address the settings page holds, maybe not saved yet (REQ-049-09), as the person
 * looking at the page (REQ-049-03). The same host check as on save keeps their token off an
 * address nobody vetted (REQ-049-13). A reason instead of an exception: the page shows it.
 */
export async function settingsJira(
  prisma: PrismaService,
  jiraUrl: string | null | undefined,
  userId: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<JiraClient | { problem: JiraTypesProblem }> {
  const url = jiraUrl?.trim();
  if (!url) return { problem: 'notSet' };
  if (jiraHostProblem(url, allowedJiraHosts(env[JIRA_HOSTS_VARIABLE]))) return { problem: 'hostNotAllowed' };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { jiraToken: true, jiraEmail: true } });
  const token = openSecret(user?.jiraToken, env);
  if (!token) return { problem: 'noToken' };
  return new JiraClient({ url, token, email: user.jiraEmail });
}
