import { Page, Route } from "@playwright/test";
import type {
  Build,
  Project,
  TestRun,
  TestVariation,
  User,
} from "~client/types";

export const API_URL = "http://localhost:4200";

export const mockGetProjects = async (page: Page, projects: Project[]) => {
  return page.route(`${API_URL}/projects`, (route, request) => {
    if (request.method() == "GET") {
      return route.fulfill({
        body: JSON.stringify(projects),
      });
    }
    return route.fallback();
  });
};

// device and OS pairs the project's snapshots came from (029)
export const mockGetDevices = async (
  page: Page,
  projectId: string,
  devices: Array<{ device: string; os: string }>,
) =>
  page.route(`${API_URL}/projects/${projectId}/devices`, (route) =>
    route.fulfill({ body: JSON.stringify(devices) }),
  );

// the API answers create and update with the project it saved
export const mockSaveProject = async (page: Page) => {
  return page.route(`${API_URL}/projects`, (route, request) => {
    if (request.method() === "POST" || request.method() === "PUT") {
      const project = request.postDataJSON();
      return route.fulfill({
        body: JSON.stringify({
          ...project,
          id: project.id || "createdProjectId",
          createdAt: "2020-09-14T06:57:25.845Z",
          updatedAt: "2020-09-14T06:57:25.845Z",
        }),
      });
    }
    return route.fallback();
  });
};

// any endpoint failing the way the API does: a status and a message
export const mockApiError = async (
  page: Page,
  url: string | ((url: URL) => boolean),
  status: number,
  message = "Internal server error",
) => {
  return page.route(url, (route) =>
    route.fulfill({
      status,
      body: JSON.stringify({ statusCode: status, message }),
    }),
  );
};

export const mockDeleteProject = async (page: Page, project: Project) => {
  return page.route(`${API_URL}/projects/${project.id}`, (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify(project),
    }),
  );
};

export const mockGetBuilds = async (
  page: Page,
  projectId: string,
  builds: Build[],
) => {
  return page.route(
    (url) =>
      url.pathname === "/builds" &&
      url.searchParams.get("projectId") === projectId,
    (route, request) => {
      const params = new URL(request.url()).searchParams;
      const take = Number(params.get("take"));
      const ciBuildId = params.get("ciBuildId");
      const matching = ciBuildId
        ? builds.filter((build) =>
            build.ciBuildId?.toLowerCase().includes(ciBuildId.toLowerCase()),
          )
        : builds;

      // asked for the page holding a build, the API answers with that page and
      // says where it starts; a build it does not hold leaves the skip alone
      const around = params.get("aroundBuildId");
      const index = around
        ? matching.findIndex((build) => build.id === around)
        : -1;
      const skip =
        index < 0
          ? Number(params.get("skip"))
          : Math.floor(index / take) * take;

      return route.fulfill({
        body: JSON.stringify({
          data: matching.slice(skip, skip + take),
          skip,
          take,
          total: matching.length,
        }),
      });
    },
  );
};

export const mockDeleteBuilds = async (page: Page) => {
  return page.route(
    (url) => /^\/builds\/[^/]+$/.test(url.pathname),
    (route, request) =>
      request.method() === "DELETE"
        ? route.fulfill({ body: JSON.stringify({}) })
        : route.fallback(),
  );
};

export const mockGetBuildDetails = async (page: Page, build: Build) => {
  return page.route(`${API_URL}/builds/${build.id}`, (route) =>
    route.fulfill({
      body: JSON.stringify(build),
    }),
  );
};

export const mockGetTestRuns = async (
  page: Page,
  buildId: string,
  testRuns: TestRun[],
) => {
  return page.route(`${API_URL}/test-runs?buildId=${buildId}`, (route) =>
    route.fulfill({
      body: JSON.stringify(testRuns),
    }),
  );
};

export const mockTestRun = async (page: Page, testRun: TestRun) => {
  return page.route(`${API_URL}/test-runs/${testRun.id}`, (route) =>
    route.fulfill({
      body: JSON.stringify(testRun),
    }),
  );
};

export const mockImage = async (page: Page, image: string) => {
  const fulfillWithImage = (route: Route) =>
    route.fulfill({
      path: `integration_tests/images/${image}`,
    });

  // the API serves an image for display and as bytes for the download zip,
  // each with the signature from the answers in its query (043)
  const at = (path: string) => (url: URL) =>
    url.origin === API_URL && url.pathname === path;
  await page.route(at(`/images/${image}`), fulfillWithImage);
  return page.route(at(`/images/${image}/download`), fulfillWithImage);
};

export const mockUpdateUser = async (page: Page, user: object) => {
  return page.route(`${API_URL}/users`, (route, request) =>
    request.method() === "PUT"
      ? route.fulfill({
          body: JSON.stringify({ ...user, ...request.postDataJSON() }),
        })
      : route.fallback(),
  );
};

export const mockChangePassword = async (page: Page) => {
  return page.route(`${API_URL}/users/password`, (route) =>
    route.fulfill({ body: JSON.stringify(true) }),
  );
};

export const mockGetUsers = async (page: Page, users: User[]) => {
  return page.route(`${API_URL}/users/all`, (route) =>
    route.fulfill({
      body: JSON.stringify(users),
    }),
  );
};

// whether Users can create accounts here: no with LDAP or SSO (035)
export const mockAccountsEnabled = async (page: Page, enabled: boolean) =>
  page.route(`${API_URL}/users/accounts/enabled`, (route) =>
    route.fulfill({ body: JSON.stringify(enabled) }),
  );

export const mockGetTestVariations = async (
  page: Page,
  projectId: string,
  testVariations: TestVariation[],
) => {
  return page.route(
    `${API_URL}/test-variations?projectId=${projectId}`,
    (route) =>
      route.fulfill({
        body: JSON.stringify(testVariations),
      }),
  );
};

export const mockGetTestVariationDetails = async (
  page: Page,
  testVariation: TestVariation,
) => {
  return page.route(
    `${API_URL}/test-variations/details/${testVariation.id}`,
    (route) =>
      route.fulfill({
        body: JSON.stringify(testVariation),
      }),
  );
};

export const mockDeleteTestVariation = async (
  page: Page,
  testVariation: TestVariation,
) => {
  // compared decoded: test variation ids may hold spaces
  return page.route(
    (url) =>
      decodeURIComponent(url.pathname) ===
      `/test-variations/${testVariation.id}`,
    (route, request) =>
      request.method() === "DELETE"
        ? route.fulfill({ body: JSON.stringify(testVariation) })
        : route.fallback(),
  );
};

// merging starts a build on the target branch and answers with it
export const mockMergeTestVariations = async (page: Page, build: Build) => {
  return page.route(
    (url) => url.pathname === "/test-variations/merge",
    (route) => route.fulfill({ body: JSON.stringify(build) }),
  );
};

/** Opens the app in Ukrainian, as if the switch had been set before. */
export const inUkrainian = (page: Page) =>
  page.addInitScript(() =>
    window.localStorage.setItem("vision.language", "uk"),
  );

// Stands in for the events socket (socket.io) on the polling transport, which
// the client tries first. `sent` collects the packets the client sends, such
// as the handshake with its login token ('40{"token":…}') and subscriptions;
// `emit` pushes a server event. A handshake with `rejectToken` is refused as
// the server refuses a token it does not accept.
export const mockSocket = async (
  page: Page,
  { rejectToken }: { rejectToken?: string } = {},
) => {
  const sent: string[] = [];
  const packets: string[] = [];
  let flush: (() => void) | undefined;
  const send = (packet: string) => {
    packets.push(packet);
    flush?.();
  };
  await page.route(`${API_URL}/socket.io/**`, async (route, request) => {
    if (request.method() === "POST") {
      for (const packet of request.postData()?.split("\x1e") ?? []) {
        sent.push(packet);
        // the client joins the default namespace
        if (packet.startsWith("40")) {
          send(
            rejectToken && packet.includes(rejectToken)
              ? '44{"message":"unauthorized"}'
              : '40{"sid":"socket"}',
          );
        }
      }
      return route.fulfill({ body: "ok" });
    }
    if (!new URL(request.url()).searchParams.get("sid")) {
      return route.fulfill({
        body: '0{"sid":"engine","upgrades":[],"pingInterval":25000,"pingTimeout":60000,"maxPayload":1000000}',
      });
    }
    if (packets.length === 0) {
      await new Promise<void>((resolve) => {
        flush = resolve;
        setTimeout(resolve, 500);
      });
    }
    // a long poll answers with what is waiting, or a no-op
    const body = packets.length ? packets.splice(0).join("\x1e") : "6";
    return route.fulfill({ body }).catch(() => undefined);
  });
  return {
    sent,
    emit: (event: string, data: unknown) =>
      send(`42${JSON.stringify([event, data])}`),
  };
};

/**
 * Opens the comparison's side panel when it came up folded: a screen without
 * changed areas and accessibility findings folds it (REQ-046-07). The screens
 * show once the panel is settled, so this waits for them first.
 */
export const unfoldPanel = async (page: Page) => {
  await page
    .getByTestId("reviewPanes")
    .waitFor({ state: "visible", timeout: 10000 });
  const unfold = page.getByTestId("panelUnfold");
  if (!(await unfold.count())) return;
  await unfold.click();
  // the pointer leaves the button, so its tooltip does not stay open
  await page.mouse.move(0, 0);
  await page.getByRole("tooltip", { name: "Hide details" }).waitFor({
    state: "hidden",
  });
};
