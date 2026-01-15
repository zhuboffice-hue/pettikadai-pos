"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db as firestore } from '@/lib/firebase/config';
import { toast } from "react-hot-toast";
import { Loader2, Plus, Trash2, UserCog } from "lucide-react";

interface TeamMember {
    id: string; // email or uid
    name: string;
    email: string;
    role: string;
    status: 'active' | 'invited';
}

export default function TeamPage() {
    const { userData } = useAuth();
    const shopId = userData?.shopId;

    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [inviteData, setInviteData] = useState({ name: "", email: "" });
    const [inviteLoading, setInviteLoading] = useState(false);

    useEffect(() => {
        if (!shopId) return;
        fetchTeam();
    }, [shopId]);

    const fetchTeam = async () => {
        if (!shopId) return;
        setLoading(true);
        try {
            const team: TeamMember[] = [];

            // 1. Get Active Users
            const usersRef = collection(firestore, "users");
            const qUsers = query(usersRef, where("shopId", "==", shopId));
            const userSnaps = await getDocs(qUsers);

            userSnaps.forEach(doc => {
                const d = doc.data();
                team.push({
                    id: doc.id,
                    name: d.name,
                    email: d.email,
                    role: d.role,
                    status: 'active'
                });
            });

            // 2. Get Pending Invites
            // Note: firestore.rules must allow querying invites by shopId (requires composite index usually, or client side filter if small)
            // Actually our previous rule `allow read: if ... isShopAdmin(resource.data.shopId)` works for get() but list() might need index.
            // For now, let's just query all invites and filter client side? No, better to try specific query.
            // Wait, standard Firestore rules don't filter list results automatically. We need a query that matches the rule.
            // `where("shopId", "==", shopId)`
            const invitesRef = collection(firestore, "invites");
            const qInvites = query(invitesRef, where("shopId", "==", shopId));
            const inviteSnaps = await getDocs(qInvites);

            inviteSnaps.forEach(doc => {
                const d = doc.data();
                // Avoid duplicates if user already accepted (should be deleted, but just in case)
                if (!team.some(m => m.email === d.email)) {
                    team.push({
                        id: doc.id, // email is ID
                        name: d.name,
                        email: doc.id,
                        role: d.role,
                        status: 'invited'
                    });
                }
            });

            setMembers(team);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load team");
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shopId) return;
        setInviteLoading(true);

        try {
            await setDoc(doc(firestore, "invites", inviteData.email), {
                shopId: shopId,
                role: 'shop-user',
                name: inviteData.name,
                shopName: userData?.shopName || "Our Shop", // Assuming userData has shopName or we fetch it
                createdAt: Date.now(),
                invitedBy: userData?.email
            });

            toast.success(`Invite sent to ${inviteData.email}`);
            setInviteData({ name: "", email: "" });
            setIsModalOpen(false);
            fetchTeam();
        } catch (error) {
            console.error(error);
            toast.error("Failed to send invite");
        } finally {
            setInviteLoading(false);
        }
    };

    const handleCancelInvite = async (email: string) => {
        if (!confirm(`Cancel invite for ${email}?`)) return;
        try {
            await deleteDoc(doc(firestore, "invites", email));
            toast.success("Invite cancelled");
            fetchTeam();
        } catch (error) {
            toast.error("Failed to cancel");
        }
    };

    if (userData?.role !== 'shop-admin') {
        // Fallback protection
        return <div className="p-10 text-error">Only Shop Admins can manage team.</div>
    }

    return (
        <div className="container mx-auto max-w-5xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><UserCog /> Team Management</h1>
                    <p className="opacity-70 text-sm">Manage access to your shop</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Staff
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {members.map(member => (
                        <div key={member.id} className="card bg-base-100 shadow border border-base-200">
                            <div className="card-body">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold">{member.name}</h3>
                                        <p className="text-sm opacity-70">{member.email}</p>
                                    </div>
                                    <div className={`badge ${member.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                                        {member.status}
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-between items-center">
                                    <span className="text-xs uppercase font-bold text-gray-400">{member.role}</span>
                                    {member.status === 'invited' && (
                                        <button
                                            onClick={() => handleCancelInvite(member.email)}
                                            className="btn btn-xs btn-ghost text-error"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {members.length === 0 && (
                        <div className="col-span-full text-center py-10 opacity-50">
                            No team members yet. Add your first staff!
                        </div>
                    )}
                </div>
            )}

            {/* Invite Modal */}
            {isModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">Add Staff Member</h3>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div className="form-control">
                                <label className="label">Staff Name</label>
                                <input
                                    required
                                    className="input input-bordered"
                                    value={inviteData.name}
                                    onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">Gmail Address</label>
                                <input
                                    required
                                    type="email"
                                    placeholder="staff@gmail.com"
                                    className="input input-bordered"
                                    value={inviteData.email}
                                    onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                                />
                                <label className="label">
                                    <span className="label-text-alt text-warning">They must log in with this Google account.</span>
                                </label>
                            </div>
                            <div className="modal-action">
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                                    {inviteLoading ? <Loader2 className="animate-spin" /> : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
