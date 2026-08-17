import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { EmailTemplatesService, CreateEmailTemplateDto, UpdateEmailTemplateDto } from './email-templates.service';

@Controller('email-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailTemplatesController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() data: CreateEmailTemplateDto) {
    return this.service.create(data);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() data: UpdateEmailTemplateDto) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
