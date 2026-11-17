import { Schema } from 'mongoose';
import { USER_MODEL } from './identity.schema';

export const WORKSPACE_MODEL = 'Workspace';
export const WORKSPACE_MEMBER_MODEL = 'WorkspaceMember';
export const INVITATION_MODEL = 'Invitation';

export const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 48 },
    description: { type: String, maxlength: 500 },
    ownerId: { type: Schema.Types.ObjectId, ref: USER_MODEL, required: true, index: true },
    settings: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: true }
);

export const WorkspaceMemberSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: USER_MODEL, required: true, index: true },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'], required: true },
  },
  { timestamps: true, strict: true }
);

WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const InvitationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: WORKSPACE_MODEL, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    role: { type: String, enum: ['ADMIN', 'MEMBER', 'VIEWER'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: USER_MODEL, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true }
);

InvitationSchema.index({ workspaceId: 1, email: 1 });
