import { Module } from '@nestjs/common';
import { KeyRotationService } from './key-rotation.service';
import { SecretsController } from './secrets.controller';
import { SecretsService } from './secrets.service';

@Module({
  controllers: [SecretsController],
  providers: [SecretsService, KeyRotationService],
  exports: [SecretsService, KeyRotationService],
})
export class SecretsModule {}
