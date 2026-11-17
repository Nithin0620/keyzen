import { Module } from '@nestjs/common';
import { PolicyGuard } from './policy.guard';
import { PolicyService } from './policy.service';

@Module({
  providers: [PolicyService, PolicyGuard],
  exports: [PolicyService, PolicyGuard],
})
export class AuthzModule {}
