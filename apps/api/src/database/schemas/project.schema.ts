import { Schema } from 'mongoose';
import { USER_MODEL } from './identity.schema';
import { WORKSPACE_MODEL } from './workspace.schema';

export const PROJECT_MODEL = 'Project';
export const PROJECT_MEMBER_MODEL = 'ProjectMember';
export const ENVIRONMENT_MODEL = 'Environment';

export const ProjectSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 48 },
    description: { type: String, maxlength: 500 },
    settings: { type: Schema.Types.Mixed, default: {} },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true }
);

ProjectSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });

export const ProjectMemberSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: PROJECT_MODEL, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: USER_MODEL, required: true, index: true },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'], required: true },
    customPermissions: { type: [String], default: [] },
  },
  { timestamps: true, strict: true }
);

ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const EnvironmentSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: PROJECT_MODEL, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 48 },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true }
);

EnvironmentSchema.index({ projectId: 1, slug: 1 }, { unique: true });
