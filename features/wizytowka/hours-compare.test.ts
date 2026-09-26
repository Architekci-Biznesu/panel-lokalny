import assert from "node:assert/strict";
import {
  dayOpenMinutesFromLabel,
  gbpPeriodOpenMinutes,
  weeklyMinutesFromGbpPeriods,
  weeklyMinutesFromOperatingHours,
} from "./hours-compare";

{
  assert.equal(dayOpenMinutesFromLabel("Closed"), 0);
  assert.equal(dayOpenMinutesFromLabel("Zamknięte"), 0);
  assert.equal(dayOpenMinutesFromLabel("24 hours"), 24 * 60);
  assert.equal(dayOpenMinutesFromLabel("9:00–17:00"), 8 * 60);
  assert.equal(dayOpenMinutesFromLabel("7 AM–5 PM"), 10 * 60);
  assert.equal(dayOpenMinutesFromLabel("9 AM–12 PM, 2–6 PM"), 7 * 60);
}

{
  const weekly = weeklyMinutesFromOperatingHours({
    monday: "9:00–17:00",
    tuesday: "9:00–17:00",
    wednesday: "9:00–17:00",
    thursday: "9:00–17:00",
    friday: "9:00–17:00",
    saturday: "Closed",
    sunday: "Zamknięte",
  });
  assert.equal(weekly, 5 * 8 * 60);
}

{
  const minutes = gbpPeriodOpenMinutes({
    openDay: "MONDAY",
    openTime: { hours: 9, minutes: 0 },
    closeDay: "MONDAY",
    closeTime: { hours: 17, minutes: 0 },
  });
  assert.equal(minutes, 8 * 60);

  const overnight = gbpPeriodOpenMinutes({
    openDay: "FRIDAY",
    openTime: { hours: 22, minutes: 0 },
    closeDay: "SATURDAY",
    closeTime: { hours: 2, minutes: 0 },
  });
  assert.equal(overnight, 4 * 60);

  const total = weeklyMinutesFromGbpPeriods([
    {
      openDay: "MONDAY",
      openTime: { hours: 9 },
      closeDay: "MONDAY",
      closeTime: { hours: 17 },
    },
    {
      openDay: "TUESDAY",
      openTime: { hours: 9 },
      closeDay: "TUESDAY",
      closeTime: { hours: 17 },
    },
  ]);
  assert.equal(total, 16 * 60);
}

console.log("hours-compare tests passed");
