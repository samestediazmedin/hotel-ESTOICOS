import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { AdminSelfProtectionGuard } from '../shared/guards/admin-self-protection.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateUserDto, @Req() req: Request) {
    return this.usersService.createUser(dto, req.user as any);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminSelfProtectionGuard)
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.usersService.updateUser(id, dto, req.user as any);
  }

  @Post(':id/activate')
  @Roles('ADMIN')
  activate(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.changeStatus(id, 'ACTIVE', req.user as any);
  }

  @Post(':id/suspend')
  @UseGuards(AdminSelfProtectionGuard)
  @Roles('ADMIN')
  suspend(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.changeStatus(id, 'SUSPENDED', req.user as any);
  }

  @Post(':id/deactivate')
  @UseGuards(AdminSelfProtectionGuard)
  @Roles('ADMIN')
  deactivate(@Param('id') id: string, @Req() req: Request) {
    return this.usersService.changeStatus(id, 'INACTIVE', req.user as any);
  }

  @Post(':id/change-password')
  @Roles('ADMIN')
  changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.usersService.changePassword(id, dto, req.user as any);
  }

  @Post(':id/reset-password')
  @Roles('ADMIN')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: { tempPassword: string },
    @Req() req: Request,
  ) {
    return this.usersService.resetPassword(id, dto.tempPassword, req.user as any);
  }
}
