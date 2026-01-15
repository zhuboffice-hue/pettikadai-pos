"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { db, Bill, StoreSettings } from "@/lib/db/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, useRef } from "react";
import { Search, Printer, Calendar, IndianRupee, ShoppingBag, Eye, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { Receipt } from "@/components/billing/Receipt";

export default function OrdersPage() {
    const { userData } = useAuth();
    const shopId = userData?.shopId;

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

    // Fetch Bills
    const bills = useLiveQuery(async () => {
        if (!shopId) return [];
        let collection = db.bills.where('shopId').equals(shopId);

        // Simple search logic (Dexie filtering)
        // Ideally we would index based on date/customer, but filtering in memory for small datasets is fine
        return await collection.reverse().sortBy('createdAt');
    }, [shopId]);

    // Fetch Settings for Receipt
    const settings = useLiveQuery(async () => {
        if (!shopId) return undefined;
        return await db.storeSettings.where('shopId').equals(shopId).first();
    }, [shopId]);

    const filteredBills = bills?.filter(bill => {
        const matchesSearch =
            (bill.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                bill.customerPhone?.includes(searchTerm) ||
                bill.id.includes(searchTerm));

        // Optional date filter if implemented strictly, currently just listing all
        // const matchesDate = format(new Date(bill.createdAt), 'yyyy-MM-dd') === selectedDate;

        return matchesSearch;
    });

    const handlePrint = (bill: Bill) => {
        setSelectedBill(bill);
        // Wait for state update then print
        setTimeout(() => window.print(), 100);
    };

    return (
        <div className="space-y-6 container mx-auto max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Orders History</h1>
                    <p className="text-base-content/60">View and manage past sales</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <input
                            type="text"
                            placeholder="Search Customer / Bill #..."
                            className="input input-bordered w-full pl-9"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Date Picker (Visual only for now if logic not strict) */}
                    <input
                        type="date"
                        className="input input-bordered"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                    />
                </div>
            </div>

            {/* Orders List */}
            <div className="card bg-base-100 shadow-xl border border-base-200">
                <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr className="bg-base-200/50">
                                <th>Order ID</th>
                                <th>Date & Time</th>
                                <th>Customer</th>
                                <th>Items</th>
                                <th>Payment</th>
                                <th className="text-right">Amount</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!filteredBills || filteredBills.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-10 opacity-50">
                                        <div className="flex flex-col items-center gap-2">
                                            <ShoppingBag className="w-12 h-12 opacity-20" />
                                            <span>No orders found</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredBills.map(bill => (
                                    <tr key={bill.id} className="hover:bg-base-200/50 transition-colors group">
                                        <td className="font-mono text-xs opacity-70">
                                            #{bill.id.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{format(new Date(bill.createdAt), 'MMM dd, yyyy')}</span>
                                                <span className="text-xs opacity-50">{format(new Date(bill.createdAt), 'hh:mm a')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            {bill.customerName ? (
                                                <div>
                                                    <div className="font-bold text-sm">{bill.customerName}</div>
                                                    <div className="text-xs opacity-50">{bill.customerPhone}</div>
                                                </div>
                                            ) : (
                                                <span className="opacity-40 italic">Walk-in Customer</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="tooltip" data-tip={bill.items.map(i => i.name).join(', ')}>
                                                <div className="badge badge-ghost gap-1">
                                                    <ShoppingBag className="w-3 h-3" />
                                                    {bill.items.length} items
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge badge-sm font-medium ${bill.paymentMode === 'cash' ? 'badge-success badge-outline' :
                                                bill.paymentMode === 'upi' ? 'badge-info badge-outline' :
                                                    'badge-warning badge-outline'
                                                }`}>
                                                {bill.paymentMode.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <div className="font-bold text-base">₹{bill.totalAmount.toFixed(2)}</div>
                                            {/* Show Profit for Admin only (Optional) */}
                                            {bill.profit !== undefined && (
                                                <div className="text-[10px] text-success font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    +{bill.profit.toFixed(0)} Profit
                                                </div>
                                            )}
                                        </td>
                                        <td className="text-center">
                                            <button
                                                className="btn btn-sm btn-ghost btn-square tooltip tooltip-left"
                                                data-tip="Reprint Receipt"
                                                onClick={() => handlePrint(bill)}
                                            >
                                                <Printer className="w-4 h-4 text-base-content/70" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Hidden Receipt Component for Printing */}
            <div>
                {selectedBill && (
                    <Receipt bill={selectedBill} settings={settings} />
                )}
            </div>

            {/* Print trigger wrapper logic handled by generic window.print() but could be refined to print generic iframe or specific div */}
            {/* Since Receipt component uses generic styling, it might print whole page if not handled. 
                Ideally Receipt component should have specific @media print styles that hide everything else. 
                Let's assume the previous `Receipt` component handles print visibility (it likely does via `print:block` and rest `print:hidden`).
             */}
        </div>
    );
}
