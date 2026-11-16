import { dayStrip } from "./backups.helper";

const at = (date: string) => ({
  name: `vision-${date}.sql.gz`,
  size: 1,
  modifiedTime: `${date}T03:00:00`,
});

describe("backup days", () => {
  it("marks each of the last 14 days with or without a backup", () => {
    const today = new Date("2026-10-29T12:00:00");
    const strip = dayStrip(
      [at("2026-10-29"), at("2026-10-28"), at("2026-10-26"), at("2026-10-20")],
      today,
      7,
    );
    expect(strip).toHaveLength(14);
    expect(strip[13]).toEqual({ date: "2026-10-29", state: "kept" });
    expect(strip[12]).toEqual({ date: "2026-10-28", state: "kept" });
    // a day inside the kept copies without a backup is a missed backup
    expect(strip[11]).toEqual({ date: "2026-10-27", state: "missing" });
    expect(strip[10].state).toBe("kept");
    // the oldest of the seven kept copies should be there and is not
    expect(strip[7]).toEqual({ date: "2026-10-23", state: "missing" });
    // older than the seven copies Drive keeps: no backup is expected there
    expect(strip[6]).toEqual({ date: "2026-10-22", state: "rotated" });
    expect(strip[5]).toEqual({ date: "2026-10-21", state: "rotated" });
    // a backup that is still there counts even past the kept count
    expect(strip[4]).toEqual({ date: "2026-10-20", state: "kept" });
    expect(dayStrip([], today, 30).every((d) => d.state === "missing")).toBe(
      true,
    );
  });
});
