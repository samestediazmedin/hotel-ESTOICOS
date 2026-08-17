// Force load .env from this package, not from cwd (Turbo behavior is reliable
// but be defensive). dotenv/config must run BEFORE any module imports DATABASE_URL.
import 'dotenv/config';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: path.resolve(__dirname, '..', '.env'), override: false });

console.log('[boot] DATABASE_URL set:', Boolean(process.env.DATABASE_URL));
console.log('[boot] PORT:', process.env.PORT);

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ── CRITICAL (Phase 08 P1): trust the first proxy in chain (Railway) ──
  // Without this, req.ip is the proxy's IP (loopback 127.0.0.1) and IP-based
  // rate limiting becomes a GLOBAL limit of 20/hour for ALL visitors combined,
  // not a per-visitor limit. Required for IpThrottlerGuard AND for csrf-csrf
  // getSessionIdentifier:(req)=>req.ip to bind correctly per visitor.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // ── Security headers (S01 fix) ─────────────────────────────────────────────
  // Helmet sets secure defaults: X-Content-Type-Options, X-Frame-Options,
  // Strict-Transport-Security, X-XSS-Protection, and more.
  // CSP is strict because this API serves JSON only (SPA is served separately).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameSrc: ["'none'"],
          scriptSrc: ["'none'"],
        },
      },
      strictTransportSecurity: {
        maxAge: 63_072_000, // 2 years in seconds
        includeSubDomains: true,
      },
    }),
  );

  // Remove Express fingerprint — helmet does NOT remove this by default.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  app.use(cookieParser());

  // ── CORS (MEDIUM-1 fix) ────────────────────────────────────────────────────
  // Defense-in-depth: explicit origin allowlist. Today the web app proxies
  // /api requests from the same origin, so CORS is not strictly required for
  // the normal flow. But exposing the API on its own subdomain (or calling it
  // directly from a different origin) would fail silently without this.
  //
  // WEB_ORIGIN env var: comma-separated list of allowed origins.
  // Default includes the production web URL + localhost dev server.
  const defaultOrigins = [
    'https://hotel-os-web-production.up.railway.app',
    'http://localhost:5173',
  ];
  const corsOrigins = process.env.WEB_ORIGIN
    ? process.env.WEB_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : defaultOrigins;

  app.enableCors({
    origin: corsOrigins,
    credentials: true, // httpOnly cookies (refresh token, CSRF)
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    maxAge: 86400, // preflight cache 24h
  });

  // ── 2026-05-28 — Static image serving (filesystem-first storage) ──
  // STORAGE_DIR is Railway Volume mount (/app/storage) in prod, ./storage in dev.
  // Mounted BEFORE the /api prefix is applied so paths are: /images/<file>
  // immutable + 7d cache because filename hashes guarantee content does not change.
  const storageDir = path.resolve(process.env.STORAGE_DIR ?? './storage');
  app.use(
    '/images',
    // Block any request to a .json sidecar — those carry uploader id and
    // arbitrary context metadata that must not leak to public visitors.
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path.endsWith('.json')) {
        res.status(404).end();
        return;
      }
      next();
    },
    express.static(path.join(storageDir, 'images'), {
      maxAge: '7d',
      immutable: true,
      index: false,
      fallthrough: false,
    }),
  );
  // Thumbnails live in a sibling directory but are served under the same
  // /images URL prefix (so the frontend just builds `/images/thumbnails/x.jpg`).
  app.use(
    '/images/thumbnails',
    express.static(path.join(storageDir, 'thumbnails'), {
      maxAge: '7d',
      immutable: true,
      index: false,
      fallthrough: false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true, // Enable class-transformer to instantiate DTOs
    }),
  );

  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3001);
  console.log(`API running on port ${process.env.PORT ?? 3001}`);
}
bootstrap();
