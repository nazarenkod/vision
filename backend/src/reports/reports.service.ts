import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BuildOverviewService } from '../builds/build-overview.service';
import {
  languageOf,
  linkState,
  newToken,
  PublicReport,
  publicReport,
  ReportLanguage,
  Section,
  SECTIONS,
  sectionsOf,
} from './report-links';

export interface ReportLinkDto {
  id: string;
  token: string;
  sections: Section[];
  language: ReportLanguage;
  createdBy: string | null;
  createdById: string | null;
  createdAt: Date;
}

const nameOf = (user: { firstName: string | null; lastName: string | null } | null | undefined) =>
  user ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null : null;

/** Public links to a build's report (031, ADR-0022). Vision never sends a report anywhere (REQ-031-49). */
@Injectable()
export class ReportsService {
  constructor(
    private prismaService: PrismaService,
    private buildOverviewService: BuildOverviewService
  ) {}

  async create(
    buildId: string,
    body: { sections?: unknown; language?: unknown },
    user: Pick<User, 'id'>
  ): Promise<ReportLinkDto> {
    const build = await this.prismaService.build.findUnique({ where: { id: buildId }, select: { projectId: true } });
    if (!build) throw new NotFoundException('Build not found');
    const link = await this.prismaService.reportLink.create({
      data: {
        token: newToken(),
        buildId,
        projectId: build.projectId,
        sections: JSON.stringify(sectionsOf(body.sections)),
        language: languageOf(body.language),
        createdById: user.id,
      },
    });
    return (await this.toDtos([link]))[0];
  }

  async list(buildId: string): Promise<ReportLinkDto[]> {
    const links = await this.prismaService.reportLink.findMany({
      where: { buildId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return this.toDtos(links);
  }

  /** The author or an admin takes a link back (REQ-031-66). */
  async revoke(id: string, user: Pick<User, 'id' | 'role'>): Promise<void> {
    const link = await this.prismaService.reportLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Link not found');
    if (link.createdById !== user.id && user.role !== Role.admin) {
      throw new ForbiddenException('Only the author or an admin can revoke this link');
    }
    await this.prismaService.reportLink.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** The whole report of a build for someone signed in: the dialog's preview and its print (REQ-031-40). */
  async reportFor(buildId: string, user: Pick<User, 'firstName' | 'lastName'>): Promise<PublicReport> {
    const build = await this.prismaService.build.findUnique({ where: { id: buildId }, select: { id: true } });
    if (!build) throw new NotFoundException('Build not found');
    const [overview, runs] = await Promise.all([this.buildOverviewService.overview(buildId), this.reportRuns(buildId)]);
    return publicReport(overview, runs, { sections: [...SECTIONS], language: 'en', createdBy: nameOf(user) });
  }

  private reportRuns(buildId: string) {
    return this.prismaService.testRun.findMany({
      where: { buildId },
      select: {
        id: true,
        name: true,
        device: true,
        os: true,
        status: true,
        diffPercent: true,
        imageName: true,
        baselineName: true,
        diffName: true,
        a11yNewCount: true,
      },
    });
  }

  /** What a reader without an account sees (REQ-031-62…65). */
  async publicReport(token: string): Promise<PublicReport> {
    const link = await this.prismaService.reportLink.findUnique({ where: { token } });
    if (!link || linkState(link) === 'expired') return { state: 'expired' };
    const build = await this.prismaService.build.findUnique({ where: { id: link.buildId }, select: { id: true } });
    if (!build) return { state: 'gone' };
    const [overview, runs, author] = await Promise.all([
      this.buildOverviewService.overview(link.buildId),
      this.reportRuns(link.buildId),
      link.createdById
        ? this.prismaService.user.findUnique({
            where: { id: link.createdById },
            select: { firstName: true, lastName: true },
          })
        : null,
    ]);
    return publicReport(overview, runs, {
      sections: sectionsOf(JSON.parse(link.sections)),
      language: languageOf(link.language),
      createdBy: nameOf(author),
    });
  }

  private async toDtos(
    links: Array<{
      id: string;
      token: string;
      sections: string;
      language: string;
      createdById: string | null;
      createdAt: Date;
    }>
  ): Promise<ReportLinkDto[]> {
    const ids = [...new Set(links.map((link) => link.createdById).filter(Boolean))];
    const users = ids.length
      ? await this.prismaService.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const names = new Map(users.map((user) => [user.id, nameOf(user)]));
    return links.map((link) => ({
      id: link.id,
      token: link.token,
      sections: sectionsOf(JSON.parse(link.sections)),
      language: languageOf(link.language),
      createdBy: link.createdById ? (names.get(link.createdById) ?? null) : null,
      createdById: link.createdById,
      createdAt: link.createdAt,
    }));
  }
}
