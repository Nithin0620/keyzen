import { Schema } from 'mongoose';
import { PROJECT_MODEL, ENVIRONMENT_MODEL } from './project.schema';
import { WORKSPACE_MODEL } from './workspace.schema';

export const SECRET_MODEL = 'Secret';
export const SECRET_VALUE_MODEL = 'SecretValue';
export const SECRET_HISTORY_MODEL = 'SecretHistory';

export const SecretSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: PROJECT_MODEL, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 500 },
  },
  { timestamps: true, strict: true }
);

SecretSchema.index({ projectId: 1, name: 1 }, { unique: true });

export const SecretValueSchema = new Schema(
  {
    secretId: { type: Schema.Types.ObjectId, ref: SECRET_MODEL, required: true, index: true },
    environmentId: { type: Schema.Types.ObjectId, ref: ENVIRONMENT_MODEL, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyId: { type: String, required: true },
    cipherVersion: { type: Number, required: true, default: 1 },
    valueVersion: { type: Number, required: true, default: 1 },
  },
  { timestamps: true, strict: true }
);

SecretValueSchema.index({ secretId: 1, environmentId: 1 }, { unique: true });

export const SecretHistorySchema = new Schema(
  {
    secretId: { type: Schema.Types.ObjectId, ref: SECRET_MODEL, required: true, index: true },
    environmentId: { type: Schema.Types.ObjectId, ref: ENVIRONMENT_MODEL, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyId: { type: String, required: true },
    cipherVersion: { type: Number, required: true },
    valueVersion: { type: Number, required: true },
    changedBy: { type: String, required: true, maxlength: 120 },
  },
  { timestamps: true, strict: true }
);

SecretHistorySchema.index({ secretId: 1, environmentId: 1, valueVersion: 1 }, { unique: true });
