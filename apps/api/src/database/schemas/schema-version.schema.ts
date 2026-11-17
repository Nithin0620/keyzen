import { Schema } from 'mongoose';

export const SCHEMA_VERSION_MODEL = 'SchemaVersion';

export const SchemaVersionSchema = new Schema(
  {
    version: { type: Number, required: true, unique: true },
    name: { type: String, required: true, maxlength: 120 },
    appliedAt: { type: Date, default: Date.now, required: true },
  },
  { strict: true }
);
