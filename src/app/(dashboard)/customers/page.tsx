"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Customer, Bill } from "@/lib/db/db";
import {
    Loader2, Users, Search, Phone, Calendar,
    ShoppingBag, Plus, X, TrendingUp, Trophy, Star
} from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { toast } from "react-hot-toast";

interface EnrichedCustomer extends Customer {
    totalSpent: number;
    visitCount: number;
    avgOrderValue: number;
}

export default function CustomersPage() {
    const { userData } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState<'recent' | 'spent' | 'visits'>('recent');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

    // Fetch All Data & Enrich
    const customersData = useLiveQuery(async () => {
        if (!userData?.shopId) return { list: [], topSpender: null, frequentVisitor: null };

        const [allCustomers, allBills] = await Promise.all([
            db.customers.where('shopId').equals(userData.shopId).toArray(),
            db.bills.where('shopId').equals(userData.shopId).toArray()
        ]);

        // Aggregate Bill Data by Phone (since Bill stores phone, Customer stores phone)
        const billStats = new Map<string, { spent: number, count: number }>();

        allBills.forEach(bill => {
            if (bill.customerPhone) {
                const current = billStats.get(bill.customerPhone) || { spent: 0, count: 0 };
                billStats.set(bill.customerPhone, {
                    spent: current.spent + bill.totalAmount,
                    count: current.count + 1
                });
            }
        });

        const enriched: EnrichedCustomer[] = allCustomers.map(c => {
            const stats = billStats.get(c.phone) || { spent: 0, count: 0 };
            return {
                ...c,
                totalSpent: stats.spent,
                visitCount: stats.count,
                avgOrderValue: stats.count > 0 ? stats.spent / stats.count : 0
            };
        });

        // Calculate Global Stats
        const topSpender = [...enriched].sort((a, b) => b.totalSpent - a.totalSpent)[0];
        const frequentVisitor = [...enriched].sort((a, b) => b.visitCount - a.visitCount)[0];

        return { list: enriched, topSpender, frequentVisitor };
    }, [userData?.shopId]);

    const filteredAndSortedCustomers = useMemo(() => {
        if (!customersData?.list) return [];

        let result = customersData.list;

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(lowerTerm) ||
                c.phone.includes(searchTerm)
            );
        }

        return result.sort((a, b) => {
            if (sortBy === 'spent') return b.totalSpent - a.totalSpent;
            if (sortBy === 'visits') return b.visitCount - a.visitCount;
            // Default: Recent ('recent')
            return b.lastVisit - a.lastVisit;
        });
    }, [customersData, searchTerm, sortBy]);

    // Fetch Specific Customer History (Bills)
    const customerBills = useLiveQuery(async () => {
        if (!selectedCustomer || !userData?.shopId) return [];
        return await db.bills
            .where('shopId').equals(userData.shopId)
            .filter(b => b.customerPhone === selectedCustomer.phone)
            .reverse()
            .toArray();
    }, [selectedCustomer]);

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userData?.shopId) return;

        try {
            const id = uuidv4();
            const customer = {
                id,
                shopId: userData.shopId,
                name: newCustomer.name,
                phone: newCustomer.phone,
                khataBalance: 0,
                lastVisit: Date.now(),
                synced: false
            };

            await db.customers.put(customer);
            await db.syncQueue.add({
                collection: 'customers',
                docId: id,
                action: 'create',
                data: customer,
                timestamp: Date.now(),
                shopId: userData.shopId
            });

            toast.success("Customer Added");
            setIsAddModalOpen(false);
            setNewCustomer({ name: '', phone: '' });
        } catch (error) {
            console.error(error);
            toast.error("Failed to add customer");
        }
    };

    if (!userData) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>;

    if (userData?.role !== 'shop-admin' && userData?.role !== 'superadmin' && userData?.role !== 'user' && userData?.role !== 'shop-user') {
        return <div className="p-10 text-center text-error">Access Restricted</div>;
    }

    const { topSpender, frequentVisitor } = customersData || {};

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Users className="w-8 h-8 text-primary" /> Customers CRM
                </h1>
                <button className="btn btn-primary gap-2" onClick={() => setIsAddModalOpen(true)}>
                    <Plus className="w-5 h-5" /> Add Customer
                </button>
            </div>

            {/* Analytics Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="stats shadow bg-base-100 border border-base-200">
                    <div className="stat">
                        <div className="stat-figure text-secondary">
                            <Trophy className="w-8 h-8" />
                        </div>
                        <div className="stat-title">Top Spender</div>
                        <div className="stat-value text-secondary text-2xl truncate">
                            {topSpender && topSpender.totalSpent > 0 ? topSpender.name : 'N/A'}
                        </div>
                        <div className="stat-desc text-secondary font-bold">
                            ₹{topSpender?.totalSpent.toLocaleString() || 0} Lifetime Value
                        </div>
                    </div>
                </div>

                <div className="stat bg-base-100 shadow border border-base-200 rounded-2xl">
                    <div className="stat-figure text-accent">
                        <Star className="w-8 h-8" />
                    </div>
                    <div className="stat-title">Most Frequent</div>
                    <div className="stat-value text-accent text-2xl truncate">
                        {frequentVisitor && frequentVisitor.visitCount > 0 ? frequentVisitor.name : 'N/A'}
                    </div>
                    <div className="stat-desc text-accent font-bold">
                        {frequentVisitor?.visitCount || 0} Visits
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by Name or Phone..."
                        className="input input-bordered w-full pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="select select-bordered w-full md:w-auto"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                >
                    <option value="recent">Recently Visited</option>
                    <option value="spent">Highest Spenders</option>
                    <option value="visits">Most Frequent</option>
                </select>
            </div>

            {/* Customer List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredAndSortedCustomers.length === 0 ? (
                    <div className="col-span-full text-center p-10 opacity-50">No customers found</div>
                ) : (
                    filteredAndSortedCustomers.map(customer => (
                        <div
                            key={customer.id}
                            onClick={() => setSelectedCustomer(customer)}
                            className="card bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer border border-base-200 group"
                        >
                            <div className="card-body p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{customer.name}</h3>
                                        <div className="flex items-center gap-2 text-sm opacity-70 mt-1">
                                            <Phone className="w-4 h-4" /> {customer.phone}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-lg">₹{customer.totalSpent.toLocaleString()}</div>
                                        <div className="text-xs opacity-60">{customer.visitCount} orders</div>
                                    </div>
                                </div>

                                <div className="divider my-2"></div>

                                <div className="flex justify-between items-end">
                                    <div className="text-xs opacity-60 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> {new Date(customer.lastVisit).toLocaleDateString()}
                                    </div>
                                    {customer.khataBalance !== 0 && (
                                        <div className={`badge badge-sm font-bold ${customer.khataBalance > 0 ? 'badge-error' : 'badge-success'}`}>
                                            {customer.khataBalance > 0 ? 'Due' : 'Adv'}: ₹{Math.abs(customer.khataBalance)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Customer Details Modal */}
            {selectedCustomer && (
                <dialog className="modal modal-open">
                    <div className="modal-box w-11/12 max-w-4xl h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b border-base-200 pb-4">
                            <div>
                                <h3 className="font-bold text-2xl">{selectedCustomer.name}</h3>
                                <p className="opacity-70 flex items-center gap-2"><Phone className="w-4 h-4" /> {selectedCustomer.phone}</p>
                            </div>
                            <button className="btn btn-circle btn-ghost" onClick={() => setSelectedCustomer(null)}><X /></button>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-base-200 p-4 rounded-xl text-center">
                                <span className="text-xs uppercase opacity-60">Total Spent</span>
                                <div className="text-xl font-bold">₹{(selectedCustomer as EnrichedCustomer).totalSpent?.toLocaleString() || 0}</div>
                            </div>
                            <div className="bg-base-200 p-4 rounded-xl text-center">
                                <span className="text-xs uppercase opacity-60">Orders</span>
                                <div className="text-xl font-bold">{(selectedCustomer as EnrichedCustomer).visitCount || 0}</div>
                            </div>
                            <div className="bg-base-200 p-4 rounded-xl text-center">
                                <span className="text-xs uppercase opacity-60">Avg Order</span>
                                <div className="text-xl font-bold">₹{((selectedCustomer as EnrichedCustomer).avgOrderValue || 0).toFixed(0)}</div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-primary" /> Purchase History
                            </h4>

                            {!customerBills || customerBills.length === 0 ? (
                                <div className="p-10 text-center opacity-50 bg-base-200 rounded-lg">No Purchase History</div>
                            ) : (
                                <table className="table table-zebra w-full bg-base-100 rounded-lg">
                                    <thead className="sticky top-0 bg-base-100 z-10 shadow-sm">
                                        <tr>
                                            <th>Date</th>
                                            <th>Items</th>
                                            <th className="text-right">Total</th>
                                            <th className="text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customerBills.map(bill => (
                                            <tr key={bill.id}>
                                                <td>
                                                    {new Date(bill.createdAt).toLocaleDateString()}
                                                    <div className="text-xs opacity-50">{new Date(bill.createdAt).toLocaleTimeString()}</div>
                                                </td>
                                                <td>
                                                    <div className="tooltip" data-tip={bill.items.map(i => `${i.qty}x ${i.name}`).join(', ')}>
                                                        {bill.items.length} items
                                                    </div>
                                                </td>
                                                <td className="text-right font-bold">₹{bill.totalAmount}</td>
                                                <td className="text-right"><span className="badge badge-success badge-sm">Paid</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                    <form method="dialog" className="modal-backdrop bg-black/50 backdrop-blur-sm">
                        <button onClick={() => setSelectedCustomer(null)}>close</button>
                    </form>
                </dialog>
            )}

            {/* Add Customer Modal */}
            {isAddModalOpen && (
                <dialog className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">Add New Customer</h3>
                        <form onSubmit={handleAddCustomer} className="flex flex-col gap-4">
                            <div className="form-control">
                                <label className="label">Name</label>
                                <input
                                    required
                                    className="input input-bordered"
                                    value={newCustomer.name}
                                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">Phone</label>
                                <input
                                    required
                                    type="tel"
                                    className="input input-bordered"
                                    value={newCustomer.phone}
                                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                />
                            </div>
                            <div className="modal-action">
                                <button type="button" className="btn" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </dialog>
            )}
        </div>
    );
}
