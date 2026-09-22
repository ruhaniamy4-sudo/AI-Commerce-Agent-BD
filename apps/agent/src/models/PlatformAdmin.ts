import mongoose, { Document, Schema } from 'mongoose';
import { PLATFORM_ADMIN_ROLES, PLATFORM_PERMISSIONS, PlatformAdminRole } from '../services/platform-permissions';

export interface IPlatformAdmin extends Document {
    name: string;
    email: string;
    passwordHash: string;
    role: PlatformAdminRole;
    /** Individual grants on top of the role, for one-off delegation without inventing a role. */
    permissions: string[];
    status: 'active' | 'disabled';
    mustChangePassword: boolean;
    notes?: string;
    createdBy?: mongoose.Types.ObjectId;
    lastLoginAt?: Date;
    /** Consecutive failed sign-ins; cleared the moment one succeeds. */
    failedLoginAttempts: number;
    lockedUntil?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PlatformAdminSchema = new Schema<IPlatformAdmin>({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    // Admins seeded before roles existed are the founding operators, so they default
    // to OWNER rather than silently losing the access they already had.
    role: { type: String, enum: PLATFORM_ADMIN_ROLES, default: 'OWNER', index: true },
    permissions: { type: [String], default: [], validate: (value: string[]) => value.every(permission => (PLATFORM_PERMISSIONS as readonly string[]).includes(permission)) },
    status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
    mustChangePassword: { type: Boolean, default: false },
    notes: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'PlatformAdmin' },
    lastLoginAt: Date,
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
}, { timestamps: true });

export const PlatformAdmin = mongoose.model<IPlatformAdmin>('PlatformAdmin', PlatformAdminSchema);
