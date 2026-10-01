import assert from "node:assert/strict";
import { formatDayRanges, periodFromRange, rangesByDay } from "./hours-display";
import type { GbpPeriod } from "./types";

// Real hours of a restaurant open past midnight, as Google returns them:
// split at 00:00, midnight as an empty time.
const setka: GbpPeriod[] = [
  {
    openDay: "SUNDAY",
    closeDay: "SUNDAY",
    openTime: {},
    closeTime: { hours: 4 },
  },
  {
    openDay: "SUNDAY",
    closeDay: "SUNDAY",
    openTime: { hours: 9 },
    closeTime: { hours: 24 },
  },
  {
    openDay: "MONDAY",
    closeDay: "MONDAY",
    openTime: {},
    closeTime: { hours: 4 },
  },
  {
    openDay: "MONDAY",
    closeDay: "MONDAY",
    openTime: { hours: 13 },
    closeTime: { hours: 24 },
  },
  {
    openDay: "TUESDAY",
    closeDay: "TUESDAY",
    openTime: { hours: 13 },
    closeTime: { hours: 24 },
  },
  {
    openDay: "WEDNESDAY",
    closeDay: "WEDNESDAY",
    openTime: { hours: 13 },
    closeTime: { hours: 24 },
  },
  {
    openDay: "THURSDAY",
    closeDay: "THURSDAY",
    openTime: { hours: 13 },
    closeTime: { hours: 24 },
  },
  {
    openDay: "FRIDAY",
    closeDay: "FRIDAY",
    openTime: { hours: 13 },
    closeTime: { hours: 24 },
  },
  {
    openDay: "SATURDAY",
    closeDay: "SATURDAY",
    openTime: {},
    closeTime: { hours: 2 },
  },
  {
    openDay: "SATURDAY",
    closeDay: "SATURDAY",
    openTime: { hours: 9 },
    closeTime: { hours: 24 },
  },
];

// Shown like Google: Niedziela 09:00-04:00, Pn-Czw 13:00-00:00, Pt 13:00-02:00, Sb 09:00-04:00.
{
  const days = rangesByDay(setka);
  assert.equal(formatDayRanges(days.SUNDAY), "09:00-04:00");
  assert.equal(formatDayRanges(days.MONDAY), "13:00-00:00");
  assert.equal(formatDayRanges(days.THURSDAY), "13:00-00:00");
  assert.equal(formatDayRanges(days.FRIDAY), "13:00-02:00");
  assert.equal(formatDayRanges(days.SATURDAY), "09:00-04:00");
}

// A real overnight period (closeDay = next day) and a plain day.
{
  const days = rangesByDay([
    {
      openDay: "FRIDAY",
      closeDay: "SATURDAY",
      openTime: { hours: 20 },
      closeTime: { hours: 3 },
    },
    {
      openDay: "MONDAY",
      closeDay: "MONDAY",
      openTime: { hours: 9 },
      closeTime: { hours: 17, minutes: 30 },
    },
  ]);
  assert.equal(formatDayRanges(days.FRIDAY), "20:00-03:00");
  assert.equal(formatDayRanges(days.SATURDAY), "");
  assert.equal(formatDayRanges(days.MONDAY), "09:00-17:30");
}

// Editor -> Google: overnight closes the next day, midnight is 24:00.
{
  assert.deepEqual(periodFromRange("SUNDAY", "09:00", "04:00"), {
    openDay: "SUNDAY",
    closeDay: "MONDAY",
    openTime: "09:00",
    closeTime: "04:00",
  });
  assert.deepEqual(periodFromRange("MONDAY", "13:00", "00:00"), {
    openDay: "MONDAY",
    closeDay: "MONDAY",
    openTime: "13:00",
    closeTime: "24:00",
  });
  assert.deepEqual(periodFromRange("MONDAY", "09:00", "17:00"), {
    openDay: "MONDAY",
    closeDay: "MONDAY",
    openTime: "09:00",
    closeTime: "17:00",
  });
}

console.log("hours-display.test: OK");
