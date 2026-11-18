import mongoose from 'mongoose';
import { validateEnv } from '../config/env';
import { AUDIT_LOG_MODEL, modelDefinitions } from './schemas';

async function main(): Promise<void> {
  const env = validateEnv();
  await mongoose.connect(env.MONGODB_URI);
  try {
    for (const definition of modelDefinitions) {
      const model = mongoose.model(definition.name, definition.schema);
      if (definition.name === AUDIT_LOG_MODEL) {
        await model.createIndexes();
        await model.collection.createIndex(
          { createdAt: 1 },
          { expireAfterSeconds: env.AUDIT_RETENTION_DAYS * 86_400, name: 'audit-retention' }
        );
        continue;
      }
      await model.syncIndexes();
    }
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch(() => {
  console.error('Index synchronization failed');
  process.exitCode = 1;
});
