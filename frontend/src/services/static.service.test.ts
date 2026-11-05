import FileSaver from "file-saver";
import { staticService } from "./static.service";

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
});
