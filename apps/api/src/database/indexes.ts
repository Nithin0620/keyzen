import mongoose from 'mongoose';
import { validateEnv } from '../config/env';
import { modelDefinitions } from './schemas';

async function main(): Promise<void> {
  await mongoose.connect(validateEnv().MONGODB_URI);
  try {
    for (const definition of modelDefinitions) {
      await mongoose.model(definition.name, definition.schema).syncIndexes();
    }
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch(() => {
  console.error('Index synchronization failed');
  process.exitCode = 1;
});
