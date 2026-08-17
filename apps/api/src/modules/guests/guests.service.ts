import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { GuestsRepository } from './guests.repository';
import { GuestEncryptionService } from './encryption/guest-encryption.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestResponseDto } from './dto/guest-response.dto';
import { GuestPublicDto } from './dto/guest-public.dto';

/**
 * Minimal guest shape required by toResponseDto / toPublicDto.
 * Accepts both findById result (includes reservations) and update result.
 *
 * Phase 16 — contactEvents is optional because findById (single guest, no include)
 * and update() do not include it. Only findAll() returns it. Both transformers
 * handle undefined as null defensively.
 */
type GuestLike = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: Date;
  anonymizedAt: Date | null;
  createdAt: Date;
  // Phase 15 additions
  preferredLanguage?: string;
  contactPreference?: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
  whatsappNumber?: string | null;
  marketingConsent?: boolean;
  dietaryRestrictions?: string | null;
  specialRequests?: string | null;
  // Phase 16 — latest contact event (from findAll include — take: 1, orderBy desc)
  contactEvents?: Array<{
    method: 'CALL' | 'WHATSAPP' | 'EMAIL';
    createdAt: Date;
    staffUser: { name: string | null };
  }>;
};

/**
 * GuestsService — business logic for guest management.
 *
 * Encryption contract:
 *  - documentNumber is ALWAYS stored as ciphertext in the DB
 *  - toResponseDto() decrypts for ADMIN/MANAGER/RECEPTION
 *  - toPublicDto() omits the field entirely for HOUSEKEEPING (GST-05)
 *  - anonymize() stores the sentinel '[ANONYMIZED]' — not re-encrypted (Pitfall P13)
 *
 * Repository contract:
 *  - this.repo is the ONLY DB access point — never calls this.prisma directly
 */
@Injectable()
export class GuestsService {
  constructor(
    private readonly repo: GuestsRepository,
    private readonly encryption: GuestEncryptionService,
  ) {}

  /**
   * Create a guest.
   * Encrypts documentNumber before persistence.
   * Parses dateOfBirth as UTC midnight to avoid Bogotá timezone off-by-one.
   */
  async create(dto: CreateGuestDto): Promise<GuestResponseDto> {
    const encryptedDoc = this.encryption.encrypt(dto.documentNumber);
    const dateOfBirth = new Date(dto.dateOfBirth + 'T00:00:00.000Z');

    try {
      const guest = await this.repo.createGuest({
        fullName: dto.fullName,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        documentType: dto.documentType,
        documentNumber: encryptedDoc,
        nationality: dto.nationality,
        dateOfBirth,
        // Phase 15 — explicit mapping (silent-drop trap: must enumerate all new fields)
        preferredLanguage: dto.preferredLanguage ?? 'es',
        contactPreference: dto.contactPreference ?? null,
        whatsappNumber: dto.whatsappNumber ?? null,
        marketingConsent: dto.marketingConsent ?? false,
        dietaryRestrictions: dto.dietaryRestrictions ?? null,
        specialRequests: dto.specialRequests ?? null,
      });

      return this.toResponseDto(guest);
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('documentNumber')) {
        throw new ConflictException('Ya existe un huésped con este número de documento');
      }
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        throw new ConflictException('Ya existe un huésped con este email');
      }
      throw error;
    }
  }

  /**
   * Find a guest by ID — returns the raw DB row (documentNumber = ciphertext).
   * Callers must transform via toResponseDto() or toPublicDto().
   */
  async findById(id: string) {
    const guest = await this.repo.findById(id);
    if (!guest) {
      throw new NotFoundException(`Guest ${id} not found`);
    }
    return guest;
  }

  /**
   * Find all guests (pagination + optional search by name).
   * Returns raw rows — callers transform to appropriate DTO.
   */
  findAll(skip = 0, take = 50, search?: string) {
    return this.repo.findAll(skip, take, search);
  }

  /**
   * Update a guest.
   * If documentNumber is present in the patch, it is re-encrypted.
   */
  async update(id: string, dto: UpdateGuestDto): Promise<GuestResponseDto> {
    await this.findById(id); // throws 404 if not found

    const updateData: Parameters<GuestsRepository['update']>[1] = {
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      documentType: dto.documentType,
      nationality: dto.nationality,
      dateOfBirth: dto.dateOfBirth
        ? new Date(dto.dateOfBirth + 'T00:00:00.000Z')
        : undefined,
      // Phase 15 — partial update support (undefined = no change, not override)
      preferredLanguage: dto.preferredLanguage,
      contactPreference: dto.contactPreference,
      whatsappNumber: dto.whatsappNumber,
      marketingConsent: dto.marketingConsent,
      dietaryRestrictions: dto.dietaryRestrictions,
      specialRequests: dto.specialRequests,
    };

    if (dto.documentNumber !== undefined) {
      updateData.documentNumber = this.encryption.encrypt(dto.documentNumber);
    }

    const updated = await this.repo.update(id, updateData);
    return this.toResponseDto(updated);
  }

  /**
   * Anonymize a guest (GST-04).
   * Idempotent: if anonymizedAt is already set, returns early.
   * Stores sentinel '[ANONYMIZED]' — not re-encrypted (Pitfall P13 from 03-RESEARCH).
   * documentNumber column is NOT NULL in schema → sentinel string required.
   */
  async anonymize(id: string): Promise<void> {
    const guest = await this.findById(id);
    if (guest.anonymizedAt !== null) {
      // Already anonymized — idempotent, no-op
      return;
    }
    await this.repo.update(id, {
      documentNumber: '[ANONYMIZED]',
      fullName: '[ANONYMIZED]',
      email: null,
      phone: null,
      anonymizedAt: new Date(),
    });
  }

  /**
   * Get guest reservation history.
   * Aggregates totalNights and totalSpent from linked reservations.
   *
   * Note: totalSpent is from reservation.totalPrice (Phase 03 folio).
   * In Phase 03, totalPrice may be 0 if folio hasn't been created yet.
   * Full folio integration is Phase 04.
   */
  async getHistory(id: string): Promise<{
    guest: GuestResponseDto;
    reservations: Awaited<ReturnType<GuestsRepository['findReservationsByGuestId']>>;
    totalNights: number;
    totalSpent: number;
  }> {
    const guest = await this.findById(id);
    const reservations = await this.repo.findReservationsByGuestId(id);

    const totalNights = reservations.reduce(
      (sum, r) => sum + ((r as any).totalNights ?? 0),
      0,
    );
    const totalSpent = reservations.reduce(
      (sum, r) => sum + ((r as any).totalPrice ?? 0),
      0,
    );

    return {
      guest: this.toResponseDto(guest),
      reservations,
      totalNights,
      totalSpent,
    };
  }

  /**
   * Remove a guest permanently (hard delete).
   *
   * Rules:
   *  - 404 if the guest does not exist.
   *  - 409 ConflictException if the guest has ≥1 reservation — hard delete is
   *    forbidden to preserve historical integrity. The caller should use
   *    anonymize() instead.
   *  - guest_contact_events are deleted automatically by the CASCADE FK.
   */
  async remove(id: string): Promise<void> {
    await this.findById(id); // throws 404 if not found

    const reservationCount = await this.repo.countReservationsByGuestId(id);
    if (reservationCount > 0) {
      throw new ConflictException(
        'No se puede eliminar: el huésped tiene reservas asociadas. ' +
          'Use anonimizar para proteger sus datos conservando el historial.',
      );
    }

    await this.repo.deleteGuest(id);
  }

  // ─── AI-only methods (Phase 07) ──────────────────────────────────────────

  /**
   * searchByNameForAI — case-insensitive name search for the AI find_guest tool.
   *
   * Returns a strictly limited DTO with NO documentNumber — stricter than the
   * two-DTO RBAC pattern used for staff (AI never receives documentNumber, AI-06).
   *
   * @param query - Sanitized guest name (partial match allowed)
   * @returns Up to 10 matches: id, fullName, nationality, totalStays
   */
  async searchByNameForAI(query: string): Promise<
    Array<{ id: string; fullName: string; nationality: string; totalStays: number }>
  > {
    const rows = await this.repo.searchByNameInsensitive(query, 10);
    return rows.map((g) => ({
      id: g.id,
      fullName: g.fullName,
      nationality: g.nationality,
      totalStays: (g as any)._count?.reservations ?? 0,
    }));
    // NEVER include documentNumber — stricter than GuestPublicDto
  }

  // ─── DTO transformers ──────────────────────────────────────────────────────

  /**
   * toResponseDto — full guest data for ADMIN/MANAGER/RECEPTION.
   * Decrypts documentNumber.
   * If anonymizedAt is set, returns the sentinel as-is (not decryptable).
   */
  toResponseDto(raw: GuestLike | null): GuestResponseDto {
    if (!raw) throw new NotFoundException('Guest not found');

    let documentNumber: string;
    if (raw.anonymizedAt !== null) {
      // Sentinel stored as plaintext — return as-is
      documentNumber = raw.documentNumber;
    } else {
      documentNumber = this.encryption.decrypt(raw.documentNumber);
    }

    return {
      id: raw.id,
      fullName: raw.fullName,
      email: raw.email,
      phone: raw.phone,
      documentType: raw.documentType,
      documentNumber,
      nationality: raw.nationality,
      dateOfBirth: raw.dateOfBirth.toISOString().slice(0, 10),
      anonymizedAt: raw.anonymizedAt ? raw.anonymizedAt.toISOString() : null,
      createdAt: raw.createdAt.toISOString(),
      // Phase 15 — extended contact capture fields
      whatsappNumber: raw.whatsappNumber ?? null,
      contactPreference: raw.contactPreference ?? null,
      preferredLanguage: raw.preferredLanguage ?? 'es',
      marketingConsent: raw.marketingConsent ?? false,
      dietaryRestrictions: raw.dietaryRestrictions ?? null,
      specialRequests: raw.specialRequests ?? null,
      // Phase 16 — map latest contact event (defensive: undefined → null)
      lastContactEvent:
        raw.contactEvents && raw.contactEvents.length > 0
          ? {
              method: raw.contactEvents[0].method,
              createdAt: raw.contactEvents[0].createdAt.toISOString(),
              staffUserName: raw.contactEvents[0].staffUser.name,
            }
          : null,
    };
  }

  /**
   * toPublicDto — restricted guest data for HOUSEKEEPING role (GST-05).
   * documentNumber is intentionally ABSENT.
   */
  toPublicDto(raw: GuestLike | null): GuestPublicDto {
    if (!raw) throw new NotFoundException('Guest not found');

    return {
      id: raw.id,
      fullName: raw.fullName,
      email: raw.email,
      phone: raw.phone,
      documentType: raw.documentType,
      // documentNumber intentionally omitted
      nationality: raw.nationality,
      dateOfBirth: raw.dateOfBirth.toISOString().slice(0, 10),
      anonymizedAt: raw.anonymizedAt ? raw.anonymizedAt.toISOString() : null,
      createdAt: raw.createdAt.toISOString(),
      // Phase 15 — extended contact capture (public subset — marketingConsent excluded)
      whatsappNumber: raw.whatsappNumber ?? null,
      contactPreference: raw.contactPreference ?? null,
      preferredLanguage: raw.preferredLanguage ?? 'es',
      dietaryRestrictions: raw.dietaryRestrictions ?? null,
      specialRequests: raw.specialRequests ?? null,
      // Phase 16 — map latest contact event (operational, not PII — HOUSEKEEPING included)
      lastContactEvent:
        raw.contactEvents && raw.contactEvents.length > 0
          ? {
              method: raw.contactEvents[0].method,
              createdAt: raw.contactEvents[0].createdAt.toISOString(),
              staffUserName: raw.contactEvents[0].staffUser.name,
            }
          : null,
    };
  }
}
