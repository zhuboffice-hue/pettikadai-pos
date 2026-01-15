"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Product } from "@/lib/db/db";
import { Plus, Search, Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from "@/components/providers/AuthProvider";

export default function InventoryPage() {
    const { userData } = useAuth();
    const shopId = userData?.shopId;

    const products = useLiveQuery(async () => {
        if (!shopId) return [];
        return await db.products.where('shopId').equals(shopId).toArray();
    }, [shopId]);

    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        price: "",
        costPrice: "",
        category: "General",
        barcode: "",
        isLoose: false,
        unit: "pcs",
        initialStock: ""
    });

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
                // Also update unit in inventory if needed (though inventory doesn't store unit, UI uses product's unit)
                // If stock was edited, we might need a separate 'Adjust Stock' feature, 
                // but for now we only update product details here.

                await db.inventory.where('productId').equals(editingProduct.id).modify({ lastUpdated: Date.now(), synced: false });

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

    const openModal = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                price: product.price.toString(),
                costPrice: product.costPrice?.toString() || "",
                category: product.category,
                barcode: product.barcode || "",
                isLoose: product.isLoose,
                unit: product.unit || "pcs",
                initialStock: "" // Don't show current stock in edit for now, strictly product details
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
                initialStock: ""
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const filteredProducts = products?.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchTerm))
    );

    return (
        <div className="p-4 max-w-7xl mx-auto">
            {/* ... Header ... */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Inventory</h1>
                <button onClick={() => openModal()} className="btn btn-primary gap-2">
                    <Plus className="w-4 h-4" /> Add Product
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Search by name or barcode..."
                    className="input input-bordered w-full pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Product List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts?.map((product) => (
                    <div key={product.id} className="card bg-base-100 shadow-sm border border-base-200">
                        <div className="card-body p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{product.name}</h3>
                                    <p className="text-sm opacity-70">{product.category}</p>
                                    <div className="badge badge-outline mt-2">{product.isLoose ? 'Loose' : 'Packaged'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-xl">₹{product.price}</div>
                                    <div className="text-xs opacity-50">per {product.unit}</div>
                                    {product.costPrice && <div className="text-xs text-info mt-1">CP: ₹{product.costPrice}</div>}
                                </div>
                            </div>
                            <div className="card-actions justify-end mt-4 pt-4 border-t border-base-200">
                                <button onClick={() => openModal(product)} className="btn btn-sm btn-ghost text-primary">
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(product.id)} className="btn btn-sm btn-ghost text-error">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="modal modal-open modal-bottom sm:modal-middle">
                    <div className="modal-box no-scrollbar max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-6">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                        <form onSubmit={handleSave} className="flex flex-col gap-4">
                            <div className="form-control w-full">
                                <label className="label pt-0 pb-1">
                                    <span className="label-text font-medium">Product Name</span>
                                </label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. Tata Salt"
                                    className="input input-bordered w-full"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-control w-full">
                                    <label className="label pt-0 pb-1">
                                        <span className="label-text font-medium">Selling Price (₹)</span>
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
                                        <span className="label-text font-medium">Cost Price (₹)</span>
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
                                        <span className="label-text font-medium">Category</span>
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
                                    </select>
                                </div>
                                <div className="form-control w-full">
                                    <label className="label pt-0 pb-1">
                                        <span className="label-text font-medium">Unit</span>
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

                            {!editingProduct && (
                                <div className="form-control w-full">
                                    <label className="label pt-0 pb-1">
                                        <span className="label-text font-medium">Opening Stock</span>
                                    </label>
                                    <div className="join w-full">
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0"
                                            className="input input-bordered w-full join-item"
                                            value={formData.initialStock}
                                            onChange={e => setFormData({ ...formData, initialStock: e.target.value })}
                                        />
                                        <div className="btn btn-disabled join-item text-base-content/70">{formData.unit}</div>
                                    </div>

                                </div>
                            )}

                            <div className="form-control w-full">
                                <label className="label pt-0 pb-1">
                                    <span className="label-text font-medium">Barcode (Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Scan or type barcode"
                                    className="input input-bordered w-full"
                                    value={formData.barcode}
                                    onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                                />
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
                                        <span className="label-text-alt text-gray-500">Sold by weight</span>
                                    </div>
                                </label>
                            </div>

                            <div className="modal-action mt-6">
                                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" /> : 'Save Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
