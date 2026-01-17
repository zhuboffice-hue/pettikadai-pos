"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Product } from "@/lib/db/db";
import BarcodeScanner from "@/components/BarcodeScanner";
import { Plus, Search, Edit, Trash2, Loader2, Package, Globe, ScanBarcode, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from "@/components/providers/AuthProvider";
import GlobalCatalog, { CatalogItem } from "@/components/inventory/GlobalCatalog";
import { useHardwareScanner } from "@/hooks/useHardwareScanner";

export default function InventoryPage() {
    const { userData } = useAuth();
    const shopId = userData?.shopId;

    const products = useLiveQuery(async () => {
        if (!shopId) return [];
        return await db.products.where('shopId').equals(shopId).toArray();
    }, [shopId]);

    const [activeTab, setActiveTab] = useState<'inventory' | 'catalog'>('inventory');
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        price: "",
        costPrice: "",
        category: "General",
        barcode: "",
        isLoose: false,
        unit: "pcs",
        initialStock: "",
        currentStock: "" // Added for editing stock
    });

    // Hardware Scanner: Context Aware
    useHardwareScanner({
        onScan: (code) => {
            if (isModalOpen) {
                // If editing/adding, assign to form
                setFormData(prev => ({ ...prev, barcode: code }));
                toast.success(`Barcode set: ${code}`);
                if (isScanning) setIsScanning(false);
            } else {
                // If browsing, search
                setSearchTerm(code);
                toast.success(`Search: ${code}`);
            }
        }
    });

    // Fetch inventory for current stock
    const inventoryMap = useLiveQuery(async () => {
        if (!shopId) return {};
        const items = await db.inventory.where('shopId').equals(shopId).toArray();
        return items.reduce((acc, item) => {
            acc[item.productId] = item.currentStock;
            return acc;
        }, {} as Record<string, number>);
    }, [shopId]);

    // Helper to get set of existing names for Catalog check
    const existingProductNames = new Set(products?.map(p => p.name.toLowerCase()) || []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!shopId) {
            toast.error("Shop identification missing");
            return;
        }

        setLoading(true);

        try {
            const productData: Product = {
                id: editingProduct ? editingProduct.id : uuidv4(),
                shopId: shopId,
                name: formData.name,
                price: parseFloat(formData.price),
                costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
                category: formData.category,
                barcode: formData.barcode,
                isLoose: formData.isLoose,
                unit: formData.unit,
                synced: false
            };

            // 1. Save to Local DB (Dexie)
            if (editingProduct) {
                await db.products.put(productData);

                // Update inventory stock if changed
                // Update inventory stock if changed
                if (formData.currentStock !== '') {
                    const newStock = parseFloat(formData.currentStock);
                    const existingInventory = await db.inventory.where('productId').equals(editingProduct.id).first();

                    const inventoryData = {
                        productId: editingProduct.id,
                        shopId: shopId,
                        currentStock: newStock,
                        lowStockThreshold: existingInventory?.lowStockThreshold || 5,
                        lastUpdated: Date.now(),
                        synced: false
                    };

                    // Use put() to handle both create and update
                    await db.inventory.put(inventoryData);

                    // Include full data for Firebase sync
                    await db.syncQueue.add({
                        collection: 'inventory',
                        docId: editingProduct.id,
                        action: 'update',
                        data: inventoryData,
                        timestamp: Date.now(),
                        shopId: shopId
                    });
                }

                // Add to Sync Queue
                await db.syncQueue.add({
                    collection: 'products',
                    docId: productData.id,
                    action: 'update',
                    data: productData,
                    timestamp: Date.now(),
                    shopId: shopId
                });
                toast.success("Product updated!");
            } else {
                await db.products.add(productData);
                // Initialize Inventory with Initial Stock
                const initialStockVal = formData.initialStock ? parseFloat(formData.initialStock) : 0;

                await db.inventory.add({
                    productId: productData.id,
                    shopId: shopId,
                    currentStock: initialStockVal,
                    lowStockThreshold: 5,
                    lastUpdated: Date.now(),
                    synced: false
                });

                // Add to Sync Queue
                await db.syncQueue.add({
                    collection: 'products',
                    docId: productData.id,
                    action: 'create',
                    data: productData,
                    timestamp: Date.now(),
                    shopId: shopId
                });
                toast.success("Product added!");
                // Switch back to inventory tab if added from catalog
                setActiveTab('inventory');
            }
            closeModal();
        } catch (error) {
            console.error(error);
            toast.error("Failed to save product");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this product?")) return;
        if (!shopId) return;

        try {
            await db.products.delete(id);
            await db.inventory.where("productId").equals(id).delete();

            // Add to Sync Queue
            await db.syncQueue.add({
                collection: 'products',
                docId: id,
                action: 'delete',
                data: { id },
                timestamp: Date.now(),
                shopId: shopId
            });
            toast.success("Product deleted");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete");
        }
    };

    const openModal = (product?: Product, catalogItem?: CatalogItem) => {
        setIsScanning(false);
        if (product) {
            setEditingProduct(product);
            const currentStock = inventoryMap?.[product.id] ?? 0;
            setFormData({
                name: product.name,
                price: product.price.toString(),
                costPrice: product.costPrice?.toString() || "",
                category: product.category,
                barcode: product.barcode || "",
                isLoose: product.isLoose,
                unit: product.unit || "pcs",
                initialStock: "",
                currentStock: currentStock.toString()
            });
        } else if (catalogItem) {
            setEditingProduct(null);
            setFormData({
                name: catalogItem.name,
                price: "",
                costPrice: "",
                category: catalogItem.category,
                barcode: "",
                isLoose: false,
                unit: "pcs",
                initialStock: "0",
                currentStock: ""
            });
        } else {
            setEditingProduct(null);
            setFormData({
                name: "",
                price: "",
                costPrice: "",
                category: "General",
                barcode: "",
                isLoose: false,
                unit: "pcs",
                initialStock: "",
                currentStock: ""
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setIsScanning(false);
        setEditingProduct(null);
    };

    const filteredProducts = products?.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchTerm))
    );

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    Inventory
                </h1>

                <div className="join bg-base-100 border border-base-200 shadow-sm p-1 rounded-full">
                    <button
                        className={`join-item btn btn-sm rounded-full ${activeTab === 'inventory' ? 'btn-neutral' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('inventory')}
                    >
                        <Package className="w-4 h-4 mr-2" /> My Stock
                    </button>
                    <button
                        className={`join-item btn btn-sm rounded-full ${activeTab === 'catalog' ? 'btn-neutral' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('catalog')}
                    >
                        <Globe className="w-4 h-4 mr-2" /> Global Catalog
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'inventory' ? (
                <>
                    {/* Toolbar */}
                    <div className="flex justify-between items-center">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by name or barcode..."
                                className="input input-bordered w-full pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button onClick={() => openModal()} className="btn btn-primary gap-2 ml-4">
                            <Plus className="w-4 h-4" /> Add Product
                        </button>
                    </div>

                    {/* Product List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts?.length === 0 && (
                            <div className="col-span-full py-16 text-center opacity-50 flex flex-col items-center">
                                <Package className="w-16 h-16 mb-4 opacity-20" />
                                <h3 className="text-lg font-bold">No products found</h3>
                                <p className="text-sm">Try adding from the Global Catalog or create a new one.</p>
                                <button className="btn btn-sm btn-link mt-2" onClick={() => setActiveTab('catalog')}>Go to Catalog</button>
                            </div>
                        )}
                        {filteredProducts?.map((product) => {
                            const stock = inventoryMap?.[product.id] ?? 0;
                            const lowStock = stock < 5;
                            return (
                                <div key={product.id} className={`card bg-base-100 shadow-sm border transition-colors group ${lowStock ? 'border-warning/50 bg-warning/5' : 'border-base-200 hover:border-primary/50'}`}>
                                    <div className="card-body p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-lg">{product.name}</h3>
                                                <p className="text-sm opacity-70">{product.category}</p>
                                                {product.isLoose && <div className="badge badge-sm badge-outline mt-1 font-mono text-[10px] uppercase">Loose</div>}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-xl">₹{product.price}</div>
                                                <div className="text-xs opacity-50">/{product.unit}</div>
                                            </div>
                                        </div>

                                        {/* Stock Display */}
                                        <div className={`mt-3 p-2 rounded-lg flex items-center justify-between ${lowStock ? 'bg-warning/20' : 'bg-base-200/50'}`}>
                                            <span className="text-sm font-medium">Stock:</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold text-lg ${lowStock ? 'text-warning' : 'text-success'}`}>
                                                    {stock} {product.unit}
                                                </span>
                                                {lowStock && <span className="badge badge-warning badge-sm">Low</span>}
                                            </div>
                                        </div>

                                        <div className="card-actions justify-end mt-3 pt-3 border-t border-base-200">
                                            <button onClick={() => openModal(product)} className="btn btn-sm btn-ghost text-primary tooltip" data-tip="Edit">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(product.id)} className="btn btn-sm btn-ghost text-error tooltip" data-tip="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                // Catalog Tab
                <GlobalCatalog
                    onAddProduct={(item) => openModal(undefined, item)}
                    existingProductNames={existingProductNames}
                />
            )}

            {/* Add/Edit Modal (Shared) */}
            {isModalOpen && (
                <div className="modal modal-open modal-bottom sm:modal-middle">
                    <div className="modal-box no-scrollbar max-h-[90vh] overflow-y-auto">
                        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={closeModal}>✕</button>
                        <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
                            {editingProduct ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            {editingProduct ? 'Edit Product' : 'Add to Inventory'}
                        </h3>

                        {isScanning ? (
                            <div className="flex flex-col items-center justify-center p-4">
                                <h4 className="font-bold mb-4">Scan Product Barcode</h4>
                                <div className="w-full max-w-sm aspect-square overflow-hidden rounded-xl border-2 border-primary">
                                    <BarcodeScanner
                                        onScanSuccess={(code) => {
                                            setFormData({ ...formData, barcode: code });
                                            setIsScanning(false);
                                            toast.success(`Scanned: ${code}`);
                                        }}
                                        onScanFailure={(err) => { }}
                                    />
                                </div>
                                <button className="btn btn-ghost mt-4" onClick={() => setIsScanning(false)}>
                                    <X className="w-4 h-4 mr-2" /> Cancel Scan
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSave} className="flex flex-col gap-4">
                                <div className="form-control w-full">
                                    <label className="label pt-0 pb-1">
                                        <span className="label-text font-medium opacity-70">Product Name</span>
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Tata Salt"
                                        className="input input-bordered w-full font-medium"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="form-control w-full">
                                        <label className="label pt-0 pb-1">
                                            <span className="label-text font-medium opacity-70">Selling Price (₹)</span>
                                        </label>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="input input-bordered w-full"
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-control w-full">
                                        <label className="label pt-0 pb-1">
                                            <span className="label-text font-medium opacity-70">Cost Price (₹)</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="input input-bordered w-full"
                                            value={formData.costPrice}
                                            onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="form-control w-full">
                                        <label className="label pt-0 pb-1">
                                            <span className="label-text font-medium opacity-70">Category</span>
                                        </label>
                                        <select
                                            className="select select-bordered w-full"
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        >
                                            <option>General</option>
                                            <option>Groceries</option>
                                            <option>Vegetables</option>
                                            <option>Snacks</option>
                                            <option>Dairy</option>
                                            <option>Personal Care</option>
                                            <option>Household</option>
                                        </select>
                                    </div>
                                    <div className="form-control w-full">
                                        <label className="label pt-0 pb-1">
                                            <span className="label-text font-medium opacity-70">Unit</span>
                                        </label>
                                        <select
                                            className="select select-bordered w-full"
                                            value={formData.unit}
                                            onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                        >
                                            <option value="pcs">Pieces (pcs)</option>
                                            <option value="kg">Kilogram (kg)</option>
                                            <option value="g">Gram (g)</option>
                                            <option value="l">Liter (l)</option>
                                            <option value="ml">Milliliter (ml)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Stock Field - Different for Add vs Edit */}
                                {editingProduct ? (
                                    <div className="form-control w-full bg-success/10 p-4 rounded-xl border border-success/30">
                                        <label className="label pt-0 pb-1">
                                            <span className="label-text font-bold text-success">Update Current Stock</span>
                                        </label>
                                        <div className="join w-full">
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="0"
                                                className="input input-bordered w-full join-item font-bold"
                                                value={formData.currentStock}
                                                onChange={e => setFormData({ ...formData, currentStock: e.target.value })}
                                            />
                                            <div className="btn btn-disabled join-item text-base-content/70 border-base-300 bg-base-200">{formData.unit}</div>
                                        </div>
                                        <p className="text-xs text-success/70 mt-2">Modify the current stock level for this product</p>
                                    </div>
                                ) : (
                                    <div className="form-control w-full bg-base-200/30 p-4 rounded-xl border border-base-200">
                                        <label className="label pt-0 pb-1">
                                            <span className="label-text font-bold">Initial Stock <span className="text-error">*</span></span>
                                        </label>
                                        <div className="join w-full">
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="0"
                                                className="input input-bordered w-full join-item font-bold"
                                                value={formData.initialStock}
                                                onChange={e => setFormData({ ...formData, initialStock: e.target.value })}
                                            />
                                            <div className="btn btn-disabled join-item text-base-content/70 border-base-300 bg-base-200">{formData.unit}</div>
                                        </div>
                                        <p className="text-xs opacity-50 mt-2">Required for inventory tracking</p>
                                    </div>
                                )}

                                <div className="form-control w-full">
                                    <label className="label pt-0 pb-1">
                                        <span className="label-text font-medium opacity-70">Barcode</span>
                                    </label>
                                    <div className="join w-full">
                                        <input
                                            type="text"
                                            placeholder="Scan or type barcode"
                                            className="input input-bordered w-full join-item"
                                            value={formData.barcode}
                                            onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-square join-item btn-primary"
                                            onClick={() => setIsScanning(true)}
                                            title="Scan Barcode"
                                        >
                                            <ScanBarcode className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="form-control">
                                    <label className="label cursor-pointer justify-start gap-4 p-3 border border-base-200 rounded-lg hover:border-primary/50 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="toggle toggle-primary toggle-sm"
                                            checked={formData.isLoose}
                                            onChange={e => {
                                                const isLoose = e.target.checked;
                                                setFormData({
                                                    ...formData,
                                                    isLoose,
                                                    unit: isLoose ? 'kg' : 'pcs'
                                                });
                                            }}
                                        />
                                        <div className="flex flex-col cursor-pointer">
                                            <span className="label-text font-medium">Loose Item</span>
                                            <span className="label-text-alt text-gray-500">Sold by weight (e.g. Rice, Dal)</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="modal-action mt-6 pt-4 border-t border-base-200">
                                    <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                                    <button type="submit" className="btn btn-primary px-8" disabled={loading}>
                                        {loading ? <Loader2 className="animate-spin" /> : (editingProduct ? 'Update Product' : 'Add to Inventory')}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
