import { Injectable, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto, validateAdminPassword, validateRegularPassword } from './dto/change-password.dto';

// Fields to select — never return passwordHash to callers
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  isActive: true,
  mustChangePassword: true,
  lastPasswordChange: true,
  createdAt: true,
  updatedAt: true,
} as const;

const BCRYPT_ROUNDS = 12;

interface AuthUser {
  sub: string;
  role: string;
  email: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async createUser(dto: CreateUserDto, actor?: AuthUser) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
          role: dto.role as any,
        },
        select: USER_SELECT,
      });

      // Audit log
      await this.auditService.log({
        action: 'USER_CREATE',
        actorId: actor?.sub ?? 'system',
        targetId: user.id,
        details: {
          email: dto.email,
          role: dto.role,
          name: dto.name,
        },
      });

      return user;
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        throw new ConflictException('Ya existe un usuario con este email');
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
  }

  async updateUser(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new BadRequestException('Usuario no encontrado');

    // Self-protection: admin cannot change own role
    if (id === actor.sub && targetUser.role === 'ADMIN' && dto.role && dto.role !== 'ADMIN') {
      throw new ForbiddenException('No puedes cambiar el rol de tu propia cuenta de administrador');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.name && { name: dto.name }),
        ...(dto.role && { role: dto.role as any }),
      },
      select: USER_SELECT,
    });

    // Audit log
    await this.auditService.log({
      action: 'USER_UPDATE',
      actorId: actor.sub,
      targetId: id,
      details: {
        changes: dto,
        previousRole: targetUser.role,
        newRole: dto.role || targetUser.role,
      },
    });

    return updated;
  }

  async changeStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE', actor: AuthUser) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new BadRequestException('Usuario no encontrado');

    // Self-protection: admin cannot deactivate/suspend self
    if (id === actor.sub && targetUser.role === 'ADMIN' && status !== 'ACTIVE') {
      throw new ForbiddenException('No puedes desactivar ni suspender tu propia cuenta de administrador');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { 
        status,
        isActive: status === 'ACTIVE',
      },
      select: USER_SELECT,
    });

    // Revoke sessions if deactivating/suspending
    if (status !== 'ACTIVE') {
      await this.tokenService.revokeAllSessions(id);
    }

    // Audit log
    await this.auditService.log({
      action: `USER_STATUS_${status}`,
      actorId: actor.sub,
      targetId: id,
      details: {
        previousStatus: targetUser.status,
        newStatus: status,
      },
    });

    return updated;
  }

  async changePassword(id: string, dto: ChangePasswordDto, actor: AuthUser) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new BadRequestException('Usuario no encontrado');

    const isAdminTarget = targetUser.role === 'ADMIN';
    const isSelf = id === actor.sub;

    // Validate password complexity
    const validator = isAdminTarget ? validateAdminPassword : validateRegularPassword;
    if (!dto.tempPassword) {
      throw new BadRequestException('La contraseña temporal es requerida');
    }
    const validation = validator(dto.tempPassword);
    if (!validation.valid) {
      throw new BadRequestException(`Requisitos de contraseña no cumplidos: ${validation.errors.join(', ')}`);
    }

    // For admin targets: require current password verification
    if (isAdminTarget) {
      if (!dto.currentPassword) {
        throw new ForbiddenException('Para cambiar la contraseña de un administrador, debes confirmar tu contraseña actual');
      }

      // Verify actor's current password
      const actorUser = await this.prisma.user.findUnique({ where: { id: actor.sub } });
      if (!actorUser) throw new ForbiddenException('Actor no encontrado');

      const isValid = await bcrypt.compare(dto.currentPassword, actorUser.passwordHash);
      if (!isValid) {
        throw new ForbiddenException('Contraseña actual incorrecta');
      }
    }

    const passwordHash = await bcrypt.hash(dto.tempPassword, BCRYPT_ROUNDS);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: passwordHash,
        mustChangePassword: true,
        lastPasswordChange: new Date(),
      },
      select: USER_SELECT,
    });

    // Revoke all sessions for security
    await this.tokenService.revokeAllSessions(id);

    // Audit log
    await this.auditService.log({
      action: 'USER_PASSWORD_CHANGE',
      actorId: actor.sub,
      targetId: id,
      details: {
        targetRole: targetUser.role,
        isSelf,
        requiredVerification: isAdminTarget,
      },
    });

    return updated;
  }

  /**
   * Admin password reset — sets temp password and forces change on next login (D-17).
   */
  async resetPassword(id: string, tempPassword: string, actor: AuthUser) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new BadRequestException('Usuario no encontrado');

    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        lastPasswordChange: new Date(),
      },
      select: USER_SELECT,
    });

    // Audit log
    await this.auditService.log({
      action: 'USER_PASSWORD_RESET',
      actorId: actor.sub,
      targetId: id,
      details: {
        targetRole: targetUser.role,
        targetEmail: targetUser.email,
      },
    });

    return updated;
  }
}
