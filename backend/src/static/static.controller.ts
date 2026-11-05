import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { basename } from 'path';
import { StaticService } from './static.service';
import { PrismaService } from '../prisma/prisma.service';
import { linkState } from '../reports/report-links';
import { readFileSignature, serverFileLinkKey } from './file-links';
import { NoProjectData } from '../projects/project-access';

// Shorter than the window a signed storage URL is minted for (URL_WINDOW_SECONDS), so a cached
// redirect always still points at a URL that works.
const REDIRECT_MAX_AGE_SECONDS = 3000;

// The bytes behind a name never change, so the person's browser keeps them; no shared cache may (043).
const FILE_CACHE = 'private, max-age=31536000, immutable';

/**
 * Stored images, only with a signature Vision handed out (043): the answers that carry file names
 * carry their signatures, so the interface shows images as before, and an address with the bare
 * name opens nothing. Missing, unsigned and wrongly signed all answer the same 404.
 */
@ApiTags('images')
@Controller('images')
export class StaticController {
  private readonly key = serverFileLinkKey();

  constructor(
    private staticService: StaticService,
    private prismaService: PrismaService
  ) {}

  @NoProjectData()
  @Get('/:fileName')
  @ApiQuery({ name: 'sig', required: true })
  @ApiOkResponse()
  async show(@Param('fileName') fileName: string, @Query('sig') sig: string | undefined, @Res() res: Response) {
    await this.allow(fileName, sig);
    const url = await this.staticService.getImageUrl(fileName);
    this.shareWithVision(res);
    if (/^https?:\/\//.test(url)) {
      // storage that signs its own URLs: the redirect is reused, as private as the URL it holds
      res.set('Cache-Control', `private, max-age=${REDIRECT_MAX_AGE_SECONDS}`);
      res.redirect(url);
      return;
    }
    const bytes = await this.staticService.getImageBuffer(fileName);
    if (!bytes) throw new NotFoundException();
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': FILE_CACHE });
    res.send(bytes);
  }

  /**
   * The bytes from this origin, for the interface's bulk download: a pre-signed S3 URL answers
   * without CORS headers, so a browser `fetch` of the redirect would be blocked.
   */
  @NoProjectData()
  @Get('/:fileName/download')
  @ApiQuery({ name: 'sig', required: true })
  @ApiOkResponse()
  async download(@Param('fileName') fileName: string, @Query('sig') sig: string | undefined, @Res() res: Response) {
    await this.allow(fileName, sig);
    const imageBuffer = await this.staticService.getImageBuffer(fileName);
    if (!imageBuffer) {
      throw new NotFoundException(`Image not found: ${fileName}`);
    }
    this.shareWithVision(res);
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': FILE_CACHE,
    });
    res.send(imageBuffer);
  }

  private async allow(fileName: string, sig: string | undefined): Promise<void> {
    // a stored image is always a plain file name, so anything carrying a path is rejected before
    // it reaches storage. basename keeps '.' and '..' as they are, so both are named here
    if (!fileName || fileName === '.' || fileName === '..' || fileName !== basename(fileName)) {
      throw new BadRequestException('Invalid image name');
    }
    const opens = fileName.endsWith('.png') ? readFileSignature(fileName, sig, this.key) : null;
    if (opens?.kind === 'report') {
      // a report's images live as long as its link (REQ-043-06)
      const link = await this.prismaService.reportLink.findUnique({
        where: { token: opens.token },
        select: { revokedAt: true },
      });
      if (link && linkState(link) === 'ok') return;
    } else if (opens) {
      return;
    }
    throw new NotFoundException(`Image not found: ${fileName}`);
  }

  // only Vision's own interface may read the bytes in a script (the zip download); an <img> needs no CORS
  private shareWithVision(res: Response): void {
    const ui = process.env.APP_FRONTEND_URL;
    if (!ui) return;
    try {
      res.set('Access-Control-Allow-Origin', new URL(ui).origin);
      res.set('Vary', 'Origin');
    } catch {
      // not a URL: no other origin may read the bytes
    }
  }
}
