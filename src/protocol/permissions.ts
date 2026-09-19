import { z } from "zod";

export const PERMISSIONS = [
  "search_external",
  "hire_agents",
  "spend_credits",
  "share_destination",
  "share_travel_dates",
  "share_traveler_name",
  "share_budget",
  "access_identity_documents",
  "access_payment_methods",
  "access_private_files",
  "access_credentials",
] as const;

export const PermissionSchema = z.enum(PERMISSIONS);

export type Permission = z.infer<typeof PermissionSchema>;
