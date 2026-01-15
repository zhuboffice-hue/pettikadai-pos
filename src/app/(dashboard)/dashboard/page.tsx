
"use client";

import { useState, useEffect, useRef } from "react";
import { Search, ScanBarcode, ShoppingCart, Plus, Minus, Trash2, X, Printer } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Product, Bill, BillItem } from "@/lib/db/db";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from 'uuid';
import { Receipt } from "@/components/billing/Receipt";
import { doc, getDoc } from "firebase/firestore";
import { db as firestore } from "@/lib/firebase/config"; // Renaming to avoid conflict with local db

import { useAuth } from "@/components/providers/AuthProvider";

import BarcodeScanner from "@/components/BarcodeScanner";

export default function DashboardPage() {
    const { userData } = useAuth();
    const shopId = userData?.shopId;

    const [searchTerm, setSearchTerm] = useState("");
    const [cart, setCart] = useState<BillItem[]>([]);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    // Live query for products
    const products = useLiveQuery(
        async () => {
            if (!shopId) return [];
            if (!searchTerm) return db.products.where('shopId').equals(shopId).limit(20).toArray();
            // Simple case-insensitive search
            const lowerTerm = searchTerm.toLowerCase();
            const shopProducts = await db.products.where('shopId').equals(shopId).toArray();
            return shopProducts
                .filter(p =>
                    p.name.toLowerCase().includes(lowerTerm) ||
                    (p.barcode ? p.barcode.includes(searchTerm) : false)
                )
                .slice(0, 20);
        },
        [searchTerm, shopId]
    );

    const addToCart = (product: Product) => {
        const existing = cart.find(i => i.productId === product.id);

        if (existing) {
            toast.success(`Updated ${product.name} qty`, { id: 'cart-update', duration: 1000 });
        } else {
            toast.success(`Added ${product.name}`, { id: 'cart-update', duration: 1000 });
        }

        setCart(prev => {
            const existingInPrev = prev.find(i => i.productId === product.id);
            if (existingInPrev) {
                return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.price } : i);
            }
            return [...prev, {
                productId: product.id,
                name: product.name,
                qty: 1,
                price: product.price,
                total: product.price
            }];
        });
        setSearchTerm(""); // Clear search after adding
        searchInputRef.current?.focus();
    };

    const handleScanSuccess = async (decodedText: string) => {
        console.log("Scan success:", decodedText);
        setIsScanning(false);

        // Play beep
        const audio = new Audio('/beep.mp3');
        audio.play().catch(() => { });

        if (!shopId) {
            toast.error("Shop ID missing");
            return;
        }

        // Find product
        const allProducts = await db.products.where('shopId').equals(shopId).toArray();
        const product = allProducts.find(p => p.barcode === decodedText);

        if (product) {
            addToCart(product);
            toast.success(`Scanned: ${product.name}`);
        } else {
            setSearchTerm(decodedText);
            toast("Product not found. Search updated.", { icon: '🔍' });
        }
    };

    const updateQty = (productId: string, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i.productId === productId) {
                const newQty = Math.max(0, i.qty + delta);
                if (newQty === 0) return null;
                return { ...i, qty: newQty, total: newQty * i.price };
            }
            return i;
        }).filter(Boolean) as BillItem[]);
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);

    const [lastBill, setLastBill] = useState<Bill | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);
    const [shopName, setShopName] = useState<string>('');
    const [ownerEmail, setOwnerEmail] = useState<string>('');

    useEffect(() => {
        const fetchShop = async () => {
            if (userData?.shopName) {
                setShopName(userData.shopName);
                if (userData.email) setOwnerEmail(userData.email);
            } else if (userData?.shopId) {
                try {
                    const shopDoc = await getDoc(doc(firestore, "shops", userData.shopId));
                    if (shopDoc.exists()) {
                        const data = shopDoc.data();
                        setShopName(data.name || 'Kirana Shop');
                        setOwnerEmail(data.ownerEmail || '');
                    }
                } catch (error) {
                    console.error("Error fetching shop name:", error);
                    setShopName('Kirana Shop');
                }
            }
        };
        fetchShop();
    }, [userData]);

    const handlePrint = () => {
        window.print();
    };

    const handleCheckout = async (paymentMode: 'cash' | 'upi' | 'credit') => {
        if (cart.length === 0 || !shopId) return;

        const bill: Bill = {
            id: uuidv4(),
            shopId: shopId,
            items: cart,
            totalAmount: cartTotal,
            paymentMode,
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
                timestamp: Date.now()
            });

            for (const item of cart) {
                const inv = await db.inventory.get(item.productId);
                if (inv) {
                    await db.inventory.update(item.productId, {
                        currentStock: inv.currentStock - item.qty,
                        synced: false
                    });
                }
            }

            toast.success("Bill Saved!");
            setLastBill(bill); // Show Success Modal
            setCart([]);
            setShowPaymentModal(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to save bill");
        }
    };

    const quickMoney = [10, 20, 50, 100, 200, 500];

    return (
        <>
            <div className="flex flex-col h-[calc(100vh-80px)] md:flex-row gap-4 print:hidden">
                {/* Left Panel: Billing Interface */}
                <div className="flex-1 flex flex-col gap-4">
                    {/* Search Bar */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search / Scan Item..."
                                className="input input-bordered w-full pl-10 text-lg"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <button className="btn btn-square btn-outline" onClick={() => setIsScanning(true)}>
                            <ScanBarcode className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Scanner Modal */}
                    {isScanning && (
                        <dialog className="modal modal-open">
                            <div className="modal-box">
                                <h3 className="font-bold text-lg mb-4">Scan Barcode</h3>
                                <BarcodeScanner
                                    onScanSuccess={handleScanSuccess}
                                />
                                <div className="modal-action">
                                    <button className="btn" onClick={() => setIsScanning(false)}>Close</button>
                                </div>
                            </div>
                        </dialog>
                    )}

                    {/* Quick Items Grid */}
                    <div className="flex-1 overflow-y-auto p-1">
                        {!products ? (
                            <div className="flex justify-center p-10"><span className="loading loading-spinner loading-lg"></span></div>
                        ) : (
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {products.map(product => (
                                    <button
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="btn h-24 flex flex-col gap-1 bg-base-100 shadow-sm hover:shadow-md border-base-300 normal-case"
                                    >
                                        <span className="font-bold text-sm line-clamp-2 md:text-base">{product.name}</span>
                                        <span className="text-xs badge badge-ghost">₹{product.price}</span>
                                    </button>
                                ))}
                                {products.length === 0 && (
                                    <div className="col-span-full text-center text-gray-500 py-10">
                                        No products found. Go to Inventory to add items.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Cart Summary */}
                <div className="md:w-96 bg-base-100 rounded-box shadow-xl flex flex-col border border-base-200 h-full">
                    <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-200 rounded-t-box">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5" /> Bill
                        </h2>
                        <span className="badge badge-primary badge-lg">{cart.reduce((a, b) => a + b.qty, 0)} items</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
                                <ShoppingCart className="w-12 h-12 mb-2" />
                                <p>Scan items to start billing</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.productId} className="flex items-center justify-between p-2 bg-base-200 rounded-lg">
                                    <div className="flex-1">
                                        <p className="font-bold">{item.name}</p>
                                        <p className="text-sm opacity-70">₹{item.price} x {item.qty}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="join border border-base-300 rounded-lg bg-base-100">
                                            <button className="join-item btn btn-xs btn-ghost px-2" onClick={() => updateQty(item.productId, -1)}><Minus className="w-3 h-3" /></button>
                                            <span className="join-item flex items-center px-2 text-sm font-mono">{item.qty}</span>
                                            <button className="join-item btn btn-xs btn-ghost px-2" onClick={() => updateQty(item.productId, 1)}><Plus className="w-3 h-3" /></button>
                                        </div>
                                        <div className="w-16 text-right font-bold">
                                            ₹{item.total}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 border-t border-base-200 bg-base-50 rounded-b-box">
                        <div className="flex justify-between text-2xl font-bold mb-4">
                            <span>Total</span>
                            <span className="text-primary">₹{cartTotal}</span>
                        </div>
                        <button
                            className="btn btn-primary w-full btn-lg text-xl shadow-lg"
                            onClick={() => setShowPaymentModal(true)}
                            disabled={cart.length === 0}
                        >
                            PAY ₹{cartTotal}
                        </button>
                    </div>
                </div>

                {/* Payment Modal */}
                {showPaymentModal && (
                    <dialog className="modal modal-open">
                        <div className="modal-box w-11/12 max-w-2xl bg-base-100 p-0 overflow-hidden">
                            <div className="bg-primary text-primary-content p-4 flex justify-between items-center">
                                <h3 className="font-bold text-2xl">Confirm Payment</h3>
                                <button onClick={() => setShowPaymentModal(false)}><X /></button>
                            </div>

                            <div className="p-6">
                                <div className="text-center mb-8">
                                    <span className="text-sm uppercase tracking-widest opacity-70">Total Amount</span>
                                    <div className="text-6xl font-bold mt-2">₹{cartTotal}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <button className="btn btn-lg btn-success h-20 text-xl" onClick={() => handleCheckout('cash')}>
                                        💵 Cash
                                    </button>
                                    <button className="btn btn-lg btn-info h-20 text-xl" onClick={() => handleCheckout('upi')}>
                                        📱 UPI
                                    </button>
                                </div>

                                <div className="divider">Quick Cash</div>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                    {quickMoney.map(amount => (
                                        <button key={amount} className="btn btn-outline" onClick={() => { /* logic for calc change */ }}>
                                            ₹{amount}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="modal-action p-4 bg-base-200 m-0">
                                <button className="btn btn-error" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                            </div>
                        </div>
                        <form method="dialog" className="modal-backdrop">
                            <button onClick={() => setShowPaymentModal(false)}>close</button>
                        </form>
                    </dialog>
                )}

                {/* Bill Success Modal */}
                {lastBill && (
                    <dialog className="modal modal-open">
                        <div className="modal-box text-center relative">
                            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setLastBill(null)}>✕</button>
                            <h3 className="font-bold text-2xl text-success mb-4">Payment Successful!</h3>
                            <div className="py-4">
                                <p className="text-4xl font-bold">₹{lastBill.totalAmount}</p>
                                <p className="opacity-70 mt-2">Bill #{lastBill.id.slice(0, 8)}</p>
                            </div>
                            <div className="modal-action justify-center gap-4">
                                <button className="btn btn-outline gap-2" onClick={handlePrint}>
                                    <Printer className="w-5 h-5" /> Print Receipt
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
            </div>

            {/* Hidden Receipt Component for Printing */}
            {lastBill && (
                <Receipt
                    ref={receiptRef}
                    bill={lastBill}
                    shopDetails={{ name: shopName || 'Kirana Store' }}
                />
            )}
        </>
    );
}
