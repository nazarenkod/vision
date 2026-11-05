import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { StaticController } from './static.controller';
import { serverFileLinkKey, signFile, signReportFile } from './file-links';

const NAME = 'image.png';
const key = serverFileLinkKey();
const signed = (name = NAME) => signFile(name, key);

const initController = ({
  getImageBuffer = jest.fn().mockResolvedValue(Buffer.from([1, 2, 3])),
  getImageUrl = jest.fn().mockResolvedValue(`/${NAME}`),
  reportLink = null as { revokedAt: Date | null } | null,
} = {}) => {
  const staticService = { getImageBuffer, getImageUrl };
  const prisma = { reportLink: { findUnique: jest.fn().mockResolvedValue(reportLink) } };
  return { controller: new StaticController(staticService as never, prisma as never), getImageBuffer, prisma };
};

const responseMock = () => {
  const res = { set: jest.fn(), send: jest.fn(), redirect: jest.fn() };
  return res as unknown as Response & { set: jest.Mock; send: jest.Mock; redirect: jest.Mock };
};

const headersOf = (res: { set: jest.Mock }) =>
  Object.assign(
    {},
    ...res.set.mock.calls.map(([name, value]) => (typeof name === 'string' ? { [name]: value } : name))
  );

describe('images', () => {
  it('shows the bytes of a signed image', async () => {
    const { controller, getImageBuffer } = initController();
    const res = responseMock();

    await controller.show(NAME, signed(), res);

    expect(getImageBuffer).toHaveBeenCalledWith(NAME);
    expect(res.send).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
    expect(headersOf(res)['Content-Type']).toBe('image/png');
  });

  it('answers not found without a valid signature', async () => {
    const { controller, getImageBuffer } = initController();

    for (const sig of [undefined, '', 'x', signed('other.png'), signReportFile('token', NAME, key)]) {
      await expect(controller.show(NAME, sig, responseMock())).rejects.toThrow(NotFoundException);
      await expect(controller.download(NAME, sig, responseMock())).rejects.toThrow(NotFoundException);
    }
    // a tree or a report file is never served here, signed or not
    await expect(controller.show('tree.json.gz', signed('tree.json.gz'), responseMock())).rejects.toThrow(
      NotFoundException
    );
    expect(getImageBuffer).not.toHaveBeenCalled();
  });

  it("lets only the person's browser keep a file and only Vision read it", async () => {
    process.env.APP_FRONTEND_URL = 'https://vision.bank.test/some/path';
    const { controller } = initController();
    const shown = responseMock();
    const downloaded = responseMock();

    await controller.show(NAME, signed(), shown);
    await controller.download(NAME, signed(), downloaded);

    for (const res of [shown, downloaded]) {
      expect(headersOf(res)['Cache-Control']).toBe('private, max-age=31536000, immutable');
      expect(headersOf(res)['Access-Control-Allow-Origin']).toBe('https://vision.bank.test');
    }
  });

  it('opens a report image while its link is valid only', async () => {
    const live = initController({ reportLink: { revokedAt: null } });
    await live.controller.show(NAME, signReportFile('token', NAME, key), responseMock());
    expect(live.prisma.reportLink.findUnique).toHaveBeenCalledWith({
      where: { token: 'token' },
      select: { revokedAt: true },
    });

    for (const reportLink of [{ revokedAt: new Date() }, null]) {
      const { controller } = initController({ reportLink });
      await expect(controller.show(NAME, signReportFile('token', NAME, key), responseMock())).rejects.toThrow(
        NotFoundException
      );
    }
  });

  it('answers 404 for a signed image that is not there', async () => {
    const { controller } = initController({ getImageBuffer: jest.fn().mockResolvedValue(null) });

    await expect(controller.download(NAME, signed(), responseMock())).rejects.toThrow(NotFoundException);
    await expect(controller.show(NAME, signed(), responseMock())).rejects.toThrow(NotFoundException);
  });

  it('downloads the bytes as an attachment', async () => {
    const { controller } = initController();
    const res = responseMock();

    await controller.download(NAME, signed(), res);

    expect(headersOf(res)['Content-Disposition']).toBe(`attachment; filename="${NAME}"`);
    expect(res.send).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
  });

  // a name carrying a path could otherwise read any file the process can see
  it.each(['../../etc/passwd', '..', '.', '', 'nested/image.png', '/etc/passwd'])(
    'rejects %p without touching storage',
    async (fileName) => {
      const { controller, getImageBuffer } = initController();

      await expect(controller.download(fileName, signed(fileName), responseMock())).rejects.toThrow(
        BadRequestException
      );
      await expect(controller.show(fileName, signed(fileName), responseMock())).rejects.toThrow(BadRequestException);
      expect(getImageBuffer).not.toHaveBeenCalled();
    }
  );

  // storage that signs its own URLs: the browser reuses the redirect, never past the URL's life
  it('redirects to a storage URL and reuses it for less than its life', async () => {
    const { controller } = initController({ getImageUrl: jest.fn().mockResolvedValue('https://storage/image.png') });
    const res = responseMock();

    await controller.show(NAME, signed(), res);

    expect(res.redirect).toHaveBeenCalledWith('https://storage/image.png');
    const cache = headersOf(res)['Cache-Control'];
    expect(cache).toMatch(/^private, /);
    expect(Number(/max-age=(\d+)/.exec(cache)[1])).toBeLessThan(3600);
  });
});
