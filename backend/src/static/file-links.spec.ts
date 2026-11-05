import { createHash } from 'crypto';
import { fileLinkKey, readFileSignature, signFile, signReportFile, withFileSignatures } from './file-links';

const key = fileLinkKey('file-links-test-key');
const name = '0123456789ABCDEFGHJKMNPQRSTV.screenshot.png';

describe('file links', () => {
  it('opens its own file only and needs the server key', () => {
    const signature = signFile(name, key);

    expect(readFileSignature(name, signature, key)).toEqual({ kind: 'file' });
    // the same signature opens no other file
    expect(readFileSignature('0123456789ABCDEFGHJKMNPQRSTW.screenshot.png', signature, key)).toBeNull();
    // made with another key, it opens nothing: a signature cannot be made without the server's
    expect(readFileSignature(name, signFile(name, fileLinkKey('another-key')), key)).toBeNull();
    expect(readFileSignature(name, undefined, key)).toBeNull();
    expect(readFileSignature(name, '', key)).toBeNull();
    expect(readFileSignature(name, signature.slice(1), key)).toBeNull();
    // it depends on nothing but the name and the key, so it does not run out
    expect(signFile(name, key)).toBe(signature);
    // the key for links is not the key itself
    expect(fileLinkKey('file-links-test-key')).not.toEqual(createHash('sha256').update('file-links-test-key').digest());
  });

  it("ties a report's signature to its token and its file", () => {
    const signature = signReportFile('report-token', name, key);

    expect(readFileSignature(name, signature, key)).toEqual({ kind: 'report', token: 'report-token' });
    expect(readFileSignature(name, signature.replace('report-token', 'other-token'), key)).toBeNull();
    expect(readFileSignature('0123456789ABCDEFGHJKMNPQRSTW.diff.png', signature, key)).toBeNull();
    // a report's signature without its token is no file signature
    expect(readFileSignature(name, signature.split('.')[1], key)).toBeNull();
  });

  it('puts the signatures beside the file names and changes nothing else', () => {
    const sign = (file: string) => `sig:${file}`;
    const answer = [
      {
        id: 'run',
        imageName: 'a.png',
        diffName: null,
        baselineName: 'b.png',
        createdAt: new Date(0),
        testVariation: { baselineName: 'b.png', name: 'Payment' },
        uiTreeName: 'tree.json.gz',
      },
    ];

    expect(withFileSignatures(answer, sign)).toEqual([
      {
        ...answer[0],
        fileSignatures: { 'a.png': 'sig:a.png', 'b.png': 'sig:b.png' },
        testVariation: { baselineName: 'b.png', name: 'Payment', fileSignatures: { 'b.png': 'sig:b.png' } },
      },
    ]);
    expect(withFileSignatures({ total: 3 }, sign)).toEqual({ total: 3 });
    expect(withFileSignatures('text', sign)).toBe('text');
  });
});
