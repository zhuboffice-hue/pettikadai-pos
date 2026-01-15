"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { User, Mail, Shield, Calendar, Store } from "lucide-react";

export default function ProfilePage() {
    const { userData } = useAuth();

    if (!userData) return null;

    return (
        <div className="container mx-auto max-w-2xl p-6">
            <h1 className="text-3xl font-bold mb-8">My Profile</h1>

            <div className="card bg-base-100 shadow-xl border border-base-200">
                <div className="card-body">
                    <div className="flex flex-col items-center mb-6">
                        <div className="avatar placeholder mb-4">
                            <div className="bg-neutral text-neutral-content rounded-full w-24 text-3xl">
                                <span>{userData.name?.charAt(0)}</span>
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold">{userData.name}</h2>
                        <span className="badge badge-primary">{userData.role}</span>
                    </div>

                    <div className="divider">Details</div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-3 bg-base-200 rounded-lg">
                            <Mail className="w-5 h-5 opacity-70" />
                            <div>
                                <p className="text-xs opacity-70 uppercase">Email</p>
                                <p className="font-medium">{userData.email}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-3 bg-base-200 rounded-lg">
                            <Store className="w-5 h-5 opacity-70" />
                            <div>
                                <p className="text-xs opacity-70 uppercase">Shop ID</p>
                                <p className="font-mono text-sm">{userData.shopId}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-3 bg-base-200 rounded-lg">
                            <Shield className="w-5 h-5 opacity-70" />
                            <div>
                                <p className="text-xs opacity-70 uppercase">Account Status</p>
                                <div className="flex gap-2">
                                    <span className={`badge ${userData.isApproved ? 'badge-success' : 'badge-warning'}`}>
                                        {userData.isApproved ? 'Approved' : 'Pending Approval'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-3 bg-base-200 rounded-lg">
                            <Calendar className="w-5 h-5 opacity-70" />
                            <div>
                                <p className="text-xs opacity-70 uppercase">Joined</p>
                                <p className="font-medium">{userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
