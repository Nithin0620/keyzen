import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { validateEnv } from '../config/env';
import { modelDefinitions } from './schemas';

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(validateEnv().MONGODB_URI, {
      retryAttempts: 5,
      retryDelay: 1000,
    }),
    MongooseModule.forFeature(modelDefinitions),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
