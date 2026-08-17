import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService, LoginUser } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in ms

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Body: { email, password }
   * Response: { accessToken, mustChangePassword? }
   * Sets httpOnly cookie with rawRefreshToken
   */
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? '0.0.0.0';
    const result = await this.authService.login(dto.email, dto.password, ip);

    res.cookie(REFRESH_TOKEN_COOKIE, result.rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE,
    });

    const response: { accessToken: string; user: LoginUser; mustChangePassword?: boolean } = {
      accessToken: result.accessToken,
      user: result.user,
    };
    if (result.mustChangePassword) {
      response.mustChangePassword = true;
    }

    return response;
  }

  /**
   * POST /api/auth/refresh
   * Reads httpOnly cookie, rotates token pair
   * Response: { accessToken }
   */
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!rawToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const result = await this.authService.refresh(rawToken);

    res.cookie(REFRESH_TOKEN_COOKIE, result.rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE,
    });

    return { accessToken: result.accessToken, user: result.user };
  }

  /**
   * POST /api/auth/logout
   * Requires valid JWT access token
   * Deletes current device's refresh token row, clears cookie
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (rawToken) {
      await this.authService.logout(rawToken);
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE);
    return {};
  }
}
