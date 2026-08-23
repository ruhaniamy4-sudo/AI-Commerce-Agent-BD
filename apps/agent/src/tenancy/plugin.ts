import mongoose, { Schema } from 'mongoose';
import { requireTenantContext } from './context';

const QUERY_OPERATIONS = [
    'countDocuments',
    'deleteMany',
    'deleteOne',
    'distinct',
    'find',
    'findOne',
    'findOneAndDelete',
    'findOneAndReplace',
    'findOneAndUpdate',
    'replaceOne',
    'updateMany',
    'updateOne',
] as const;

export function tenantPlugin(schema: Schema) {
    schema.add({
        businessId: {
            type: Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
            immutable: true,
        },
    });

    for (const operation of QUERY_OPERATIONS) {
        schema.pre(operation, function () {
            const { businessId } = requireTenantContext();
            this.setQuery({ ...this.getQuery(), businessId: new mongoose.Types.ObjectId(businessId) });
        });
    }

    schema.pre('aggregate', function () {
        const { businessId } = requireTenantContext();
        this.pipeline().unshift({
            $match: { businessId: new mongoose.Types.ObjectId(businessId) },
        });
    });

    schema.pre('validate', function () {
        const { businessId } = requireTenantContext();
        const current = this.get('businessId')?.toString();
        if (current && current !== businessId) {
            throw new Error('Cannot write data for another business');
        }
        this.set('businessId', new mongoose.Types.ObjectId(businessId));
    });
}
