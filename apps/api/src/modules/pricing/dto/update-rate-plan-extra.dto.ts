import { PartialType } from '@nestjs/mapped-types';
import { CreateRatePlanExtraDto } from './create-rate-plan-extra.dto';

export class UpdateRatePlanExtraDto extends PartialType(CreateRatePlanExtraDto) {}
