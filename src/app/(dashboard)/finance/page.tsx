"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { Loader2, TrendingUp, CreditCard, ShoppingBag, LayoutDashboard } from "lucide-react";

export default function FinancePage() {
    const { userData } = useAuth();

    // Live query for recent bills
    const recentBills = useLiveQuery(async () => {
        if (!userData?.shopId) return [];
        // Dexie doesn't sort by time by default unless indexed. 
        // Assuming bills are added sequentially or sort in memory for now.
        const bills = await db.bills
            .where('shopId')
            .equals(userData.shopId)
            .reverse()
            .limit(50)
            .toArray();
        return bills;
    }, [userData?.shopId]);

    // Live query for aggregated stats
    const stats = useLiveQuery(async () => {
        if (!userData?.shopId) return { revenue: 0, billCount: 0, avgBillValue: 0 };

        const allBills = await db.bills.where('shopId').equals(userData.shopId).toArray();
        let totalRevenue = 0;
        allBills.forEach(b => totalRevenue += b.totalAmount);

        return {
            revenue: totalRevenue,
            billCount: allBills.length,
            avgBillValue: allBills.length > 0 ? Math.round(totalRevenue / allBills.length) : 0
        };
    }, [userData?.shopId]);

    if (!userData) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>;

    if (userData?.role !== 'shop-admin' && userData?.role !== 'superadmin' && userData?.role !== 'user') {
        return <div className="p-10 text-center text-error">Access Restricted: Shop Admins Only</div>;
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <LayoutDashboard className="w-8 h-8 text-primary" /> Finance Dashboard
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="stat bg-base-100 shadow rounded-box border-l-4 border-primary">
                    <div className="stat-figure text-primary">
                        <TrendingUp className="w-8 h-8" />
                    </div>
                    <div className="stat-title">Total Revenue (All Time)</div>
                    <div className="stat-value text-primary">₹{stats?.revenue?.toLocaleString() || 0}</div>
                    <div className="stat-desc">Locally Stored Data</div>
                </div>

                <div className="stat bg-base-100 shadow rounded-box border-l-4 border-secondary">
                    <div className="stat-figure text-secondary">
                        <ShoppingBag className="w-8 h-8" />
                    </div>
                    <div className="stat-title">Bills Generated</div>
                    <div className="stat-value text-secondary">{stats?.billCount || 0}</div>
                    <div className="stat-desc">Total Transactions</div>
                </div>

                <div className="stat bg-base-100 shadow rounded-box border-l-4 border-accent">
                    <div className="stat-figure text-accent">
                        <CreditCard className="w-8 h-8" />
                    </div>
                    <div className="stat-title">Avg. Bill Value</div>
                    <div className="stat-value text-accent">₹{stats?.avgBillValue || 0}</div>
                    <div className="stat-desc">Per transaction</div>
                </div>
            </div>

            <div className="card bg-base-100 shadow-xl border border-base-200">
                <div className="card-body">
                    <h2 className="card-title mb-4">Recent Transactions</h2>
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Bill ID</th>
                                    <th>Items</th>
                                    <th>Payment</th>
                                    <th className="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!recentBills || recentBills.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center p-4 opacity-50">No transactions found</td></tr>
                                ) : (
                                    recentBills.map((bill) => (
                                        <tr key={bill.id}>
                                            <td className="whitespace-nowrap">
                                                {new Date(bill.createdAt).toLocaleDateString()}
                                                <br />
                                                <span className="text-xs opacity-50">{new Date(bill.createdAt).toLocaleTimeString()}</span>
                                            </td>
                                            <td className="font-mono text-xs">{bill.id.slice(0, 8)}</td>
                                            <td>{bill.items?.length || 0} items</td>
                                            <td><span className="badge badge-sm badge-ghost uppercase">{bill.paymentMode}</span></td>
                                            <td className="text-right font-bold">₹{bill.totalAmount}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
