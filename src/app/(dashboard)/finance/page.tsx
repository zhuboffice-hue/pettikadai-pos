"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { db, Expense, Product } from "@/lib/db/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import {
    IndianRupee, TrendingUp, TrendingDown,
    Wallet, Package, Calendar, Plus, Trash2,
    ArrowUpRight, AlertTriangle, Users, Star,
    LayoutTemplate
} from "lucide-react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from 'uuid';
import { db as firestoreDb } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";

export default function ShopAdminDashboard() {
    const { userData } = useAuth();
    const shopId = userData?.shopId;

    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

    // Employee State
    const [staffList, setStaffList] = useState<any[]>([]);
    const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "shop-user" });
    const [isLoadingStaff, setIsLoadingStaff] = useState(false);

    const [expenseForm, setExpenseForm] = useState({
        title: "",
        amount: "",
        category: "Rent"
    });

    // 1. Fetch Basic Data (Dexie)
    const bills = useLiveQuery(async () => {
        if (!shopId) return [];
        return await db.bills.where('shopId').equals(shopId).toArray();
    }, [shopId]);

    const inventory = useLiveQuery(async () => {
        if (!shopId) return [];
        return await db.inventory.where('shopId').equals(shopId).toArray();
    }, [shopId]);

    const products = useLiveQuery(async () => {
        if (!shopId) return [];
        return await db.products.where('shopId').equals(shopId).toArray();
    }, [shopId]);

    const expenses = useLiveQuery(async () => {
        if (!shopId) return [];
        return await db.expenses.where('shopId').equals(shopId).reverse().sortBy('date');
    }, [shopId]);

    const customers = useLiveQuery(async () => {
        if (!shopId) return [];
        return await db.customers.where('shopId').equals(shopId).toArray();
    }, [shopId]);

    // 2. Calculations
    // Only count COMPLETED bills
    const validBills = bills?.filter(b => b.status === 'completed') || [];

    const totalRevenue = validBills.reduce((acc, bill) => acc + bill.totalAmount, 0);
    const totalBills = validBills.length;

    // Expenses
    const totalExpenses = expenses?.reduce((acc, exp) => acc + exp.amount, 0) || 0;

    // Recalculate Gross Profit based on CURRENT Product Costs (snapshot fix)
    const grossProfit = validBills.reduce((acc, bill) => {
        let billProfit = 0;
        bill.items.forEach(item => {
            const product = products?.find(p => p.id === item.productId);
            // If product exists, use its CURRENT cost price. If not, fallback to item-level profit if stored, or 0.
            if (product && product.costPrice) {
                // Calculate item profit: (Selling Price - Cost Price) * Qty
                // Note: item.price is the unit selling price
                const profitPerItem = (item.price - product.costPrice);
                billProfit += profitPerItem * item.qty;
            } else {
                // Fallback if we can't find cost (e.g. deleted product)
                // Assume 20% margin if no data?? No, safer to assume 0 or use bill.profit if available.
                // Let's use stored bill profit if available, else 0.
                // But wait, old bills have 0 profit. 
                // If cost is missing, we can't calculate profit. 
                billProfit += 0;
            }
        });
        return acc + billProfit;
    }, 0);

    const netProfit = grossProfit - totalExpenses;

    // 3. Logic
    const lowStockItems = inventory?.filter(inv => inv.currentStock < (inv.lowStockThreshold || 5))
        .map(inv => {
            const product = products?.find(p => p.id === inv.productId);
            return {
                ...inv,
                name: product?.name || 'Unknown Item',
                unit: product?.unit || ''
            };
        }) || [];

    const topCustomers = (customers || []).map(c => {
        const customerBills = validBills.filter(b => b.customerPhone === c.phone);
        const totalSpent = customerBills.reduce((acc, b) => acc + b.totalAmount, 0);
        return { ...c, totalSpent, count: customerBills.length };
    }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 3);

    const stockValue = inventory?.reduce((acc, item) => {
        const product = products?.find(p => p.id === item.productId);
        const costPrice = product?.costPrice || 0;
        return acc + (item.currentStock * costPrice);
    }, 0) || 0;


    // Handlers
    const handleAddExpense = async () => {
        if (!shopId || !expenseForm.title || !expenseForm.amount) return;
        try {
            const expense: Expense = {
                id: uuidv4(),
                shopId,
                title: expenseForm.title,
                amount: parseFloat(expenseForm.amount),
                category: expenseForm.category,
                date: Date.now(),
                synced: false
            };
            await db.expenses.add(expense);
            await db.syncQueue.add({
                collection: 'expenses', docId: expense.id, action: 'create', data: expense, timestamp: Date.now(), shopId
            });
            toast.success("Expense Added");
            setIsExpenseModalOpen(false);
            setExpenseForm({ title: "", amount: "", category: "Rent" });
        } catch (error) { toast.error("Failed"); }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!shopId) return;
        try {
            await db.expenses.delete(id);
            await db.syncQueue.add({
                collection: 'expenses', docId: id, action: 'delete', data: { id }, timestamp: Date.now(), shopId
            });
            toast.success("Deleted");
        } catch (e) { toast.error("Failed"); }
    };

    const handleRestock = async (item: any) => {
        if (!shopId) return;
        const qtyStr = prompt(`Enter quantity to ADD to ${item.name}:`);
        if (!qtyStr) return;

        const qtyToAdd = parseFloat(qtyStr);
        if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
            toast.error("Invalid quantity");
            return;
        }

        try {
            const newStock = (item.currentStock || 0) + qtyToAdd;

            // Update Local
            await db.inventory.where('productId').equals(item.productId).modify({
                currentStock: newStock,
                lastUpdated: Date.now(),
                synced: false
            });

            // Queue Sync with Critical Fields
            await db.syncQueue.add({
                collection: 'inventory',
                docId: item.productId,
                action: 'update',
                data: {
                    productId: item.productId,
                    shopId: shopId,
                    currentStock: newStock,
                    lowStockThreshold: item.lowStockThreshold || 5,
                    lastUpdated: Date.now()
                },
                timestamp: Date.now(),
                shopId: shopId
            });

            toast.success("Stock Updated!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to restock");
        }
    };

    // Staff Logic
    const fetchStaff = async () => {
        if (!shopId) return;
        setIsLoadingStaff(true);
        try {
            const usersRef = collection(firestoreDb, "users");
            const q = query(usersRef, where("shopId", "==", shopId));
            const snapshot = await getDocs(q);
            const users = snapshot.docs.map(d => ({ ...d.data(), id: d.id, type: 'user' }));

            const invitesRef = collection(firestoreDb, "invites");
            const qInvite = query(invitesRef, where("shopId", "==", shopId));
            const snapshotInvite = await getDocs(qInvite);
            const invites = snapshotInvite.docs.map(d => ({ ...d.data(), id: d.id, type: 'invite' }));

            setStaffList([...users, ...invites]);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load staff");
        } finally {
            setIsLoadingStaff(false);
        }
    };

    const handleInviteUser = async () => {
        if (!inviteForm.email || !inviteForm.name) {
            toast.error("Name and Email required");
            return;
        }
        try {
            const inviteRef = doc(firestoreDb, "invites", inviteForm.email);
            await setDoc(inviteRef, {
                email: inviteForm.email,
                name: inviteForm.name,
                role: inviteForm.role,
                shopId: shopId,
                createdAt: Date.now(),
                status: 'pending'
            });
            toast.success("User Invited!");
            setInviteForm({ name: "", email: "", role: "shop-user" });
            fetchStaff();
        } catch (error) {
            console.error(error);
            toast.error("Invite failed");
        }
    };

    const handleRemoveAccess = async (item: any) => {
        if (!confirm("Are you sure? This will remove access.")) return;
        try {
            if (item.type === 'invite') {
                await deleteDoc(doc(firestoreDb, "invites", item.id));
            } else {
                await setDoc(doc(firestoreDb, "users", item.id), { ...item, shopId: null, role: 'user' }, { merge: true });
            }
            toast.success("Access Removed");
            fetchStaff();
        } catch (e) { toast.error("Failed"); }
    };

    return (
        <div className="space-y-6 container mx-auto p-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <LayoutTemplate className="w-8 h-8 text-primary" /> Shop Admin
                    </h1>
                    <p className="text-base-content/60">Overview, Alerts & Financial Health</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-primary btn-outline gap-2" onClick={() => { setIsStaffModalOpen(true); fetchStaff(); }}>
                        <Users className="w-4 h-4" /> Manage Staff
                    </button>
                    <div className="text-sm badge badge-ghost p-3 font-mono">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stats shadow-lg bg-gradient-to-br from-primary to-primary-focus text-primary-content">
                    <div className="stat">
                        <div className="stat-title text-primary-content/80">Total Revenue</div>
                        <div className="stat-value text-3xl">₹{totalRevenue.toLocaleString('en-IN')}</div>
                        <div className="stat-desc text-primary-content/70 flex items-center gap-1">
                            <ArrowUpRight className="w-4 h-4" /> {totalBills} Orders
                        </div>
                    </div>
                </div>

                <div className="stats shadow-lg border border-base-200">
                    <div className="stat">
                        <div className="stat-figure text-success">
                            <TrendingUp className="w-8 h-8" />
                        </div>
                        <div className="stat-title">Net Profit</div>
                        <div className={`stat-value text-3xl ${netProfit > 0 ? 'text-success' : 'text-error'}`}>
                            ₹{netProfit.toLocaleString('en-IN')}
                        </div>
                        <div className="stat-desc">After Expenses</div>
                    </div>
                </div>

                <div className={`stats shadow-lg border border-base-200 ${lowStockItems.length > 0 ? 'bg-error/5 border-error/20' : ''}`}>
                    <div className="stat">
                        <div className={`stat-figure ${lowStockItems.length > 0 ? 'text-error' : 'text-success'}`}>
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <div className="stat-title">Low Stock Alert</div>
                        <div className={`stat-value text-3xl ${lowStockItems.length > 0 ? 'text-error' : 'text-success'}`}>
                            {lowStockItems.length}
                        </div>
                        <div className="stat-desc">{lowStockItems.length > 0 ? 'Items need restock' : 'Inventory Healthy'}</div>
                    </div>
                </div>

                <div className="stats shadow-lg border border-base-200">
                    <div className="stat">
                        <div className="stat-figure text-secondary">
                            <Users className="w-8 h-8" />
                        </div>
                        <div className="stat-title">Loyal Customers</div>
                        <div className="stat-value text-3xl">{topCustomers.filter(c => c.count > 2).length}</div>
                        <div className="stat-desc">More than 2 visits</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Low Stock */}
                    {lowStockItems.length > 0 && (
                        <div className="card bg-base-100 shadow-xl border border-error/20">
                            <div className="card-body p-4">
                                <h2 className="card-title text-error text-lg flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" /> Critical Low Stock
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Item Name</th>
                                                <th>Stock</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lowStockItems.slice(0, 5).map((item, i) => (
                                                <tr key={i}>
                                                    <td className="font-medium">{item.name}</td>
                                                    <td className="text-error font-bold">{item.currentStock} {item.unit}</td>
                                                    <td><button className="btn btn-xs btn-outline btn-error" onClick={() => handleRestock(item)}>Restock</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Expenses */}
                    <div className="card bg-base-100 shadow-xl border border-base-200">
                        <div className="card-body p-0">
                            <div className="p-4 border-b border-base-200 flex justify-between items-center">
                                <h2 className="card-title text-lg">Recent Expenses</h2>
                                <button className="btn btn-sm btn-ghost gap-2" onClick={() => setIsExpenseModalOpen(true)}>
                                    <Plus className="w-4 h-4" /> Add New
                                </button>
                            </div>
                            <div className="overflow-x-auto max-h-[300px]">
                                <table className="table">
                                    <tbody>
                                        {expenses?.length === 0 && <tr><td className="text-center opacity-50 p-4">No expenses</td></tr>}
                                        {expenses?.map(exp => (
                                            <tr key={exp.id} className="hover:bg-base-200/50">
                                                <td className="opacity-70 text-xs">{new Date(exp.date).toLocaleDateString()}</td>
                                                <td className="font-medium">{exp.title}</td>
                                                <td><span className="badge badge-sm badge-ghost">{exp.category}</span></td>
                                                <td className="text-error font-bold">-₹{exp.amount}</td>
                                                <td>
                                                    <button onClick={() => handleDeleteExpense(exp.id)} className="btn btn-xs btn-ghost text-error">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Top Customers */}
                    <div className="card bg-base-100 shadow-xl border border-base-200">
                        <div className="card-body p-4">
                            <h2 className="card-title text-base flex items-center gap-2 mb-4">
                                <Star className="w-4 h-4 text-warning fill-warning" /> Top Spenders
                            </h2>
                            <div className="space-y-4">
                                {topCustomers.map((c, i) => (
                                    <div key={c.id} className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="avatar placeholder">
                                                <div className="bg-neutral text-neutral-content rounded-full w-8">
                                                    <span className="text-xs">{i + 1}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{c.name}</div>
                                                <div className="text-xs opacity-50">{c.count} Visits</div>
                                            </div>
                                        </div>
                                        <div className="font-bold text-success">₹{c.totalSpent.toLocaleString()}</div>
                                    </div>
                                ))}
                                {topCustomers.length === 0 && <div className="text-center opacity-50 text-sm">No data yet</div>}
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="card bg-base-100 shadow-xl border border-base-200">
                        <div className="card-body p-4">
                            <h2 className="card-title text-sm opacity-60 uppercase mb-2">Breakdown</h2>
                            <div className="flex justify-between text-sm mb-1">
                                <span>Exp / Rev Ratio</span>
                                <span className="font-bold">{totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : 0}%</span>
                            </div>
                            <progress className="progress progress-warning w-full" value={totalExpenses} max={totalRevenue || 100}></progress>

                            <div className="divider my-2"></div>

                            <div className="flex justify-between items-center">
                                <div className="text-sm">Stock Value</div>
                                <div className="font-bold">₹{stockValue.toLocaleString()}</div>
                            </div>

                            <div className="divider my-2"></div>

                            <div className="flex justify-between items-center">
                                <div className="text-sm">Total Expenses</div>
                                <div className="font-bold text-error">-₹{totalExpenses.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            {/* Add Expense Modal */}
            {
                isExpenseModalOpen && (
                    <dialog className="modal modal-open">
                        <div className="modal-box p-6 rounded-2xl">
                            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setIsExpenseModalOpen(false)}>✕</button>
                            <h3 className="font-bold text-xl mb-4">Add New Expense</h3>
                            <div className="space-y-4">
                                <div className="form-control">
                                    <label className="label font-medium opacity-70">Title</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Shop Rent"
                                        className="input input-bordered w-full"
                                        value={expenseForm.title}
                                        onChange={e => setExpenseForm({ ...expenseForm, title: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="form-control">
                                        <label className="label font-medium opacity-70">Amount (₹)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            className="input input-bordered w-full"
                                            value={expenseForm.amount}
                                            onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-control">
                                        <label className="label font-medium opacity-70">Category</label>
                                        <select
                                            className="select select-bordered w-full"
                                            value={expenseForm.category}
                                            onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                                        >
                                            <option>Rent</option>
                                            <option>Salaries</option>
                                            <option>Utilities</option>
                                            <option>Other</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-action mt-8">
                                <button className="btn btn-ghost" onClick={() => setIsExpenseModalOpen(false)}>Cancel</button>
                                <button className="btn btn-primary px-8" onClick={handleAddExpense}>Save Expense</button>
                            </div>
                        </div>
                    </dialog>
                )
            }

            {/* Staff Modal */}
            {
                isStaffModalOpen && (
                    <dialog className="modal modal-open">
                        <div className="modal-box w-11/12 max-w-3xl rounded-2xl p-6">
                            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setIsStaffModalOpen(false)}>✕</button>
                            <h3 className="font-bold text-2xl mb-1 flex items-center gap-2">
                                <Users className="w-6 h-6 text-primary" /> Staff Management
                            </h3>
                            <p className="text-base-content/60 text-sm mb-6">Manage access to your shop dashboard</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-1 bg-base-50 p-4 rounded-xl h-fit">
                                    <h4 className="font-bold mb-4 text-sm uppercase opacity-50">Invite New User</h4>
                                    <div className="space-y-3">
                                        <input
                                            className="input input-bordered w-full input-sm"
                                            placeholder="Name"
                                            value={inviteForm.name}
                                            onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                                        />
                                        <input
                                            className="input input-bordered w-full input-sm"
                                            placeholder="Email Address"
                                            type="email"
                                            value={inviteForm.email}
                                            onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                                        />
                                        <select
                                            className="select select-bordered w-full select-sm"
                                            value={inviteForm.role}
                                            onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                                        >
                                            <option value="shop-user">Shop Staff (POS Only)</option>
                                            <option value="shop-admin">Manager (Full Access)</option>
                                        </select>
                                        <button
                                            className="btn btn-primary w-full btn-sm"
                                            onClick={handleInviteUser}
                                        >
                                            Send Invite
                                        </button>
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <h4 className="font-bold mb-4 text-sm uppercase opacity-50">Current Staff & Invites</h4>
                                    {isLoadingStaff ? (
                                        <div className="flex justify-center py-8"><span className="loading loading-spinner"></span></div>
                                    ) : (
                                        <div className="overflow-x-auto border border-base-200 rounded-lg">
                                            <table className="table table-sm">
                                                <thead className="bg-base-100">
                                                    <tr>
                                                        <th>Name/Email</th>
                                                        <th>Role</th>
                                                        <th>Status</th>
                                                        <th>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {staffList.length === 0 ? (
                                                        <tr><td colSpan={4} className="text-center opacity-50 py-4">No staff found</td></tr>
                                                    ) : (
                                                        staffList.map((staff, idx) => (
                                                            <tr key={idx} className="hover:bg-base-50">
                                                                <td>
                                                                    <div className="font-bold text-xs">{staff.name}</div>
                                                                    <div className="text-[10px] opacity-50">{staff.email}</div>
                                                                </td>
                                                                <td>
                                                                    <span className="badge badge-xs badge-ghost">{staff.role}</span>
                                                                </td>
                                                                <td>
                                                                    {staff.type === 'invite' ? (
                                                                        <span className="badge badge-xs badge-warning badge-outline">Pending</span>
                                                                    ) : (
                                                                        <span className="badge badge-xs badge-success badge-outline">Active</span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <button
                                                                        className="btn btn-xs btn-square btn-ghost text-error"
                                                                        title="Remove Access"
                                                                        onClick={() => handleRemoveAccess(staff)}
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </dialog>
                )
            }
        </div >
    );
}
