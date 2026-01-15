"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { db, Bill, BillItem, Product, StoreSettings } from "@/lib/db/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from 'uuid';
import {
    Search, ShoppingCart, Plus, Minus, Trash2,
    Printer, IndianRupee, Smartphone,
    ScanBarcode, X, Loader2, PackageOpen
} from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { Receipt } from "@/components/billing/Receipt";

export default function DashboardPage() {
    const { userData } = useAuth();
    const shopId = userData?.shopId;

    const [searchTerm, setSearchTerm] = useState("");
    const [cart, setCart] = useState<BillItem[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerName, setCustomerName] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [lastBill, setLastBill] = useState<Bill | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    // Fetch Products & Inventory
    const products = useLiveQuery(async () => {
        if (!shopId) return [];
        const allProducts = await db.products.where('shopId').equals(shopId).toArray();
        if (!searchTerm) return allProducts;
        const lowerTerm = searchTerm.toLowerCase();
        return allProducts.filter(p =>
            p.name.toLowerCase().includes(lowerTerm) ||
            p.barcode?.includes(lowerTerm)
        );
    }, [shopId, searchTerm]);

    const inventoryMap = useLiveQuery(async () => {
        if (!shopId) return {};
        const items = await db.inventory.where('shopId').equals(shopId).toArray();
        return items.reduce((acc, item) => {
            acc[item.productId] = item.currentStock;
            return acc;
        }, {} as Record<string, number>);
    }, [shopId]);

    // Fetch Settings
    const settings = useLiveQuery(async () => {
        if (!shopId) return undefined;
        return await db.storeSettings.where('shopId').equals(shopId).first();
    }, [shopId]);

    // Loose Item State
    const [looseProduct, setLooseProduct] = useState<Product | null>(null);
    const [weightInput, setWeightInput] = useState("");

    // ... (rest of implementation)

    const addToCart = (product: Product) => {
        // Stock Check
        const currentStock = inventoryMap ? (inventoryMap[product.id] || 0) : 0;

        // Handle Loose Items
        if (product.isLoose) {
            setLooseProduct(product);
            setWeightInput("");
            // Trigger modal
            return;
        }

        const existingItem = cart.find(item => item.productId === product.id);
        const currentQtyInCart = existingItem ? existingItem.qty : 0;

        if (currentStock - currentQtyInCart <= 0) {
            toast.error(`Out of Stock! Available: ${currentStock}`);
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                return prev.map(item =>
                    item.productId === product.id
                        ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.price }
                        : item
                );
            }
            return [...prev, {
                productId: product.id,
                name: product.name,
                price: product.price,
                qty: 1,
                total: product.price
            }];
        });
        toast.success(`Add: ${product.name}`, { duration: 1000, position: 'bottom-center' });
    };

    const confirmLooseItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!looseProduct || !weightInput) return;

        const weight = parseFloat(weightInput);
        if (isNaN(weight) || weight <= 0) {
            toast.error("Invalid weight");
            return;
        }

        // Stock Check
        const currentStock = inventoryMap ? (inventoryMap[looseProduct.id] || 0) : 0;
        // Check if item exists to see how much we already have
        const existingItem = cart.find(item => item.productId === looseProduct.id);
        const currentQtyInCart = existingItem ? existingItem.qty : 0;

        if (currentStock - (currentQtyInCart + weight) < 0) {
            toast.error(`Insufficient Stock! Available: ${currentStock} ${looseProduct.unit}`);
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.productId === looseProduct.id);
            if (existing) {
                // Update existing weight
                const newQty = existing.qty + weight;
                return prev.map(item =>
                    item.productId === looseProduct.id
                        ? { ...item, qty: newQty, total: newQty * item.price }
                        : item
                );
            }
            // Add new
            return [...prev, {
                productId: looseProduct.id,
                name: looseProduct.name,
                price: looseProduct.price,
                qty: weight,
                total: weight * looseProduct.price,
                isLoose: true // Add this flag to BillItem type if possible, or infer
            }]
        });

        toast.success(`Added ${weight}${looseProduct.unit} of ${looseProduct.name}`);
        setLooseProduct(null);
        setWeightInput("");
    };

    const updateQty = (productId: string, change: number) => {
        setCart(prev => prev.map(item => {
            if (item.productId === productId) {
                // Determine increment step: 1 for normal, 0.1? or disable?
                // For now, let's keep integer steps unless it's loose? 
                // Creating a special check for loose items to disable simple +/- or make it smart
                // But cart item doesn't store 'isLoose' property on 'BillItem' interface yet unless casted.
                // We'll rely on checking product list or assuming.

                // Let's assume standard behavior for now to not break "non-loose".
                // If the user wants to change weight, they should delete and re-add for now to keep it simple.
                // Or we allow small increments (0.1) if it's float?

                const isFloat = item.qty % 1 !== 0;
                const step = isFloat ? (change > 0 ? 0.1 : -0.1) : change;

                const newQty = parseFloat((item.qty + step).toFixed(3));
                if (newQty <= 0) return null;

                // Stock Check
                if (change > 0) {
                    const currentStock = inventoryMap ? (inventoryMap[productId] || 0) : 0;
                    if (currentStock - newQty < 0) {
                        toast.error(`Stock limit reached.`);
                        return item;
                    }
                }

                return { ...item, qty: newQty, total: newQty * item.price };
            }
            return item;
        }).filter(Boolean) as BillItem[]);
    };

    // ... (rest)



    const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);

    // Tax Calculation Logic
    const gstRate = settings?.gstRate || 0;
    const isGstEnabled = settings?.gstEnabled;
    const isTaxInclusive = settings?.taxInclusive ?? true;

    let taxAmount = 0;
    let payableAmount = cartTotal;

    if (isGstEnabled) {
        if (isTaxInclusive) {
            taxAmount = cartTotal * (gstRate / (100 + gstRate));
            payableAmount = cartTotal;
        } else {
            taxAmount = cartTotal * (gstRate / 100);
            payableAmount = cartTotal + taxAmount;
        }
    }



    const handlePrint = () => {
        window.print();
    };

    const handleCheckout = async (paymentMode: 'cash' | 'upi' | 'credit') => {
        if (cart.length === 0 || !shopId) return;

        let totalProfit = 0;
        for (const item of cart) {
            const product = await db.products.get(item.productId);
            if (product) {
                let baseSellingPrice = item.price;
                if (isGstEnabled && isTaxInclusive) {
                    baseSellingPrice = item.price / (1 + gstRate / 100);
                }
                const costPrice = product.costPrice || 0;
                totalProfit += (baseSellingPrice - costPrice) * item.qty;
            }
        }

        const bill: Bill = {
            id: uuidv4(),
            shopId: shopId,
            items: cart,
            totalAmount: payableAmount,
            paymentMode,
            customerId: customerPhone || "WALK_IN",
            customerName: customerName || null,
            customerPhone: customerPhone || null,
            profit: totalProfit,
            createdAt: Date.now(),
            status: 'completed',
            synced: false
        };

        try {
            await db.bills.add(bill);
            await db.syncQueue.add({
                collection: 'bills',
                docId: bill.id,
                action: 'create',
                data: bill,
                timestamp: Date.now(),
                shopId: shopId
            });

            if (customerPhone) {
                const existingCustomer = await db.customers.where({ phone: customerPhone, shopId: shopId }).first();
                const customerId = existingCustomer ? existingCustomer.id : uuidv4();

                const customerData = {
                    id: customerId,
                    shopId: shopId,
                    name: customerName || (existingCustomer?.name || 'Unknown'),
                    phone: customerPhone,
                    khataBalance: existingCustomer?.khataBalance || 0,
                    lastVisit: Date.now(),
                    synced: false
                };

                await db.customers.put(customerData);
                await db.syncQueue.add({
                    collection: 'customers',
                    docId: customerId,
                    action: 'update',
                    data: customerData,
                    timestamp: Date.now(),
                    shopId: shopId
                });
            }

            for (const item of cart) {
                const inventoryItem = await db.inventory.where({ productId: item.productId, shopId: shopId }).first();
                if (inventoryItem) {
                    await db.inventory.update(inventoryItem.productId, {
                        currentStock: inventoryItem.currentStock - item.qty,
                        lastUpdated: Date.now(),
                        synced: false
                    });
                    await db.syncQueue.add({
                        collection: 'inventory',
                        docId: item.productId,
                        action: 'update',
                        data: { currentStock: inventoryItem.currentStock - item.qty },
                        timestamp: Date.now(),
                        shopId: shopId
                    });
                }
            }

            toast.success("Bill Saved!");
            setLastBill(bill);
            setCart([]);
            setCustomerName("");
            setCustomerPhone("");
            setShowPaymentModal(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to save bill");
        }
    };

    const handleScanSuccess = (code: string) => {
        setSearchTerm(code);
        setIsScanning(false);
    };



    return (
        <>
            <div className="flex flex-col h-[calc(100vh-80px)] md:flex-row gap-6 no-print">
                {/* Left Panel: Product Grid */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    {/* Search & Scan Header */}
                    <div className="flex gap-3 bg-base-100 p-4 rounded-2xl shadow-sm border border-base-200">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 w-5 h-5" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search products or scan barcode..."
                                className="input input-bordered w-full pl-12 h-12 text-lg bg-base-100 focus:bg-base-200/50 transition-colors"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <button
                            className="btn btn-primary btn-lg aspect-square p-0 rounded-xl"
                            onClick={() => setIsScanning(true)}
                            title="Scan Barcode"
                        >
                            <ScanBarcode className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Scanner Modal */}
                    {isScanning && (
                        <dialog className="modal modal-open">
                            <div className="modal-box p-0 overflow-hidden relative">
                                <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10 text-white" onClick={() => setIsScanning(false)}>✕</button>
                                <BarcodeScanner onScanSuccess={handleScanSuccess} />
                            </div>
                            <form method="dialog" className="modal-backdrop">
                                <button onClick={() => setIsScanning(false)}>close</button>
                            </form>
                        </dialog>
                    )}

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto pr-2 pb-20 md:pb-0">
                        {!products ? (
                            <div className="min-h-[60vh] flex flex-col items-center justify-center text-base-content/50 gap-4">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p>Loading POS...</p>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-base-content/50">
                                <PackageOpen className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-lg font-medium">No products found</p>
                                <p className="text-sm">Add items from Inventory to start selling</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {products.map(product => {
                                    const stock = inventoryMap ? (inventoryMap[product.id] || 0) : 0;
                                    const lowStock = stock < 5;
                                    return (
                                        <button
                                            key={product.id}
                                            onClick={() => addToCart(product)}
                                            className={`group relative flex flex-col h-32 bg-base-100 rounded-2xl border border-base-200 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200 overflow-hidden text-left p-4 ${lowStock ? 'bg-warning/5 border-warning/30' : ''}`}
                                        >
                                            <div className="flex-1 min-w-0 w-full">
                                                <h3 className="font-semibold text-base leading-tight line-clamp-2 text-base-content group-hover:text-primary transition-colors mb-1">
                                                    {product.name}
                                                </h3>
                                                <p className="text-xs text-base-content/50 font-mono truncate">{product.barcode}</p>
                                            </div>

                                            <div className="flex items-end justify-between w-full mt-2">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-primary">₹{product.price}</span>
                                                    <span className="text-[10px] text-base-content/60">/{product.unit}</span>
                                                </div>
                                                <div className={`badge badge-sm ${lowStock ? 'badge-warning' : 'badge-ghost'} font-medium`}>
                                                    Stock: {stock}
                                                </div>
                                            </div>
                                            {/* Hover Effect Add Icon */}
                                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="bg-primary text-primary-content rounded-full p-2 shadow-lg scale-75 group-hover:scale-100 transition-transform">
                                                    <Plus className="w-6 h-6" />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Cart / Bill */}
                <div className="md:w-[400px] flex flex-col h-full bg-base-100 rounded-2xl shadow-xl border border-base-200 overflow-hidden">
                    {/* Cart Header */}
                    <div className="p-4 bg-base-100 border-b border-base-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <ShoppingCart className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg leading-none">Current Bill</h2>
                                <p className="text-xs text-base-content/60 font-medium mt-1">{cart.length} Items</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setCart([])}
                            disabled={cart.length === 0}
                            className="btn btn-ghost btn-sm btn-circle text-error hover:bg-error/10"
                            title="Clear Cart"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-base-50/50">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-base-content/30 gap-2">
                                <ShoppingCart className="w-12 h-12" />
                                <p className="text-sm font-medium">Cart is empty</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.productId} className="group flex items-center gap-3 p-3 bg-base-100 rounded-xl border border-base-200 hover:border-primary/30 transition-colors shadow-sm">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{item.name}</p>
                                        <p className="text-xs text-base-content/50">₹{item.price} each</p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center bg-base-200 rounded-lg p-0.5">
                                            <button className="w-7 h-7 flex items-center justify-center hover:bg-base-300 rounded-md transition-colors" onClick={() => updateQty(item.productId, -1)}>
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-8 text-center text-sm font-bold font-mono">{item.qty}</span>
                                            <button className="w-7 h-7 flex items-center justify-center hover:bg-base-300 rounded-md transition-colors" onClick={() => updateQty(item.productId, 1)}>
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="text-right min-w-[60px]">
                                            <span className="font-bold text-sm">₹{item.total}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Bill Footer */}
                    <div className="p-4 bg-base-100 border-t border-base-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                        <div className="space-y-2 mb-4">
                            {isGstEnabled && !isTaxInclusive && (
                                <div className="flex justify-between text-sm opacity-70">
                                    <span>Subtotal</span>
                                    <span>₹{cartTotal.toFixed(2)}</span>
                                </div>
                            )}
                            {isGstEnabled && !isTaxInclusive && (
                                <div className="flex justify-between text-sm opacity-70">
                                    <span>Tax ({gstRate}%)</span>
                                    <span>₹{taxAmount.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between items-end">
                                <span className="text-base font-medium opacity-80">Total Payable</span>
                                <span className="text-3xl font-extrabold text-primary">₹{payableAmount.toFixed(2)}</span>
                            </div>
                            {isGstEnabled && isTaxInclusive && (
                                <div className="text-[10px] text-right opacity-40">Includes Tax: ₹{taxAmount.toFixed(2)}</div>
                            )}
                        </div>

                        <button
                            className="btn btn-primary w-full btn-lg text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                            onClick={() => setShowPaymentModal(true)}
                            disabled={cart.length === 0}
                        >
                            Checkout <IndianRupee className="w-5 h-5 ml-1" />
                        </button>
                    </div>
                </div>

                {/* Loose Item Modal */}
                {looseProduct && (
                    <div className="modal modal-open modal-bottom sm:modal-middle z-[99]">
                        <div className="modal-box p-6">
                            <h3 className="font-bold text-xl flex items-center gap-2">
                                <PackageOpen className="w-6 h-6 text-primary" />
                                Enter {looseProduct.isLoose ? "Weight" : "Quantity"}
                            </h3>
                            <p className="py-2 text-sm opacity-70">
                                for <b>{looseProduct.name}</b> <span className="badge badge-sm">{looseProduct.unit}</span>
                            </p>

                            <form onSubmit={confirmLooseItem} className="mt-4">
                                <div className="form-control w-full relative">
                                    <label className="label uppercase text-xs font-bold opacity-50 pb-1">
                                        Quantity ({looseProduct.unit})
                                    </label>
                                    <input
                                        autoFocus
                                        type="number"
                                        step="0.001"
                                        min="0.001"
                                        placeholder="0.000"
                                        className="input input-lg input-bordered w-full font-mono text-3xl font-bold pl-4"
                                        value={weightInput}
                                        onChange={e => setWeightInput(e.target.value)}
                                    />
                                    <div className="text-right mt-2 font-medium">
                                        Total: <span className="text-primary font-bold text-xl">₹{((parseFloat(weightInput) || 0) * looseProduct.price).toFixed(2)}</span>
                                        <span className="text-xs opacity-50 block">@ ₹{looseProduct.price}/{looseProduct.unit}</span>
                                    </div>
                                </div>

                                <div className="modal-action gap-3 mt-8">
                                    <button type="button" className="btn btn-ghost flex-1" onClick={() => setLooseProduct(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary flex-1 btn-lg">Add to Bill</button>
                                </div>
                            </form>
                        </div>
                        <form method="dialog" className="modal-backdrop bg-black/50">
                            <button onClick={() => setLooseProduct(null)}>close</button>
                        </form>
                    </div>
                )}

                {/* Confirm Payment Modal */}
                {showPaymentModal && (
                    <dialog className="modal modal-open">
                        <div className="modal-box w-full max-w-sm p-6 rounded-3xl">
                            <button className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4" onClick={() => setShowPaymentModal(false)}>✕</button>

                            <h3 className="font-bold text-2xl text-center mb-1">Confirm</h3>
                            <p className="text-center text-base-content/60 text-sm mb-6">Total Payable Amount</p>

                            <div className="text-center mb-8">
                                <span className="text-5xl font-black text-primary">₹{payableAmount.toFixed(0)}</span>
                            </div>

                            {/* Customer Details Input */}
                            <div className="space-y-3 mb-6 bg-base-50 p-4 rounded-xl">
                                <div className="form-control">
                                    <label className="label text-xs font-bold uppercase opacity-50 pb-1">Customer Phone</label>
                                    <div className="relative">
                                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                                        <input
                                            type="tel"
                                            placeholder="9876543210"
                                            className="input input-sm input-bordered w-full pl-9"
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="form-control">
                                    <label className="label text-xs font-bold uppercase opacity-50 pb-1">Customer Name</label>
                                    <input
                                        type="text"
                                        placeholder="Optional"
                                        className="input input-sm input-bordered w-full"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button className="btn btn-success text-white btn-lg flex-1" onClick={() => handleCheckout('cash')}>
                                    Cash
                                </button>
                                <button className="btn btn-info text-white btn-lg flex-1" onClick={() => handleCheckout('upi')}>
                                    UPI
                                </button>
                            </div>
                            <div className="mt-3">
                                <button className="btn btn-ghost btn-sm w-full font-normal opacity-60 hover:opacity-100" onClick={() => handleCheckout('credit')}>
                                    Mark as Credit (Udhaar)
                                </button>
                            </div>
                        </div>
                        <form method="dialog" className="modal-backdrop bg-black/50 backdrop-blur-sm">
                            <button onClick={() => setShowPaymentModal(false)}>close</button>
                        </form>
                    </dialog>
                )}

                {/* Success Modal */}
                {lastBill && (
                    <dialog className="modal modal-open">
                        <div className="modal-box text-center p-8 rounded-3xl relative overflow-hidden">
                            {/* Confetti or Success Animation Background could go here */}
                            <div className="absolute top-0 left-0 w-full h-2 bg-success"></div>

                            <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                                <IndianRupee className="w-8 h-8" />
                            </div>

                            <h3 className="font-bold text-2xl text-base-content mb-1">Payment Successful</h3>
                            <p className="text-sm opacity-60 mb-6">Bill #{lastBill.id.slice(0, 8).toUpperCase()}</p>

                            <div className="bg-base-50 rounded-2xl p-6 mb-6 border border-base-200">
                                <p className="text-5xl font-black text-base-content">₹{lastBill.totalAmount.toFixed(2)}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button className="btn btn-outline gap-2" onClick={handlePrint}>
                                    <Printer className="w-4 h-4" /> Receipt
                                </button>
                                <button className="btn btn-primary" onClick={() => {
                                    setLastBill(null);
                                    searchInputRef.current?.focus();
                                }}>
                                    New Bill
                                </button>
                            </div>
                        </div>
                    </dialog>
                )}
                {/* Loose Item Modal (Restored) */}
                {looseProduct && (
                    <div className="modal modal-open modal-bottom sm:modal-middle backdrop-blur-sm">
                        <div className="modal-box rounded-3xl p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="font-bold text-2xl">{looseProduct.name}</h3>
                                    <p className="text-base-content/60 text-sm">Enter quantity in <span className="font-bold text-base-content">{looseProduct.unit}</span></p>
                                </div>
                                <button className="btn btn-sm btn-circle btn-ghost bg-base-200" onClick={() => setLooseProduct(null)}>✕</button>
                            </div>

                            <form onSubmit={confirmLooseItem}>
                                <div className="form-control w-full mb-8">
                                    <div className="relative">
                                        <input
                                            autoFocus
                                            type="number"
                                            step="0.001"
                                            min="0.001"
                                            placeholder="0.00"
                                            className="input input-lg w-full text-center text-5xl font-black h-24 bg-base-100 border-2 border-base-200 focus:border-primary focus:outline-none rounded-2xl no-spinner"
                                            value={weightInput}
                                            onChange={e => setWeightInput(e.target.value)}
                                        />
                                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-base-content/30 font-bold text-xl pointer-events-none">
                                            {looseProduct.unit}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-4 bg-base-50 p-4 rounded-xl">
                                        <span className="text-sm opacity-60">Price: ₹{looseProduct.price}/{looseProduct.unit}</span>
                                        <span className="text-xl font-bold text-primary">
                                            Total: ₹{((parseFloat(weightInput) || 0) * looseProduct.price).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button type="button" className="btn btn-outline btn-lg rounded-xl border-base-300" onClick={() => setLooseProduct(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary btn-lg rounded-xl text-primary-content">Add Item</button>
                                </div>
                            </form>
                        </div>
                        <form method="dialog" className="modal-backdrop bg-black/40">
                            <button onClick={() => setLooseProduct(null)}>close</button>
                        </form>
                    </div>
                )}
            </div>

            {/* Receipt Component (Hidden) */}
            {lastBill && (
                <Receipt
                    ref={receiptRef}
                    bill={lastBill as Bill}
                    settings={settings}
                />
            )}
        </>
    );
}
