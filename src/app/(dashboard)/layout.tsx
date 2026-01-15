"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
    Loader2, Wifi, WifiOff, RefreshCw, ShoppingCart, Package, Users, BarChart3, CreditCard,
    LayoutDashboard, FileText, Settings, Percent, LogOut, Menu, X, LayoutTemplate, Shield
} from "lucide-react";
import { db } from "@/lib/db/db";
import { useSync } from "@/hooks/useSync";
import Link from "next/link";
import { toast } from "react-hot-toast";
import Image from "next/image";
import { auth } from "@/lib/firebase/config";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, isTrialExpired, userData } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { isSyncing, online, pendingCount } = useSync();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) return null;

    if (isTrialExpired) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base-200">
                <div className="card w-96 bg-base-100 shadow-xl">
                    <div className="card-body text-center">
                        <h2 className="card-title justify-center text-error">Trial Expired</h2>
                        <p>Your 14-day free trial has ended.</p>
                        <p className="text-sm opacity-70 mt-2">Please contact the admin to approve your account for permanent access.</p>
                        <div className="card-actions justify-center mt-4">
                            <button className="btn btn-primary" onClick={() => router.push('/logout')}>Logout</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const navLinks = [
        { name: 'POS', href: '/dashboard', icon: LayoutDashboard, roles: ['shop-admin', 'shop-user', 'superadmin', 'user'] },
        { name: 'Orders', href: '/orders', icon: ShoppingCart, roles: ['shop-admin', 'shop-user', 'superadmin', 'user'] },
        { name: 'Kadan', href: '/khata', icon: CreditCard, roles: ['shop-admin', 'shop-user', 'superadmin', 'user'] },
        { name: 'Inventory', href: '/inventory', icon: Package, roles: ['shop-admin', 'shop-user', 'superadmin', 'user'] },
        { name: 'Customers', href: '/customers', icon: Users, roles: ['shop-admin', 'shop-user', 'superadmin', 'user'] },
        { name: 'Shop Admin', href: '/finance', icon: LayoutTemplate, roles: ['shop-admin', 'superadmin', 'user'] },
        { name: 'Settings', href: '/settings', icon: Settings, roles: ['shop-admin', 'shop-user', 'superadmin', 'user'] },
        { name: 'Super Admin', href: '/admin', icon: Shield, roles: ['superadmin'] }, // Added superadmin link
    ];

    const currentRole = userData?.role || 'user';
    const filteredLinks = navLinks.filter(link =>
        userData?.role && (link.roles.includes(userData.role) || userData.role === 'superadmin')
    );

    const handleLogout = async () => {
        try {
            await auth.signOut();
            await db.delete(); // Clear local DB to prevent data leakage on shared devices

            // Re-open DB to allow future logins (db.delete closes it)
            await db.open();

            toast.success("Signed out successfully");
            router.push('/login');
            // Force reload to ensure clean state
            setTimeout(() => window.location.reload(), 500);
        } catch (error) {
            console.error("Logout error:", error);
            toast.error("Failed to sign out");
        }
    };

    return (
        <div className="min-h-screen bg-base-200 font-sans text-base-content selection:bg-primary selection:text-primary-content">
            {/* Desktop Sidebar */}
            <aside className="fixed top-0 left-0 z-40 w-64 h-screen transition-transform -translate-x-full lg:translate-x-0 bg-base-100/80 backdrop-blur-md border-r border-base-200 shadow-xl">
                <div className="flex flex-col h-full">
                    {/* Brand Logo */}
                    <div className="h-32 flex items-center justify-center border-b border-base-200/50 bg-base-100">
                        <Link href="/dashboard" className="flex flex-col items-center">
                            <div className="relative w-56 h-24">
                                <Image
                                    src="/logo.png"
                                    alt="Pettikadai POS"
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </div>
                        </Link>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                        {filteredLinks.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive
                                        ? 'bg-black text-white shadow-none font-bold'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-black'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 mr-3 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                    <span className="relative z-10">{link.name}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User Profile & Logout */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-3 mb-4 px-2">
                            <div className="avatar placeholder">
                                <div className="bg-black text-white rounded-full w-10 ring-2 ring-white shadow-sm">
                                    <span className="text-sm font-bold">{userData?.name?.[0] || 'U'}</span>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate text-black">{userData?.name || 'User'}</p>
                                <p className="text-xs text-gray-500 truncate capitalize">{userData?.role?.replace('-', ' ') || 'Staff'}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="btn btn-outline btn-sm w-full gap-2 hover:bg-black hover:text-white border-gray-300 text-gray-700 hover:border-black"
                        >
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden sticky top-0 z-30 bg-base-100/90 backdrop-blur-md border-b border-base-200 px-4 h-20 flex items-center justify-between shadow-sm">
                <div className="relative w-32 h-12">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        fill
                        className="object-contain"
                    />
                </div>
                {/* Mobile allows easier access, but usually the bottom nav is enough.
                    Header gives space for status or other actions if needed.
                */}
            </div>


            {/* Main Content */}
            <div className={`p-4 lg:ml-64 min-h-screen transition-all duration-300 pb-24 md:pb-6`}>
                <div className="container mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 z-50 w-full bg-base-100/90 backdrop-blur-xl border-t border-base-200 pb-safe pt-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="flex justify-around items-center h-16 px-1">
                    {filteredLinks.slice(0, 5).map((link) => { // Show max 5 items on mobile
                        const Icon = link.icon;
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${isActive ? 'text-primary' : 'text-base-content/50 hover:text-base-content/80'
                                    }`}
                            >
                                <div className={`p-1.5 rounded-full transition-all duration-300 ${isActive ? 'bg-primary/10 shadow-inner' : ''}`}>
                                    <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                                </div>
                                <span className={`text-[10px] font-medium transition-all ${isActive ? 'scale-105' : 'scale-100'}`}>
                                    {link.name}
                                </span>
                                {isActive && (
                                    <span className="absolute top-0 w-8 h-1 bg-primary rounded-b-full shadow-[0_0_8px_rgba(var(--p),0.6)]" />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
