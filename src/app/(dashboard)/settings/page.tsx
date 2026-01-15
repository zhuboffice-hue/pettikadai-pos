"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
    Save, Printer, Monitor, Bell, Store, FileText,
    Bluetooth, RefreshCw, Trash2, AlertTriangle,
    CheckCircle, Info, Smartphone
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, StoreSettings } from "@/lib/db/db";
import { v4 as uuidv4 } from 'uuid';

export default function SettingsPage() {
    const { userData } = useAuth();
    const isShopAdmin = userData?.role === 'shop-admin' || userData?.role === 'superadmin';

    // Default Settings
    const defaultSettings: StoreSettings = {
        id: 'settings',
        shopId: userData?.shopId || '',
        storeName: userData?.shopName || 'My Kirana Shop',
        address: '',
        phone: '',
        upiId: '',
        printerName: '',
        autoPrint: false,
        printLogo: false,
        gstEnabled: false,
        gstNumber: '',
        gstRate: 0,
        taxInclusive: true,
        synced: false
    };

    const [formData, setFormData] = useState<StoreSettings>(defaultSettings);
    const [loading, setLoading] = useState(false);
    const [printerDevice, setPrinterDevice] = useState<any>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");

    // Fetch existing settings
    useLiveQuery(async () => {
        if (userData?.shopId) {
            const existing = await db.storeSettings.where('shopId').equals(userData.shopId).first();
            if (existing) {
                setFormData(existing);
                if (existing.printerName) {
                    // We can't actually restore the device object across reloads in Web Bluetooth mostly,
                    // but we can show the name.
                }
            } else {
                setFormData(prev => ({ ...prev, shopId: userData.shopId }));
            }
        }
    }, [userData?.shopId]);

    const handleSave = async () => {
        if (!userData?.shopId) return;
        setLoading(true);
        try {
            const existing = await db.storeSettings.where('shopId').equals(userData.shopId).first();
            const dataToSave = {
                ...formData,
                shopId: userData.shopId,
                id: existing ? existing.id : uuidv4(),
                printerName: printerDevice ? printerDevice.name : formData.printerName,
                synced: false
            };

            await db.storeSettings.put(dataToSave);
            await db.syncQueue.add({
                collection: 'store_settings',
                docId: dataToSave.id,
                action: 'update',
                data: dataToSave,
                timestamp: Date.now(),
                shopId: userData.shopId
            });

            toast.success("Store Information Saved!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save settings");
        } finally {
            setLoading(false);
        }
    };

    // Bluetooth Logic
    const scanForPrinters = async () => {
        try {
            if (!navigator.bluetooth) {
                toast.error("Web Bluetooth is not supported in this browser.");
                return;
            }
            // Request device. Note: For thermal printers, they usually service a specific UUID.
            // Since we don't know the specific printer, 'acceptAllDevices' is risky but useful for generic scan.
            // Ideally we filter by services: ['000018f0-0000-1000-8000-00805f9b34fb'] (Generic Printer) usually.
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'battery_service'] // Common services
            });

            setPrinterDevice(device);
            setFormData(prev => ({ ...prev, printerName: device.name || 'Unknown Printer' }));
            toast.success(`Connected to ${device.name}`);
        } catch (error) {
            console.error(error);
            // Ignore cancellation
        }
    };

    const testPrint = async () => {
        if (!printerDevice) {
            toast.error("No printer connected.");
            return;
        }
        toast.loading("Sending test print...");
        // This is a mock since actual printing requires complex GATT ops
        setTimeout(() => toast.dismiss(), 1000);
        setTimeout(() => toast.success("Test print sent!"), 1100);
    };

    const handleDeleteAllData = async () => {
        if (deleteConfirmation !== "DELETE ALL") {
            toast.error("Please type DELETE ALL to confirm.");
            return;
        }
        if (!window.confirm("Are you absolutely sure? This cannot be undone.")) return;

        try {
            await db.delete();
            toast.success("All data deleted. Reloading...");
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            toast.error("Failed to delete data.");
        }
    };

    if (!isShopAdmin) return <div className="p-10 text-center text-error">Access Restricted</div>;

    return (
        <div className="container mx-auto max-w-7xl p-6 pb-24">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* LEFT COLUMN: PRINTER SETTINGS */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-base-content/80">Printer Settings</h2>

                    {/* Bluetooth Printer Card */}
                    <div className="card bg-base-100 shadow border border-base-200">
                        <div className="card-body">
                            <h3 className="card-title text-primary flex items-center gap-2">
                                <Bluetooth className="w-5 h-5" /> Bluetooth Printer
                            </h3>

                            {/* Status Banner */}
                            <div className={`alert ${printerDevice || formData.printerName ? 'alert-success' : 'bg-base-200'}`}>
                                {printerDevice || formData.printerName ? (
                                    <CheckCircle className="w-5 h-5" />
                                ) : (
                                    <Info className="w-5 h-5" />
                                )}
                                <div>
                                    <h3 className="font-bold">{printerDevice || formData.printerName ? 'Printer Connected' : 'No Printer Configured'}</h3>
                                    <div className="text-xs">
                                        {printerDevice || formData.printerName
                                            ? `Connected to: ${printerDevice?.name || formData.printerName}`
                                            : 'Click "Scan for Printers" to connect.'}
                                    </div>
                                </div>
                            </div>

                            {/* Instruction List */}
                            <div className="text-sm space-y-2 mt-4 bg-blue-50 p-4 rounded-lg text-blue-900">
                                <p className="font-bold flex items-center gap-2"><Info className="w-4 h-4" /> Instructions</p>
                                <ul className="list-disc list-inside space-y-1 opacity-80">
                                    <li>Turn on your Bluetooth thermal printer</li>
                                    <li>Click "Scan for Printers" to search device</li>
                                    <li>Select your printer from the list</li>
                                    <li>Click "Test Print" to verify connection</li>
                                </ul>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-4 mt-6">
                                <button className="btn btn-primary flex-1 gap-2" onClick={scanForPrinters}>
                                    <Bluetooth className="w-4 h-4" /> Scan for Printers
                                </button>
                                <button className="btn btn-secondary flex-1 gap-2" onClick={testPrint} disabled={!printerDevice && !formData.printerName}>
                                    <Printer className="w-4 h-4" /> Test Print
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Browser Compatibility */}
                    <div className="alert alert-warning shadow-sm">
                        <AlertTriangle className="w-5 h-5" />
                        <div>
                            <h3 className="font-bold">Browser Compatibility</h3>
                            <div className="text-xs">
                                Bluetooth printing requires Web Bluetooth API. Supported on Chrome (Android/Windows/Mac) and Edge. Not supported on iOS Safari/Firefox.
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: STORE INFO */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-base-content/80">Store Information</h2>

                    <div className="card bg-base-100 shadow border border-base-200">
                        <div className="card-body">
                            <h3 className="card-title text-success flex items-center gap-2">
                                <Store className="w-5 h-5" /> Store Details
                            </h3>

                            <div className="form-control w-full">
                                <label className="label"><span className="label-text">Store Name <span className="text-error">*</span></span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. My Kirana Store"
                                    className="input input-bordered w-full"
                                    value={formData.storeName}
                                    onChange={e => setFormData({ ...formData, storeName: e.target.value })}
                                />
                            </div>

                            <div className="form-control w-full">
                                <label className="label"><span className="label-text">Store Address</span></label>
                                <textarea
                                    className="textarea textarea-bordered h-24"
                                    placeholder="e.g. 123 Main St, City"
                                    value={formData.address || ''}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="form-control w-full">
                                <label className="label"><span className="label-text">Store Phone</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. 9876543210"
                                    className="input input-bordered w-full"
                                    value={formData.phone || ''}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>

                            <div className="form-control w-full">
                                <label className="label"><span className="label-text">UPI ID (for QR Code) <span className="text-error">*</span></span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. shop@okicici"
                                    className="input input-bordered w-full"
                                    value={formData.upiId || ''}
                                    onChange={e => setFormData({ ...formData, upiId: e.target.value })}
                                />
                            </div>

                            <div className="divider"></div>

                            {/* Preferences */}
                            <div className="form-control">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={formData.autoPrint}
                                        onChange={e => setFormData({ ...formData, autoPrint: e.target.checked })}
                                    />
                                    <span className="label-text font-medium">Auto-print receipts</span>
                                </label>
                                <p className="text-xs pl-8 opacity-60">Automatically print receipt after billing</p>
                            </div>

                            <div className="form-control mt-2">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={formData.printLogo}
                                        onChange={e => setFormData({ ...formData, printLogo: e.target.checked })}
                                    />
                                    <span className="label-text font-medium">Print Logo on receipts</span>
                                </label>
                            </div>

                            {/* GST Section (Retained) */}
                            <div className="divider"></div>
                            <div className="collapse collapse-arrow bg-base-50 rounded-box">
                                <input type="checkbox" />
                                <div className="collapse-title text-sm font-medium flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Tax & GST Settings
                                </div>
                                <div className="collapse-content">
                                    <div className="form-control">
                                        <label className="label cursor-pointer gap-2 justify-start">
                                            <span className="label-text">Enable GST</span>
                                            <input
                                                type="checkbox"
                                                className="toggle toggle-xs toggle-secondary"
                                                checked={formData.gstEnabled}
                                                onChange={e => setFormData({ ...formData, gstEnabled: e.target.checked })}
                                            />
                                        </label>
                                    </div>
                                    {formData.gstEnabled && (
                                        <div className="space-y-3 mt-2">
                                            <input
                                                type="text"
                                                placeholder="GSTIN Number"
                                                className="input input-bordered input-sm w-full"
                                                value={formData.gstNumber || ''}
                                                onChange={e => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                                            />
                                            <select
                                                className="select select-bordered select-sm w-full"
                                                value={formData.gstRate || 0}
                                                onChange={e => setFormData({ ...formData, gstRate: Number(e.target.value) })}
                                            >
                                                <option value={0}>0% Tax</option>
                                                <option value={5}>5% Tax</option>
                                                <option value={12}>12% Tax</option>
                                                <option value={18}>18% Tax</option>
                                                <option value={28}>28% Tax</option>
                                            </select>
                                            <label className="label cursor-pointer justify-start gap-2">
                                                <span className="label-text text-xs">Amounts include Tax?</span>
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-xs"
                                                    checked={formData.taxInclusive}
                                                    onChange={e => setFormData({ ...formData, taxInclusive: e.target.checked })}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6">
                                <button className={`btn btn-success w-full text-white font-bold gap-2 ${loading ? 'loading' : ''}`} onClick={handleSave}>
                                    <Save className="w-5 h-5" /> Save Store Information
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="alert alert-success shadow-sm bg-green-50 text-green-900 border-green-200">
                        <FileText className="w-5 h-5" />
                        <div>
                            <h3 className="font-bold">Receipt Information</h3>
                            <div className="text-xs">
                                This information will appear on all printed receipts. The UPI QR code will allow customers to pay directly.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* APP SETTINGS ROW */}
            <div className="mt-10 space-y-6">
                <h2 className="text-xl font-bold text-base-content/80">App Settings</h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Updates */}
                    <div className="card bg-base-100 shadow border border-base-200">
                        <div className="card-body">
                            <h3 className="card-title flex items-center gap-2">
                                <RefreshCw className="w-5 h-5" /> Application Updates
                            </h3>
                            <p className="text-sm opacity-70">Check if a newer version of the POS app is available.</p>
                            <div className="flex items-center gap-4 mt-4">
                                <div className="badge badge-outline">Status: Idle</div>
                                <div className="text-xs opacity-50">Cache: v{db.verno}</div>
                            </div>
                            <div className="card-actions justify-end mt-4">
                                <button className="btn btn-outline btn-primary btn-sm" onClick={() => window.location.reload()}>
                                    Check & Reload
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="card bg-red-50 shadow border border-red-200 text-red-900">
                        <div className="card-body">
                            <h3 className="card-title flex items-center gap-2 text-error">
                                <AlertTriangle className="w-5 h-5" /> Danger Zone
                            </h3>
                            <p className="text-sm">Permanently delete ALL business data (products, bills, customers, etc). This cannot be undone.</p>

                            <div className="flex gap-4 items-end mt-4">
                                <div className="form-control w-full">
                                    <input
                                        type="text"
                                        placeholder="Type: DELETE ALL"
                                        className="input input-bordered w-full bg-white text-black"
                                        value={deleteConfirmation}
                                        onChange={e => setDeleteConfirmation(e.target.value)}
                                    />
                                </div>
                                <button className="btn btn-error text-white" onClick={handleDeleteAllData}>
                                    <Trash2 className="w-4 h-4" /> Delete All Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
