import FileSaver from "file-saver";
import { staticService } from "./static.service";
import { rememberFileSignatures } from "../_helpers/fileSignatures";

jest.mock("../_config/env.config", () => ({ API_URL: "http://api" }));
jest.mock("file-saver", () => ({
  __esModule: true,
  default: { saveAs: jest.fn() },
}));
jest.mock("jszip", () =>
  jest.fn().mockImplementation(() => ({
    file: jest.fn(),
    generateAsync: jest.fn(() => Promise.resolve(new Blob(["zip"]))),
  })),
);

describe("static service", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("saves the chosen images as vision_images.zip", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(["png"])),
      }),
    ) as unknown as typeof fetch;

    await staticService.downloadAsZip([{ name: "a.png", filename: "Payment" }]);

    expect(FileSaver.saveAs).toHaveBeenCalledWith(
      expect.anything(),
      "vision_images.zip",
    );
  });

  it("builds signed image links from the answers it has seen", () => {
    rememberFileSignatures([
      {
        imageName: "a.png",
        fileSignatures: { "a.png": "sig+a" },
        testVariation: { fileSignatures: { "b.png": "report.sig-b" } },
      },
    ]);

    expect(staticService.getImage("a.png")).toBe(
      "http://api/images/a.png?sig=sig%2Ba",
    );
    expect(staticService.getImage("b.png")).toBe(
      "http://api/images/b.png?sig=report.sig-b",
    );
    expect(staticService.getImageDownloadUrl("a.png")).toBe(
      "http://api/images/a.png/download?sig=sig%2Ba",
    );
    // a name the server never signed: the link answers 404 like a missing file
    expect(staticService.getImage("c.png")).toBe(
      "http://api/images/c.png?sig=",
    );
  });
});
