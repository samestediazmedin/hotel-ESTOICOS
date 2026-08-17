/**
 * GuestPublicDto — restricted guest data for HOUSEKEEPING role.
 *
 * documentNumber is intentionally ABSENT from this DTO.
 * This is the RBAC field exclusion for GST-05 — enforced at the
 * controller layer via toPublicDto(), not via class-transformer @Exclude.
 *
 * Any developer adding documentNumber here introduces a GST-05 regression.
 */
export class GuestPublicDto {
  declare id: string;
  declare fullName: string;
  declare email: string | null;
  declare phone: string | null;
  declare documentType: string;
  // documentNumber is intentionally ABSENT — HOUSEKEEPING must not see it
  declare nationality: string;
  declare dateOfBirth: string; // ISO date "YYYY-MM-DD"
  declare anonymizedAt: string | null;
  declare createdAt: string;
  /**
   * Phase 16 — last contact event for operational awareness (HOUSEKEEPING needs
   * to know when someone last reached a guest before entering the room).
   * This is operational data, NOT PII — the PII restriction is documentNumber only.
   * Null when guest has no contact history.
   */
  // Phase 15 — extended contact capture fields (public subset — marketingConsent excluded)
  declare whatsappNumber: string | null;
  declare contactPreference: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
  declare preferredLanguage: string; // defaults to 'es'
  declare dietaryRestrictions: string | null;
  declare specialRequests: string | null;
  // marketingConsent intentionally ABSENT — internal hotel data, not returned to guests or HOUSEKEEPING
  /**
   * Phase 16 — last contact event for operational awareness (HOUSEKEEPING needs
   * to know when someone last reached a guest before entering the room).
   * This is operational data, NOT PII — the PII restriction is documentNumber only.
   * Null when guest has no contact history.
   */
  declare lastContactEvent: {
    method: 'CALL' | 'WHATSAPP' | 'EMAIL';
    createdAt: string; // ISO string
    staffUserName: string | null;
  } | null;
}
