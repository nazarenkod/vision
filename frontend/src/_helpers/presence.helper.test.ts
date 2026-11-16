import { initialsOf, viewersOn } from "./presence.helper";

describe("presence helper", () => {
  const viewers = [
    { userId: "me", name: "Dmytro N.", testRunId: "r1" },
    { userId: "u1", name: "Olena K.", testRunId: "r1" },
    { userId: "u2", name: "Andrii P.", testRunId: "r2" },
    { userId: "u3", name: "Ira S.", testRunId: null },
  ];

  it("shows the colleagues on a screen and never the person looking", () => {
    expect(viewersOn(viewers, "r1", "me").map((v) => v.userId)).toEqual(["u1"]);
    expect(viewersOn(viewers, "r3", "me")).toEqual([]);
  });

  it("makes two initials of a short name", () => {
    expect(initialsOf("Olena K.")).toBe("OK");
    expect(initialsOf("qa.lead")).toBe("Q");
    expect(initialsOf("")).toBe("?");
  });
});
