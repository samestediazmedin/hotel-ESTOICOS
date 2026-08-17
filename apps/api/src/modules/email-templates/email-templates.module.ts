import { Module, OnModuleInit } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplatesController } from './email-templates.controller';

@Module({
  providers: [EmailTemplatesService],
  controllers: [EmailTemplatesController],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule implements OnModuleInit {
  constructor(private readonly service: EmailTemplatesService) {}

  async onModuleInit(): Promise<void> {
    await this.service.seedBaseTemplates();
  }
}
