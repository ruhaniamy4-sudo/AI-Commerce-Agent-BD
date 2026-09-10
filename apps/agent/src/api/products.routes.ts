import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { getImageEmbedding } from '../services/embedding.service';
import { requireAdministrator } from '../auth/middleware';
import { tenantDocument } from '../tenancy/context';
import {
    MAX_PRODUCT_IMPORT_BYTES,
    parseProductImportFile,
    ProductImportError,
    productSlug,
    REQUIRED_PRODUCT_IMPORT_COLUMNS,
} from '../services/product-import.service';

const router = Router();
const productImportUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PRODUCT_IMPORT_BYTES, files: 1 },
});

function productRequestError(error: unknown) {
    if (error instanceof mongoose.Error.ValidationError) {
        return { status: 400, message: Object.values(error.errors).map((entry) => entry.message).join(', ') };
    }
    const code = (error as { code?: number })?.code;
    if (code === 11000) return { status: 409, message: 'A product with this slug or SKU already exists' };
    return { status: 500, message: 'Failed to save product' };
}

function categoryRequestError(error: unknown) {
    if (error instanceof mongoose.Error.ValidationError) {
        return { status: 400, message: Object.values(error.errors).map((entry) => entry.message).join(', ') };
    }
    if ((error as { code?: number })?.code === 11000) return { status: 409, message: 'A category with this name already exists' };
    return { status: 500, message: 'Failed to save category' };
}

// Get all products with filtering and pagination
router.get('/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const categoryId = req.query.categoryId as string;
        const minPrice = parseFloat(req.query.minPrice as string);
        const maxPrice = parseFloat(req.query.maxPrice as string);
        const inStock = req.query.inStock as string;
        const isFeatured = req.query.isFeatured as string;
        const skip = (page - 1) * limit;

        const query: any = { isActive: true };

        if (search) {
            query.$text = { $search: search };
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

        res.json({
            data: products,
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
            ? { _id: identifier, isActive: true }
            : { slug: identifier, isActive: true };

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
        const productData = tenantDocument({ ...req.body });
        productData.name = String(productData.name || '').trim();
        productData.description = String(productData.description || '').trim();
        productData.currency = String(productData.currency || 'BDT').trim().toUpperCase();
        productData.slug = productSlug(String(productData.slug || productData.name), `product-${Date.now().toString(36)}`);

        if (!productData.name || !productData.description || !productData.categoryId || productData.basePrice === undefined) {
            return res.status(400).json({ error: 'Name, description, category, and price are required' });
        }
        if (!mongoose.Types.ObjectId.isValid(String(productData.categoryId))) {
            return res.status(400).json({ error: 'Choose a valid category' });
        }
        const basePrice = Number(productData.basePrice);
        if (!Number.isFinite(basePrice) || basePrice < 0) {
            return res.status(400).json({ error: 'Price must be a non-negative number' });
        }
        productData.basePrice = basePrice;
        if (!/^[A-Z]{3}$/.test(productData.currency)) {
            return res.status(400).json({ error: 'Currency must be a 3-letter code such as BDT or USD' });
        }
        if (!(await Category.exists({ _id: productData.categoryId, isActive: true }))) {
            return res.status(400).json({ error: 'Category does not belong to this business' });
        }

        if (await Product.exists({ slug: productData.slug })) {
            return res.status(409).json({ error: 'A product with this name or slug already exists' });
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
        const failure = productRequestError(error);
        res.status(failure.status).json({ error: failure.message });
    }
});

// Update product (admin)
router.patch('/products/:id', requireAdministrator, async (req, res) => {
    try {
        const { id } = req.params;
        const { businessId: _ignoredBusinessId, intelligence: _ignoredIntelligence, ...updates } = req.body;
        if (updates.categoryId && !(await Category.exists({ _id: updates.categoryId, isActive: true }))) {
            return res.status(400).json({ error: 'Category does not belong to this business' });
        }

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // If images are updated, regenerate ALL embeddings
        if (updates.images && Array.isArray(updates.images) &&
            JSON.stringify(updates.images) !== JSON.stringify(product.images)) {
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

// Import a validated product catalog from CSV or XLSX (admin)
router.post('/products/import', requireAdministrator, productImportUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({
            error: 'Choose a CSV or XLSX file',
            requiredColumns: REQUIRED_PRODUCT_IMPORT_COLUMNS,
        });

        const importedRows = await parseProductImportFile(req.file.originalname, req.file.mimetype, Buffer.from(req.file.buffer));
        const skus = importedRows.map((row) => row.variant?.sku).filter((value): value is string => Boolean(value));
        if (skus.length) {
            const existingSkuProducts = await Product.find({ 'variants.sku': { $in: skus } }).select('variants.sku').lean();
            const existingSkus = new Set(existingSkuProducts.flatMap((product) => product.variants || []).map((variant) => variant.sku?.toLowerCase()));
            const rowErrors = importedRows
                .filter((row) => row.variant && existingSkus.has(row.variant.sku.toLowerCase()))
                .map((row) => ({ row: row.row, errors: [`SKU already exists: ${row.variant!.sku}`] }));
            if (rowErrors.length) throw new ProductImportError('Some rows contain SKUs that already exist', rowErrors);
        }

        const allCategories = await Category.find().select('_id name slug isActive').lean();
        const categoryMap = new Map<string, any>();
        const usedCategorySlugs = new Set(allCategories.map((category) => category.slug));
        for (const category of allCategories) {
            if (category.isActive) {
                categoryMap.set(category.name.trim().toLowerCase(), category);
                categoryMap.set(category.slug.trim().toLowerCase(), category);
            }
        }
        for (const categoryName of [...new Set(importedRows.map((row) => row.category))]) {
            const key = categoryName.trim().toLowerCase();
            if (categoryMap.has(key)) continue;
            const baseSlug = productSlug(categoryName, `category-${Date.now().toString(36)}-${categoryMap.size}`);
            let slug = baseSlug;
            if (usedCategorySlugs.has(slug)) slug = `${baseSlug}-${Date.now().toString(36)}-${categoryMap.size}`;
            const category = await Category.create(tenantDocument({ name: categoryName, slug, isActive: true }));
            usedCategorySlugs.add(slug);
            categoryMap.set(key, category);
            categoryMap.set(slug, category);
        }

        const baseSlugs = importedRows.map((row) => productSlug(row.name, `product-${row.row}`));
        const existingSlugDocs = await Product.find({ slug: { $in: baseSlugs } }).select('slug').lean();
        const usedSlugs = new Set(existingSlugDocs.map((product) => product.slug));
        const documents = importedRows.map((row) => {
            const baseSlug = productSlug(row.name, `product-${row.row}`);
            let slug = baseSlug;
            if (usedSlugs.has(slug)) slug = `${baseSlug}-${row.row}-${Date.now().toString(36)}`.slice(0, 140);
            usedSlugs.add(slug);
            const category = categoryMap.get(row.category.trim().toLowerCase());
            return new Product(tenantDocument({
                name: row.name,
                slug,
                description: row.description,
                categoryId: category._id,
                basePrice: row.basePrice,
                currency: row.currency,
                stock: row.stock,
                availability: row.stock === null ? 'unknown' : row.stock > 0 ? 'in_stock' : 'out_of_stock',
                variants: row.variant ? [{
                    variantId: `import-${row.row}-${Date.now().toString(36)}`,
                    ...row.variant,
                    availability: row.variant.stock === null ? 'unknown' : row.variant.stock > 0 ? 'in_stock' : 'out_of_stock',
                }] : [],
                specs: row.specs,
                compatibilityTags: row.compatibilityTags,
                images: row.images,
                warrantyMonths: row.warrantyMonths,
                isReturnable: row.isReturnable,
                isActive: row.isActive,
                isFeatured: row.isFeatured,
                lowStockThreshold: row.lowStockThreshold,
                salePrice: row.salePrice,
                brand: row.brand,
                barcode: row.barcode,
                merchantConfirmed: true,
            }));
        });
        await Promise.all(documents.map((document) => document.validate()));
        const results = await Product.insertMany(documents.map((document) => document.toObject()));

        return res.status(201).json({
            message: `Successfully imported ${results.length} product${results.length === 1 ? '' : 's'}`,
            count: results.length,
        });
    } catch (error) {
        console.error('Error importing products:', error);
        if (error instanceof ProductImportError) {
            return res.status(422).json({
                error: error.message,
                rowErrors: error.rowErrors,
                requiredColumns: REQUIRED_PRODUCT_IMPORT_COLUMNS,
            });
        }
        const failure = productRequestError(error);
        return res.status(failure.status).json({ error: failure.message });
    }
});

// Keep the old JSON route explicit instead of accepting unvalidated catalog data.
router.post('/products/bulk-import', requireAdministrator, (_req, res) => {
    res.status(410).json({ error: 'Use the CSV/XLSX import option on the Products page' });
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
        const { businessId: _ignoredBusinessId, ...input } = req.body || {};
        const name = String(input.name || '').trim();

        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }
        if (name.length > 120) return res.status(400).json({ error: 'Category name must be 120 characters or fewer' });
        const slug = productSlug(String(input.slug || name), `category-${Date.now().toString(36)}`);
        const categoryData = tenantDocument({ ...input, name, slug });
        if (categoryData.parentId && !mongoose.Types.ObjectId.isValid(String(categoryData.parentId))) {
            return res.status(400).json({ error: 'Choose a valid parent category' });
        }
        if (categoryData.parentId && !(await Category.exists({ _id: categoryData.parentId, isActive: true }))) {
            return res.status(400).json({ error: 'Parent category does not belong to this business' });
        }
        if (await Category.exists({ slug })) return res.status(409).json({ error: 'A category with this name already exists' });

        const category = new Category(categoryData);
        await category.save();

        return res.status(201).json(category);
    } catch (error) {
        console.error('Error creating category:', error);
        const failure = categoryRequestError(error);
        return res.status(failure.status).json({ error: failure.message });
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

router.use((error: unknown, _req: unknown, res: any, _next: unknown) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Maximum size is 5 MB.' : 'The file upload could not be processed' });
    }
    return res.status(500).json({ error: 'The product request could not be processed' });
});

export default router;
