import { Injectable, Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
@Command({ name: 'seed:admin', description: 'Seed admin user and system_config (idempotent)' })
export class SeedAdminCommand extends CommandRunner {
  private readonly logger = new Logger(SeedAdminCommand.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async run(): Promise<void> {
    // Step 1: Validate required env vars
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    const timezone = process.env.HOTEL_TIMEZONE;
    const ivaRaw = process.env.IVA_RATE;
    const hotelName = process.env.HOTEL_NAME ?? 'Hotel Sumapaz';

    const missing: string[] = [];
    if (!email) missing.push('SEED_ADMIN_EMAIL');
    if (!password) missing.push('SEED_ADMIN_PASSWORD');
    if (!timezone) missing.push('HOTEL_TIMEZONE');
    if (!ivaRaw) missing.push('IVA_RATE');

    if (missing.length > 0) {
      throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }

    // D-15: Minimum 8 chars for password
    if (password!.length < 8) {
      throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters');
    }

    // Step 2: Compute hotel business date
    // Use HOTEL_BUSINESS_DATE env var if provided (YYYY-MM-DD), otherwise compute
    // from hotel timezone to avoid UTC off-by-one for Colombian hotels seeding at night.
    let businessDate: Date;
    if (process.env.HOTEL_BUSINESS_DATE) {
      businessDate = new Date(`${process.env.HOTEL_BUSINESS_DATE}T00:00:00.000Z`);
    } else {
      // Get current date in hotel timezone (IANA format)
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone!,
      }).format(new Date());
      // en-CA format: YYYY-MM-DD — safe for Date constructor
      businessDate = new Date(`${dateStr}T00:00:00.000Z`);
    }

    // Step 3: Seed admin user (idempotent)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email! },
    });

    if (existingUser) {
      this.logger.log(`Admin already exists: ${email}`);
    } else {
      const passwordHash = await bcrypt.hash(password!, 12);
      await this.prisma.user.create({
        data: {
          email: email!,
          name: 'Administrador',
          passwordHash,
          role: 'ADMIN',
          isActive: true,
          mustChangePassword: false,
        },
      });
      this.logger.log(`Admin created: ${email}`);
    }

    // Step 4: Seed system_config (idempotent)
    const existingConfig = await this.prisma.systemConfig.findFirst();

    if (existingConfig) {
      this.logger.log(
        `system_config already exists: timezone=${existingConfig.hotelTimezone}, businessDate=${existingConfig.hotelBusinessDate.toISOString().slice(0, 10)}`,
      );
    } else {
      const ivaRate = Number.parseFloat(ivaRaw!);
      if (Number.isNaN(ivaRate)) {
        throw new Error(`IVA_RATE is not a valid number: "${ivaRaw}"`);
      }

      await this.prisma.systemConfig.create({
        data: {
          hotelBusinessDate: businessDate,
          hotelTimezone: timezone!,
          ivaRate,
          hotelName,
        },
      });
      this.logger.log(
        `system_config seeded: timezone=${timezone}, iva=${ivaRate}, businessDate=${businessDate.toISOString().slice(0, 10)}, hotelName=${hotelName}`,
      );
    }
  }
}
