import { RemoteBackup } from "../types";

export type BackupDay = {
  /** YYYY-MM-DD, local time */
  date: string;
  /**
   * kept: a backup of that day is in Drive; missing: none, though one should
   * still be there; rotated: older than the copies Drive keeps, so its absence
   * says nothing
   */
  state: "kept" | "missing" | "rotated";
};

const day = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

/** The last `days` days, newest last, each with or without a backup (REQ-018-69). */
export function dayStrip(
  backups: RemoteBackup[],
  today: Date,
  keep: number,
  days = 14,
): BackupDay[] {
  const withBackup = new Set(
    backups
      .filter((backup) => backup.modifiedTime)
      .map((backup) => day(new Date(backup.modifiedTime as string))),
  );
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    const key = day(date);
    const age = days - 1 - i;
    return {
      date: key,
      state: withBackup.has(key) ? "kept" : age >= keep ? "rotated" : "missing",
    };
  });
}
