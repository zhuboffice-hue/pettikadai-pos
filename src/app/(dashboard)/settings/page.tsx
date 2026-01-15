"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Save, Printer, Monitor, Bell, Store } from "lucide-react";

export default function SettingsPage() {
    const { userData } = useAuth();
    const [settings, setSettings] = useState({
        theme: 'light',
        notifications: true,
        autoPrint: false,
        shopName: userData?.shopId || '', // Placeholder
        address: ''
    });

    const isShopAdmin = userData?.role === 'shop-admin';

    const handleSave = () => {
        // Here we would save to localStorage or Firestore 'settings' collection
        toast.success("Settings saved successfully!");
    };

    return (
        <div className="container mx-auto max-w-4xl p-6">
            <h1 className="text-3xl font-bold mb-8">Settings</h1>

            <div className="grid gap-6">
                {/* General Settings */}
                <div className="card bg-base-100 shadow border border-base-200">
                    <div className="card-body">
                        <h2 className="card-title flex items-center gap-2">
                            <Monitor className="w-5 h-5" /> App Preferences
                        </h2>

                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text">Dark Mode</span>
                                <input type="checkbox" className="toggle" disabled checked={false} /> {/* Forced light for now */}
                            </label>
                            <span className="text-xs opacity-50 px-1">Theme is currently locked to Light.</span>
                        </div>

                        <div className="form-control">
                            <label className="label cursor-pointer">
                                <span className="label-text">Enable Sound Effects</span>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-primary"
                                    checked={settings.notifications}
                                    onChange={e => setSettings({ ...settings, notifications: e.target.checked })}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Shop Settings (Admin Only) */}
                {isShopAdmin && (
                    <div className="card bg-base-100 shadow border border-base-200">
                        <div className="card-body">
                            <h2 className="card-title flex items-center gap-2">
                                <Store className="w-5 h-5" /> Shop Configuration
                            </h2>
                            <div className="form-control">
                                <label className="label">Display Name</label>
                                <input
                                    type="text"
                                    className="input input-bordered"
                                    placeholder="Enter Shop Name"
                                    value={settings.shopName}
                                    onChange={e => setSettings({ ...settings, shopName: e.target.value })}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">Print Receipt Header</label>
                                <textarea
                                    className="textarea textarea-bordered"
                                    placeholder="Address / Phone to show on bills"
                                    value={settings.address}
                                    onChange={e => setSettings({ ...settings, address: e.target.value })}
                                ></textarea>
                            </div>
                            <div className="form-control">
                                <label className="label cursor-pointer">
                                    <span className="label-text">Auto-Print after Billing</span>
                                    <input
                                        type="checkbox"
                                        className="toggle toggle-success"
                                        checked={settings.autoPrint}
                                        onChange={e => setSettings({ ...settings, autoPrint: e.target.checked })}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <button className="btn btn-primary gap-2" onClick={handleSave}>
                        <Save className="w-4 h-4" /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
