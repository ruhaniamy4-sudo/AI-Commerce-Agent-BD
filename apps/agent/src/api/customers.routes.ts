import { Router } from 'express';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { Conversation } from '../models/Conversation';

const router = Router();

// Get all customers with pagination and search
router.get('/customers', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const language = req.query.language as string;
        const skip = (page - 1) * limit;

        const query: any = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { psid: { $regex: search, $options: 'i' } },
            ];
        }
        if (language) query.language = language;

        const [customers, total] = await Promise.all([
            Customer.find(query)
                .sort({ lastMessageAt: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Customer.countDocuments(query),
        ]);

        res.json({
            data: customers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get single customer with full details
router.get('/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const customer = await Customer.findOne({
            $or: [{ _id: id }, { psid: id }],
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get customer's orders
        const orders = await Order.find({ customerId: customer._id })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Get customer's conversations
        const conversations = await Conversation.find({
            customerId: customer._id,
        })
            .sort({ lastMessageAt: -1 })
            .limit(5)
            .lean();

        res.json({
            customer,
            orders,
            conversations,
        });
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// Create or update customer
router.post('/customers', async (req, res) => {
    try {
        const { psid, name, phone, email, language } = req.body;

        if (!psid) {
            return res.status(400).json({ error: 'PSID is required' });
        }

        // Check if customer exists
        let customer = await Customer.findOne({ psid });

        if (customer) {
            // Update existing customer
            if (name) customer.name = name;
            if (phone) customer.phone = phone;
            if (email) customer.email = email;
            if (language) customer.language = language;
            customer.lastMessageAt = new Date();

            await customer.save();
        } else {
            // Create new customer
            customer = new Customer({
                psid,
                name,
                phone,
                email,
                language: language || 'en',
                lastMessageAt: new Date(),
            });

            await customer.save();
        }

        res.status(customer.isNew ? 201 : 200).json(customer);
    } catch (error) {
        console.error('Error creating/updating customer:', error);
        res.status(500).json({ error: 'Failed to create/update customer' });
    }
});

// Update customer
router.patch('/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const customer = await Customer.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true,
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json(customer);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Add address to customer
router.post('/customers/:id/addresses', async (req, res) => {
    try {
        const { id } = req.params;
        const addressData = req.body;

        const customer = await Customer.findById(id);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // If this is the default address, unset others
        if (addressData.isDefault) {
            customer.addresses.forEach((addr) => {
                addr.isDefault = false;
            });
        }

        customer.addresses.push(addressData);
        await customer.save();

        res.status(201).json(customer);
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ error: 'Failed to add address' });
    }
});

export default router;
