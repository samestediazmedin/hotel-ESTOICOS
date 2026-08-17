import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SeedAdminCommand } from './seed-admin.command';

@Module({
  imports: [PrismaModule],
  providers: [SeedAdminCommand],
})
export class SeedModule {}
