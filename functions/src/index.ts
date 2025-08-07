import { onSchedule } from "firebase-functions/v2/scheduler";
import { sendSwiftReports } from "./sendSwiftReports";

export const dailySwiftReport = onSchedule(
  { schedule: "every 24 hours", timeZone: "Africa/Johannesburg" },
  () => sendSwiftReports("daily")
);

export const weeklySwiftReport = onSchedule(
  { schedule: "every monday 08:00", timeZone: "Africa/Johannesburg" },
  () => sendSwiftReports("weekly")
);
