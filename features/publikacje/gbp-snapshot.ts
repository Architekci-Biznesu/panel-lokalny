import type { GbpLocation } from "@/features/wizytowka/types";

/** "job_type_id:car_wash" -> "car wash" (structured items have no label). */
function serviceTypeLabel(serviceTypeId: string): string {
  return serviceTypeId
    .replace(/^[a-z_]+:/, "")
    .replace(/_/g, " ")
    .trim();
}

/** Category and service names from the saved Google profile snapshot. */
export function extractGbpSnapshot(raw: unknown): {
  categories: string[];
  services: string[];
} {
  if (!raw || typeof raw !== "object") return { categories: [], services: [] };
  const location = raw as GbpLocation;

  const categories = [
    location.categories?.primaryCategory,
    ...(location.categories?.additionalCategories ?? []),
  ]
    .map((category) => category?.displayName?.trim())
    .filter((name): name is string => Boolean(name));

  const services = (location.serviceItems ?? [])
    .map((item) => {
      const label = item.freeFormServiceItem?.label?.displayName?.trim();
      if (label) return label;
      const typeId = item.structuredServiceItem?.serviceTypeId;
      return typeId ? serviceTypeLabel(typeId) : "";
    })
    .filter(Boolean);

  return {
    categories: [...new Set(categories)],
    services: [...new Set(services)].slice(0, 30),
  };
}
