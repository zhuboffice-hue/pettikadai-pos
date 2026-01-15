"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import { collection, doc, setDoc, getDocs, orderBy, query, where, limit } from 'firebase/firestore';
import { db as firestore } from '@/lib/firebase/config';
import { toast } from "react-hot-toast";
import { Loader2, Plus, Store, Eye, Download, Mail, FileText } from "lucide-react";
import jsPDF from 'jspdf';

interface Shop {
    id: string;
    name: string;
    ownerEmail: string;
    status: string;
    createdAt?: number;
}

export default function SuperAdminPage() {
    const { userData } = useAuth();
    const [shops, setShops] = useState<Shop[]>([]);
    const [fetching, setFetching] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [usageModalOpen, setUsageModalOpen] = useState(false);
    const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
    const [usageLoading, setUsageLoading] = useState(false);
    const [shopUsage, setShopUsage] = useState<any>({ billCount: 0, revenue: 0, productCount: 0, recentBills: [] });

    const [formData, setFormData] = useState({
        shopName: "",
        ownerName: "",
        ownerEmail: ""
    });

    const [monthlyStats, setMonthlyStats] = useState<any[]>([]);

    const openUsageModal = async (shop: Shop) => {
        setSelectedShop(shop);
        setUsageModalOpen(true);
        setUsageLoading(true);
        try {
            // 1. Fetch Bills count and total revenue (limit increased for demo)
            const billsQ = query(collection(firestore, "bills"), where("shopId", "==", shop.id), limit(500));
            const billsSnap = await getDocs(billsQ);

            let revenue = 0;
            const recentBills: any[] = [];
            const monthlyData: { [key: string]: { count: number, revenue: number } } = {};

            billsSnap.forEach(doc => {
                const d = doc.data();
                const amount = d.totalAmount || 0;
                revenue += amount;

                if (recentBills.length < 10) {
                    recentBills.push({ id: doc.id, ...d });
                }

                // Monthly Aggregation
                if (d.createdAt) {
                    const date = new Date(d.createdAt);
                    const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });

                    if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = { count: 0, revenue: 0 };
                    }
                    monthlyData[monthKey].count++;
                    monthlyData[monthKey].revenue += amount;
                }
            });

            // Convert to array
            const statsArray = Object.keys(monthlyData).map(key => ({
                month: key,
                ...monthlyData[key]
            }));
            setMonthlyStats(statsArray);

            // 2. Fetch Products count (approximation)
            const productsQ = query(collection(firestore, "products"), where("shopId", "==", shop.id));
            const productsSnap = await getDocs(productsQ);

            setShopUsage({
                billCount: billsSnap.size,
                revenue: revenue,
                productCount: productsSnap.size,
                recentBills: recentBills
            });
        } catch (e) {
            console.error(e);
            toast.error("Failed to load usage");
        } finally {
            setUsageLoading(false);
        }
    };

    const handleDownloadReport = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Month,Bill Count,Revenue\n"
            + monthlyStats.map(row => `${row.month},${row.count},${row.revenue}`).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `usage_report_${selectedShop?.name}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    const handleSendReport = () => {
        if (!selectedShop?.ownerEmail) return;

        try {
            // 1. Generate PDF Report
            const pdf = new jsPDF();

            // Header
            pdf.setFontSize(18);
            pdf.text(`Usage Report: ${selectedShop.name}`, 14, 20);

            pdf.setFontSize(11);
            pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

            // Metrics
            pdf.setFontSize(14);
            pdf.text("Current Metrics", 14, 40);

            pdf.setFontSize(11);
            pdf.text(`Total Bills: ${shopUsage.billCount}`, 14, 50);
            pdf.text(`Total Products: ${shopUsage.productCount}`, 14, 56);
            pdf.text(`Usage Score: ${(shopUsage.billCount * 5) + (shopUsage.productCount)}`, 14, 62);

            // Table Header
            pdf.setFontSize(14);
            pdf.text("Monthly Breakdown", 14, 75);

            let y = 85;
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "bold");
            pdf.text("Month", 14, y);
            pdf.text("Bills", 60, y);
            pdf.text("Score", 100, y);
            pdf.text("Status", 140, y);

            pdf.line(14, y + 2, 180, y + 2);
            y += 8;

            pdf.setFont("helvetica", "normal");

            monthlyStats.forEach(stat => {
                const score = stat.count * 5;
                const status = score > 5000 ? "Needs Blaze" : "Spark OK";

                pdf.text(stat.month, 14, y);
                pdf.text(stat.count.toString(), 60, y);
                pdf.text(score.toString(), 100, y);
                pdf.text(status, 140, y);

                y += 7;
            });

            pdf.save(`Usage_Report_${selectedShop.name}.pdf`);
            toast.success("Report downloaded! Please attach it to the email.", { duration: 5000, icon: '📎' });

        } catch (error) {
            console.error("PDF Generation failed", error);
            toast.error("Failed to generate PDF");
        }

        // 2. Open Gmail
        const subject = `Usage Report for ${selectedShop.name}`;
        const body = `Hello ${selectedShop.name},\n\nHere is your usage report:\n\n` +
            monthlyStats.map(row => `${row.month}: ${row.count} Bills, Usage Score: ${row.count * 5}`).join("\n");

        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);

        // Open Gmail compose in a new tab
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${selectedShop.ownerEmail}&su=${encodedSubject}&body=${encodedBody}`;
        window.open(gmailUrl, '_blank');
    };

    useEffect(() => {
        if (userData?.role === 'superadmin') {
            fetchShops();
        }
    }, [userData]);

    const fetchShops = async () => {
        setFetching(true);
        try {
            const q = query(collection(firestore, "shops"));
            const snapshot = await getDocs(q);
            const shopList: Shop[] = [];
            snapshot.forEach(doc => {
                shopList.push({ id: doc.id, ...doc.data() } as Shop);
            });
            setShops(shopList);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load shops");
        } finally {
            setFetching(false);
        }
    };

    if (userData?.role !== 'superadmin') {
        return <div className="p-10 text-error">Access Denied</div>;
    }

    const handleInviteShop = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const newShopId = `shop_${uuidv4()}`;

            await setDoc(doc(firestore, "invites", formData.ownerEmail), {
                shopId: newShopId,
                role: 'shop-admin',
                name: formData.ownerName,
                shopName: formData.shopName,
                createdAt: Date.now(),
                invitedBy: userData.email
            });

            await setDoc(doc(firestore, "shops", newShopId), {
                name: formData.shopName,
                ownerEmail: formData.ownerEmail,
                createdAt: Date.now(),
                status: 'active'
            });

            toast.success(`Invite sent to ${formData.ownerEmail}`);
            setIsModalOpen(false);
            setFormData({ shopName: "", ownerName: "", ownerEmail: "" });
            fetchShops();

        } catch (error) {
            console.error(error);
            toast.error("Failed to create invite");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Shop
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card bg-primary text-primary-content shadow-xl">
                    <div className="card-body">
                        <div className="flex items-center gap-4">
                            <Store className="w-8 h-8" />
                            <div>
                                <h2 className="card-title">Total Shops</h2>
                                <p className="text-4xl font-bold">{shops.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card bg-secondary text-secondary-content shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title">Active Users</h2>
                        <p className="text-4xl font-bold">-</p>
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Manage Shops</h2>
                <div className="overflow-x-auto bg-base-100 rounded-box shadow border border-base-200">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Shop Name</th>
                                <th>Owner Email</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fetching ? (
                                <tr><td colSpan={4} className="text-center p-4"><Loader2 className="animate-spin inline" /> Loading...</td></tr>
                            ) : shops.length === 0 ? (
                                <tr><td colSpan={4} className="text-center p-4 opacity-50">No shops found</td></tr>
                            ) : (
                                shops.map(shop => (
                                    <tr key={shop.id}>
                                        <td className="font-bold">{shop.name}</td>
                                        <td>{shop.ownerEmail}</td>
                                        <td><span className="badge badge-success capitalize">{shop.status}</span></td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button className="btn btn-xs btn-outline" onClick={() => toast(`Shop ID: ${shop.id}`)}>
                                                    <Eye className="w-3 h-3 mr-1" /> Details
                                                </button>
                                                <button className="btn btn-xs btn-primary" onClick={() => openUsageModal(shop)}>
                                                    <FileText className="w-3 h-3 mr-1" /> Usage
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Shop Modal */}
            {isModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">Add New Shop</h3>
                        <form onSubmit={handleInviteShop} className="flex flex-col gap-4">
                            <div className="form-control">
                                <label className="label">Shop Name</label>
                                <input
                                    required
                                    className="input input-bordered"
                                    value={formData.shopName}
                                    onChange={e => setFormData({ ...formData, shopName: e.target.value })}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">Owner Name</label>
                                <input
                                    required
                                    className="input input-bordered"
                                    value={formData.ownerName}
                                    onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">Owner Gmail</label>
                                <input
                                    required
                                    type="email"
                                    className="input input-bordered"
                                    placeholder="user@gmail.com"
                                    value={formData.ownerEmail}
                                    onChange={e => setFormData({ ...formData, ownerEmail: e.target.value })}
                                />
                            </div>
                            <div className="modal-action">
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? <Loader2 className="animate-spin" /> : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Usage Details Modal */}
            {usageModalOpen && selectedShop && (
                <div className="modal modal-open">
                    <div className="modal-box w-11/12 max-w-4xl">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="font-bold text-2xl">{selectedShop.name} Usage</h3>
                                <p className="text-sm opacity-70">Usage Metrics for Billing Upgrade</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="btn btn-sm btn-outline gap-2" onClick={handleDownloadReport}>
                                    <Download className="w-4 h-4" /> CSV
                                </button>
                                <button className="btn btn-sm btn-primary gap-2" onClick={handleSendReport}>
                                    <Mail className="w-4 h-4" /> Email Owner
                                </button>
                            </div>
                        </div>

                        {usageLoading ? (
                            <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
                        ) : (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="stats shadow bg-base-100 border">
                                        <div className="stat">
                                            <div className="stat-figure text-primary">
                                                <FileText className="w-8 h-8" />
                                            </div>
                                            <div className="stat-title">Total Bills</div>
                                            <div className="stat-value text-primary">{shopUsage.billCount}</div>
                                            <div className="stat-desc">Lifetime Writes</div>
                                        </div>
                                    </div>
                                    <div className="stats shadow bg-base-100 border">
                                        <div className="stat">
                                            <div className="stat-figure text-secondary">
                                                <div className="text-2xl font-bold">🔥</div>
                                            </div>
                                            <div className="stat-title">Usage Score</div>
                                            <div className="stat-value text-secondary">
                                                {/* Simple usage score: Bills * 5 + Products * 1 */}
                                                {(shopUsage.billCount * 5) + (shopUsage.productCount)}
                                            </div>
                                            <div className="stat-desc">Est. Firebase Ops</div>
                                        </div>
                                    </div>
                                    <div className="stats shadow bg-base-100 border">
                                        <div className="stat">
                                            <div className="stat-figure text-accent">
                                                <Store className="w-8 h-8" />
                                            </div>
                                            <div className="stat-title">Products</div>
                                            <div className="stat-value">{shopUsage.productCount}</div>
                                            <div className="stat-desc">In Inventory</div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold mb-3 text-lg">Monthly Breakdown</h4>
                                    <div className="overflow-x-auto bg-base-100 rounded-lg border">
                                        <table className="table">
                                            <thead className="bg-base-200">
                                                <tr>
                                                    <th>Month</th>
                                                    <th>Bill Count</th>
                                                    <th>Usage Score</th>
                                                    <th>Upgrade Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {monthlyStats.length === 0 ? (
                                                    <tr><td colSpan={4} className="text-center opacity-50">No data available</td></tr>
                                                ) : (
                                                    monthlyStats.map((stat, idx) => {
                                                        const usageScore = (stat.count * 5); // Monthly usage approximation
                                                        return (
                                                            <tr key={idx}>
                                                                <td className="font-bold">{stat.month}</td>
                                                                <td>{stat.count}</td>
                                                                <td>{usageScore} Ops</td>
                                                                <td>
                                                                    {usageScore > 5000 ? (
                                                                        <span className="badge badge-warning">Needs Blaze</span>
                                                                    ) : (
                                                                        <span className="badge badge-ghost">Spark OK</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="modal-action">
                            <button className="btn" onClick={() => setUsageModalOpen(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
