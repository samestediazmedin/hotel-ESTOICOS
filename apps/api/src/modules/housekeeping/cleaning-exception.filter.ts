import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { CleaningDomainException } from './domain/cleaning-transitions';

/**
 * CleaningDomainExceptionFilter — converts CleaningDomainException to HTTP 400.
 *
 * State machine violations are 400 BadRequest (not 412 PreconditionFailed).
 * 412 is reserved for cleaningStatus guard at check-in (OPS-03 semantics).
 */
@Catch(CleaningDomainException)
export class CleaningDomainExceptionFilter
  implements ExceptionFilter<CleaningDomainException>
{
  catch(exception: CleaningDomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: exception.message,
      error: 'Bad Request',
    });
  }
}
