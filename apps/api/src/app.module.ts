import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AuthzModule } from './authz/authz.module';
import { PolicyGuard } from './authz/policy.guard';
import { CryptoModule } from './crypto/crypto.module';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { ProjectsModule } from './projects/projects.module';
import { SecretsModule } from './secrets/secrets.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    DatabaseModule,
    CryptoModule.forRoot(),
    AuthModule,
    AuthzModule,
    WorkspacesModule,
    ProjectsModule,
    SecretsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: PolicyGuard }],
})
export class AppModule {}
