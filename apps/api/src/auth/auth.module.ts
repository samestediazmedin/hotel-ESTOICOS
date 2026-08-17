import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenService } from './token.service';
import { LoginAttemptService } from './login-attempt.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // secrets passed per-sign call (from env vars)
  ],
  providers: [AuthService, TokenService, LoginAttemptService, JwtStrategy],
  controllers: [AuthController],
  exports: [TokenService],
})
export class AuthModule {}
