import mongoose from 'mongoose';
import { validateEnv } from '../config/env';
import {
  ENVIRONMENT_MODEL,
  EnvironmentSchema,
  PROJECT_MODEL,
  ProjectSchema,
  SECRET_MODEL,
  SecretSchema,
  USER_MODEL,
  UserSchema,
  WORKSPACE_MODEL,
  WorkspaceSchema,
} from './schemas';

async function main(): Promise<void> {
  const env = validateEnv();
  if (env.NODE_ENV !== 'development') {
    throw new Error('Seeding is only allowed in development');
  }

  await mongoose.connect(env.MONGODB_URI);
  try {
    const user = await mongoose
      .model(USER_MODEL, UserSchema)
      .findOneAndUpdate(
        { email: 'dev-seed@aegis.invalid' },
        { $set: { name: 'DEV SEED User' } },
        { upsert: true, new: true, runValidators: true }
      );

    const workspace = await mongoose
      .model(WORKSPACE_MODEL, WorkspaceSchema)
      .findOneAndUpdate(
        { slug: 'dev-seed-workspace' },
        { $set: { name: 'DEV SEED Workspace', ownerId: user._id } },
        { upsert: true, new: true, runValidators: true }
      );

    const project = await mongoose
      .model(PROJECT_MODEL, ProjectSchema)
      .findOneAndUpdate(
        { workspaceId: workspace._id, slug: 'dev-seed-project' },
        { $set: { name: 'DEV SEED Project' } },
        { upsert: true, new: true, runValidators: true }
      );

    for (const slug of ['development', 'production']) {
      await mongoose
        .model(ENVIRONMENT_MODEL, EnvironmentSchema)
        .findOneAndUpdate(
          { projectId: project._id, slug },
          { $set: { name: slug, workspaceId: workspace._id } },
          { upsert: true, new: true, runValidators: true }
        );
    }

    await mongoose
      .model(SECRET_MODEL, SecretSchema)
      .findOneAndUpdate(
        { projectId: project._id, name: 'DEV_SEED_EXAMPLE' },
        { $set: { workspaceId: workspace._id, description: 'Development seed placeholder, not a real secret' } },
        { upsert: true, new: true, runValidators: true }
      );
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch(() => {
  console.error('Development seeding failed');
  process.exitCode = 1;
});
