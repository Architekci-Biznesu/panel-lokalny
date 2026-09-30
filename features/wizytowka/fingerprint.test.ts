import assert from "node:assert/strict";
import { listFingerprint } from "./fingerprint";
import type { GbpLocation } from "./types";

const services: GbpLocation = {
  serviceItems: [
    {
      freeFormServiceItem: { category: "c1", label: { displayName: "Masaż" } },
    },
    { structuredServiceItem: { serviceTypeId: "job_type_id:a" } },
  ],
};

// Same list, keys in another order and empty values - same fingerprint.
{
  const reordered = {
    serviceItems: [
      {
        freeFormServiceItem: {
          label: { description: "", displayName: "Masaż" },
          category: "c1",
        },
      },
      { structuredServiceItem: { serviceTypeId: "job_type_id:a" } },
    ],
  } as GbpLocation;
  assert.equal(
    listFingerprint(services, "serviceItems"),
    listFingerprint(reordered, "serviceItems"),
  );
}

// A service added in Google changes it.
{
  const added = {
    serviceItems: [
      ...(services.serviceItems ?? []),
      {
        freeFormServiceItem: { category: "c1", label: { displayName: "Nowa" } },
      },
    ],
  } as GbpLocation;
  assert.notEqual(
    listFingerprint(services, "serviceItems"),
    listFingerprint(added, "serviceItems"),
  );
}

// Missing list and empty list are the same; other fields do not matter.
{
  assert.equal(
    listFingerprint({}, "specialHours"),
    listFingerprint({ specialHours: {} }, "specialHours"),
  );
  assert.equal(
    listFingerprint({ ...services, title: "A" }, "serviceItems"),
    listFingerprint({ ...services, title: "B" }, "serviceItems"),
  );
}

console.log("fingerprint.test: OK");
