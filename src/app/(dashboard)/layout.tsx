
"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2, Wifi, WifiOff, RefreshCw, ShoppingCart, Package, Users, BarChart3 } from "lucide-react";
import { useSync } from "@/hooks/useSync";
import Link from "next/link";
import { toast } from "react-hot-toast";
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
        { name: 'Billing', href: '/dashboard', icon: ShoppingCart, roles: ['shop-admin', 'shop-user', 'user'] },
        { name: 'Inventory', href: '/inventory', icon: Package, roles: ['shop-admin', 'shop-user', 'user'] },
        { name: 'Kadan', href: '/khata', icon: Users, roles: ['shop-admin', 'shop-user', 'user'] },
        { name: 'Finance', href: '/finance', icon: BarChart3, roles: ['shop-admin', 'user'] },
        { name: 'Team', href: '/team', icon: Users, roles: ['shop-admin'] },
        { name: 'Admin', href: '/admin', icon: BarChart3, roles: ['superadmin'] },
    ];

    const currentRole = userData?.role || 'user';
    const filteredLinks = navLinks.filter(link => link.roles.includes(currentRole));

    return (
        <div className="min-h-screen bg-base-200 pb-20 md:pb-0">
            {/* Navbar */}
            <div className="navbar bg-base-100 shadow-sm sticky top-0 z-50 px-4 print:hidden">
                <div className="flex-1 gap-4">
                    <a className="text-xl font-bold text-primary">Pettikadai POS</a>
                    {/* Desktop Menu */}
                    <div className="hidden md:flex gap-1">
                        {filteredLinks.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                                >
                                    <Icon className="w-4 h-4" /> {link.name}
                                </Link>
                            );
                        })}
                    </div>
                </div>
                <div className="flex-none gap-2">
                    {/* Sync Indicator */}
                    <div className="flex items-center gap-2 mr-2 text-sm font-medium">
                        {isSyncing ? (
                            <span className="flex items-center gap-1 text-warning"><RefreshCw className="animate-spin w-4 h-4" /> Syncing ({pendingCount})</span>
                        ) : !online ? (
                            <span className="flex items-center gap-1 text-error"><WifiOff className="w-4 h-4" /> Offline ({pendingCount})</span>
                        ) : (
                            <span className="hidden sm:flex items-center gap-1 text-success"><Wifi className="w-4 h-4" /> Online</span>
                        )}
                    </div>
                    <div className="dropdown dropdown-end">
                        <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar placeholder">
                            <div className="bg-neutral text-neutral-content rounded-full w-10">
                                <span>{userData?.name?.charAt(0) || user.email?.charAt(0)}</span>
                            </div>
                        </div>
                        <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
                            <li className="menu-title">Role: {userData?.role}</li>
                            <li><button onClick={() => router.push('/profile')}>Profile</button></li>
                            <li><button onClick={() => router.push('/settings')}>Settings</button></li>
                            <li><button onClick={async () => {
                                try {
                                    await auth.signOut();
                                    router.push('/login');
                                } catch (error) {
                                    console.error("Logout failed", error);
                                }
                            }}>Logout</button></li>
                        </ul>
                    </div>
                </div>
            </div>

            <main className="p-2 md:p-6 max-w-[1600px] mx-auto">
                {children}
            </main>

            {/* Bottom Navigation for Mobile */}
            <div className="btm-nav md:hidden z-50 border-t border-base-200 bg-base-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] print:hidden h-16">
                {filteredLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
                    return (
                        <button
                            key={link.name}
                            className={`${isActive ? 'active text-primary bg-primary/5' : 'text-base-content/60'} hover:bg-base-200 transition-colors flex flex-col items-center justify-center gap-1 min-w-0 px-1`}
                            onClick={() => router.push(link.href)}
                        >
                            <Icon className={`h-5 w-5 ${isActive ? 'stroke-2' : ''}`} />
                            <span className="text-[10px] font-medium leading-none w-full text-center truncate">{link.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
