import {
  CalendarDays,
  ClipboardList,
  Clock3,
  FileText,
  Globe,
  ImageIcon,
  ListChecks,
  MapPin,
  Phone,
  Tags,
  Type,
  type LucideIcon,
} from "lucide-react";

/**
 * One place for the icons of Wizytówka items: the proposal tiles ("Do Twojej
 * decyzji") and the Pulpit "Co do poprawy" list show the same icon for the
 * same thing.
 */

/** AI proposals by field (GBP suggestion field). */
export const PROPOSAL_FIELD_ICONS: Record<string, LucideIcon> = {
  title: Type,
  description: FileText,
  services: ClipboardList,
  primary_category: Tags,
  additional_categories: Tags,
};

/** Cards that ask the customer to fill something in, not AI proposals. */
export const NUDGE_ICONS = {
  special_hours: CalendarDays,
  regular_hours: Clock3,
  attributes: ListChecks,
  photos: ImageIcon,
} as const;

/** Profile completeness checks (Pulpit "Do uzupełnienia") by check id. */
export const COMPLETENESS_CHECK_ICONS: Record<string, LucideIcon> = {
  title: Type,
  primary_category: Tags,
  description: FileText,
  phone: Phone,
  website: Globe,
  address: MapPin,
  hours: Clock3,
  services: ClipboardList,
  attributes: ListChecks,
  photos: ImageIcon,
};
