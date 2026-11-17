import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleService } from './google.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MailService } from './mail.service';
import { RateLimitService } from './rate-limit.service';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtAuthGuard, MailService, GoogleService, RateLimitService],
  exports: [AuthService, TokenService, JwtAuthGuard, MailService, RateLimitService],
})
export class AuthModule {}
