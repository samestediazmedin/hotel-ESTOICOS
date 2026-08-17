/**
 * GuestResponseDto — full guest data for ADMIN, MANAGER, RECEPTION roles.
 *
 * Includes documentNumber (decrypted).
 * HOUSEKEEPING role must NOT receive this DTO — use GuestPublicDto instead.
 */
export class GuestResponseDto {
  declare id: string;
  declare fullName: string;
  declare email: string | null;
  declare phone: string | null;
  declare documentType: string;
  /** Decrypted document number — NEVER the raw ciphertext from DB */
  declare documentNumber: string;
  declare nationality: string;
  declare dateOfBirth: string; // ISO date "YYYY-MM-DD"
  declare anonymizedAt: string | null;
  declare createdAt: string;
  /**
   * Phase 16 — last contact event for "Último contacto" column in GuestsPage.
   * Null when guest has no contact history or when DTO built from findById (no include).
   * Only populated when built from findAll (which includes take:1, orderBy:desc).
   */
  // Phase 15 — extended contact capture fields
  declare whatsappNumber: string | null;
  declare contactPreference: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
  declare preferredLanguage: string; // defaults to 'es'
  declare marketingConsent: boolean;
  declare dietaryRestrictions: string | null;
  declare specialRequests: string | null;
  /**
   * Phase 16 — last contact event for "Último contacto" column in GuestsPage.
   * Null when guest has no contact history or when DTO built from findById (no include).
   * Only populated when built from findAll (which includes take:1, orderBy:desc).
   */
  declare lastContactEvent: {
    method: 'CALL' | 'WHATSAPP' | 'EMAIL';
    createdAt: string; // ISO string
    staffUserName: string | null;
  } | null;
}
