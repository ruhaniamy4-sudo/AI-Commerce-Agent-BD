import { Router } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { getImageEmbedding } from '../services/embedding.service';
import { requireAdministrator } from '../auth/middleware';
import { requireTenantContext, tenantDocument } from '../tenancy/context';
import { mirrorExternalProductImages } from '../services/ingestion/external-image.service';
import { cleanupDetachedProductMedia } from '../services/media-storage.service';

import {productSoldCounts,productSalesReport} from '../services/product-sales.service';
import {getProductOverview} from '../services/product-overview.service';
const router = Router();
router.get('/products/overview', async (req, res) => {
    res.json(await getProductOverview(req.query.sort === 'newest' ? 'newest' : 'most_sales'));
});
router.get('/products/:id/sales',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:'Invalid product ID'});
 if(!await Product.exists({_id:req.params.id}))return res.status(404).json({error:'Product not found'});
 const period=['daily','weekly','monthly'].includes(String(req.query.period))?String(req.query.period):'daily';
 res.json(await productSalesReport(String(req.params.id),period as 'daily'|'weekly'|'monthly'));
});
router.patch('/products/:id/ai-selling',requireAdministrator,async(req,res)=>{
 const {status,reason}=req.body;
 if(!mongoose.isValidObjectId(req.params.id)||!['active','limited','disabled'].includes(status))return res.status(400).json({error:'Invalid product or selling status'});
 if(status==='disabled'&&!['Out of Stock','Temporarily unavailable','Discontinued'].includes(reason))return res.status(400).json({error:'Choose a reason for disabling AI selling'});
 const product=await Product.findByIdAndUpdate(req.params.id,{$set:{aiSellingStatus:status,aiSellingReason:status==='disabled'?reason:''}},{new:true,runValidators:true});
 if(!product)return res.status(404).json({error:'Product not found'});
 res.json(product);
});

// Get all products with filtering and pagination
router.get('/products', async (req, res) => {
    try {
        const page = Math.max(1,parseInt(req.query.page as string) || 1);
        const limit = Math.min(100,Math.max(1,parseInt(req.query.limit as string) || 20));
        const search = req.query.search as string;
        const categoryId = req.query.categoryId as string;
        const minPrice = parseFloat(req.query.minPrice as string);
        const maxPrice = parseFloat(req.query.maxPrice as string);
        const inStock = req.query.inStock as string;
        const isFeatured = req.query.isFeatured as string;
        const skip = (page - 1) * limit;

        const query: any = req.query.includeInactive==='true'?{}:{ isActive: true };
        if(['active','limited','disabled'].includes(String(req.query.aiSellingStatus)))query.aiSellingStatus=req.query.aiSellingStatus==='active'?{$nin:['limited','disabled']}:req.query.aiSellingStatus;

        if (search) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (escaped) query.name = { $regex: escaped, $options: 'i' };
        }
        if (categoryId) {
            query.categoryId = categoryId;
        }
        if (minPrice || maxPrice) {
            query.basePrice = {};
            if (minPrice) query.basePrice.$gte = minPrice;
            if (maxPrice) query.basePrice.$lte = maxPrice;
        }
        if (inStock === 'true') {
            query.stock = { $gt: 0 };
        }
        if (isFeatured === 'true') {
            query.isFeatured = true;
        }

        const [products, total] = await Promise.all([
            Product.find(query)
                .populate('categoryId', 'name slug')
                .sort({ isFeatured: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Product.countDocuments(query),
        ]);

        const counts=await productSoldCounts(products.map(p=>p._id));
        res.json({
            data: products.map(p=>({...p,totalSold:counts.find(c=>String(c._id)===String(p._id))?.units||0})),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get single product by ID or slug
router.get('/products/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;

        // Determine if identifier is ID or Slug
        const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
        const query = isObjectId
            ? { _id: identifier }
            : { slug: identifier };

        const product = await Product.findOne(query).populate('categoryId', 'name slug');

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Create new product (admin)
router.post('/products', requireAdministrator, async (req, res) => {
    try {
        const productData = tenantDocument(req.body);

        if (!productData.name || !productData.categoryId || productData.basePrice === undefined) {
            return res.status(400).json({ error: 'Name, category, and price are required' });
        }
        if (!(await Category.exists({ _id: productData.categoryId, isActive: true }))) {
            return res.status(400).json({ error: 'Category does not belong to this business' });
        }
        if (Array.isArray(productData.images) && productData.images.length) {
            const imported = await mirrorExternalProductImages(productData.images, requireTenantContext().businessId);
            productData.images = imported.images; productData.imageImports = imported.imports;
        }

        const product = new Product(productData);

        // Generate embeddings for all images
        if (product.images && product.images.length > 0) {
            try {
                const embeddingPromises = product.images.map((url: string) => getImageEmbedding(url));
                const results = await Promise.all(embeddingPromises);

                product.imageEmbeddings = results.map((res, index) => ({
                    url: product.images[index],
                    embedding: res.embedding,
                    model: res.model,
                    updatedAt: new Date()
                }));

                // Set legacy fields using the first image
                if (results.length > 0) {
                    product.imageEmbedding = results[0].embedding;
                    product.imageEmbeddingModel = results[0].model;
                    product.lastEmbeddingUpdate = new Date();
                }
            } catch (error) {
                console.error('Failed to generate embeddings during product creation:', error);
            }
        }

        await product.save();

        res.status(201).json(product);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product (admin)
router.patch('/products/:id', requireAdministrator, async (req, res) => {
    try {
        const { id } = req.params;
        const { businessId: _ignoredBusinessId, intelligence: _ignoredIntelligence, aiSellingStatus: _status, aiSellingReason: _reason, ...updates } = req.body;
        if (updates.categoryId && !(await Category.exists({ _id: updates.categoryId, isActive: true }))) {
            return res.status(400).json({ error: 'Category does not belong to this business' });
        }

        if(updates.aiKnowledge && (!Array.isArray(updates.aiKnowledge)||updates.aiKnowledge.length>30||updates.aiKnowledge.some((a:any)=>typeof a.question!=='string'||!a.question.trim()||typeof a.answer!=='string'||!a.answer.trim())))return res.status(400).json({error:'Provide up to 30 complete product questions and answers'});
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const previousImageImports = [...(product.imageImports || [])].map((item: any) => item.toObject?.() || item);
        let removedImageImports: typeof previousImageImports = [];
        // If images are updated, regenerate ALL embeddings
        if (updates.images && Array.isArray(updates.images) &&
            JSON.stringify(updates.images) !== JSON.stringify(product.images)) {
            const imported = await mirrorExternalProductImages(updates.images, requireTenantContext().businessId);
            updates.images = imported.images; updates.imageImports = imported.imports;
            const retainedIds = new Set(imported.imports.map((item) => item.providerAssetId).filter(Boolean));
            removedImageImports = previousImageImports.filter((item: any) => item.providerAssetId && !retainedIds.has(item.providerAssetId));
            try {
                const embeddingPromises = updates.images.map((url: string) => getImageEmbedding(url));
                const results = await Promise.all(embeddingPromises);

                updates.imageEmbeddings = results.map((res, index) => ({
                    url: updates.images[index],
                    embedding: res.embedding,
                    model: res.model,
                    updatedAt: new Date()
                }));

                // Update legacy fields using the first image
                if (results.length > 0) {
                    updates.imageEmbedding = results[0].embedding;
                    updates.imageEmbeddingModel = results[0].model;
                    updates.lastEmbeddingUpdate = new Date();
                }
            } catch (error) {
                console.error('Failed to generate embeddings during product update:', error);
            }
        }

        Object.assign(product, updates);
        await product.save();
        if (removedImageImports.length) {
            try { await cleanupDetachedProductMedia(requireTenantContext().businessId, String(product._id), removedImageImports); }
            catch (error) { console.warn(`Product image cleanup deferred: ${error instanceof Error ? error.message : 'storage unavailable'}`); }
        }

        res.json(product);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product (admin - soft delete)
router.delete('/products/:id', requireAdministrator, async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

function parseImportBoolean(value: unknown, fallback: boolean): boolean {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return fallback;
}

function slugifyImportName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'product';
}

// Bulk import products from a merchant-uploaded file (parsed to rows client-side)
router.post('/products/bulk-import', requireAdministrator, async (req, res) => {
    try {
        const { products } = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: 'Products array is required' });
        }
        if (products.length > 500) {
            return res.status(400).json({ error: 'Import is limited to 500 products per request' });
        }

        const categoryCache = new Map<string, mongoose.Types.ObjectId>();
        const existingCategories = await Category.find({ isActive: true }).select('name _id').lean();
        for (const category of existingCategories) {
            categoryCache.set(String(category.name).trim().toLowerCase(), category._id as mongoose.Types.ObjectId);
        }

        const results: Array<{ row: number; name?: string; status: 'created' | 'error'; id?: string; error?: string }> = [];

        for (let index = 0; index < products.length; index++) {
            const raw = (products[index] || {}) as Record<string, unknown>;
            const rowNumber = Number(raw.row) || index + 1;
            const name = String(raw.name || '').trim();
            try {
                const categoryName = String(raw.category || '').trim();
                const basePrice = Number(raw.basePrice);

                if (!name) throw new Error('Product name is required');
                if (!categoryName) throw new Error('Category is required');
                if (!Number.isFinite(basePrice) || basePrice < 0) throw new Error('A valid price is required');

                const categoryKey = categoryName.toLowerCase();
                let categoryId = categoryCache.get(categoryKey);
                if (!categoryId) {
                    const category = new Category(tenantDocument({ name: categoryName }));
                    await category.save();
                    categoryId = category._id as mongoose.Types.ObjectId;
                    categoryCache.set(categoryKey, categoryId);
                }

                const images = Array.isArray(raw.images)
                    ? raw.images.map((url) => String(url).trim()).filter(Boolean)
                    : String(raw.images || '').split(/[|,\n]/).map((url) => url.trim()).filter(Boolean);

                const product = new Product(tenantDocument({
                    name,
                    slug: slugifyImportName(name),
                    description: String(raw.description || '').trim() || name,
                    categoryId,
                    basePrice,
                    currency: (String(raw.currency || 'BDT').trim().toUpperCase() || 'BDT'),
                    stock: raw.stock === undefined || raw.stock === '' ? null : Number(raw.stock),
                    images,
                    brand: raw.brand ? String(raw.brand).trim() : undefined,
                    barcode: raw.sku ? String(raw.sku).trim() : undefined,
                    warrantyMonths: raw.warrantyMonths ? Number(raw.warrantyMonths) || 0 : 0,
                    lowStockThreshold: raw.lowStockThreshold ? Number(raw.lowStockThreshold) || 10 : 10,
                    isActive: parseImportBoolean(raw.isActive, true),
                    isFeatured: parseImportBoolean(raw.isFeatured, false),
                    isReturnable: parseImportBoolean(raw.isReturnable, true),
                }));

                try {
                    await product.save();
                } catch (saveError: any) {
                    if (saveError?.code === 11000) {
                        product.slug = `${slugifyImportName(name)}-${Math.random().toString(36).slice(2, 6)}`;
                        await product.save();
                    } else {
                        throw saveError;
                    }
                }

                results.push({ row: rowNumber, name, status: 'created', id: String(product._id) });
            } catch (error) {
                results.push({ row: rowNumber, name: name || undefined, status: 'error', error: error instanceof Error ? error.message : 'Failed to import row' });
            }
        }

        const created = results.filter((r) => r.status === 'created').length;
        const failed = results.length - created;
        res.status(created > 0 ? 201 : 400).json({
            message: `Imported ${created} of ${results.length} product${results.length === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}`,
            created,
            failed,
            results,
        });
    } catch (error) {
        console.error('Error importing products:', error);
        res.status(500).json({ error: 'Failed to import products' });
    }
});

// Get all categories
router.get('/categories', async (req, res) => {
    try {
        const parentId = req.query.parentId as string;

        const query: any = { isActive: true };
        if (parentId) {
            query.parentId = parentId;
        } else if (parentId === null || parentId === 'null') {
            query.parentId = null; // Top-level categories only
        }

        const categories = await Category.find(query)
            .sort({ order: 1, name: 1 })
            .lean();

        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get single category
router.get('/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findOne({
            $or: [{ _id: id }, { slug: id }],
            isActive: true,
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Get products in this category
        const products = await Product.find({
            categoryId: category._id,
            isActive: true,
        })
            .limit(20)
            .lean();

        res.json({ category, products });
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

// Create category (admin)
router.post('/categories', requireAdministrator, async (req, res) => {
    try {
        const categoryData = tenantDocument(req.body);

        if (!categoryData.name) {
            return res.status(400).json({ error: 'Category name is required' });
        }
        if (categoryData.parentId && !(await Category.exists({ _id: categoryData.parentId, isActive: true }))) {
            return res.status(400).json({ error: 'Parent category does not belong to this business' });
        }

        const category = new Category(categoryData);
        await category.save();

        res.status(201).json(category);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Update category (admin)
router.patch('/categories/:id', requireAdministrator, async (req, res) => {
    try {
        const { id } = req.params;
        const { businessId: _ignoredBusinessId, ...updates } = req.body;
        if (updates.parentId && !(await Category.exists({ _id: updates.parentId, isActive: true }))) {
            return res.status(400).json({ error: 'Parent category does not belong to this business' });
        }

        const category = await Category.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true,
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(category);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category (admin - soft delete)
router.delete('/categories/:id', requireAdministrator, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if category has products
        const productsCount = await Product.countDocuments({ categoryId: id });
        if (productsCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete category with existing products',
                productsCount,
            });
        }

        const category = await Category.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

export default router;
