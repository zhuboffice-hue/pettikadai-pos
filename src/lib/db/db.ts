
import Dexie, { Table } from 'dexie';

export interface Product {
    id: string; // Firestore ID
    shopId: string; // Added shopId
    name: string;
    tamilName?: string;
    barcode?: string;
    price: number;
    costPrice?: number;
    category: string;
    unit: string; // 'kg', 'g', 'pcs', 'l'
    isLoose: boolean;
    image?: string;
    synced: boolean;
}

export interface Inventory {
    productId: string;
    shopId: string; // Added shopId
    currentStock: number;
    lowStockThreshold: number;
    lastUpdated: number;
    synced: boolean;
}

export interface BillItem {
    productId: string;
    name: string;
    qty: number;
    price: number;
    total: number;
}



export interface Bill {
    id: string; // UUID or Firestore ID
    shopId: string;
    items: BillItem[];
    totalAmount: number;
    paymentMode: 'cash' | 'upi' | 'credit' | 'split';
    customerId?: string; // Optional
    customerName?: string; // Snapshot of name at time of bill
    customerPhone?: string; // Snapshot of phone
    profit?: number; // Calculated profit
    createdAt: number;
    status: 'completed' | 'hold';
    synced: boolean;
}

export interface Customer {
    id: string;
    shopId: string; // Added shopId
    name: string;
    phone: string;
    khataBalance: number;
    lastVisit: number;
    synced: boolean;
}

export interface KhataTransaction {
    id: string;
    shopId: string; // Added shopId
    customerId: string;
    amount: number;
    type: 'credit' | 'debit';
    referenceBillId?: string;
    date: number;
    synced: boolean;
}



export interface Expense {
    id: string;
    shopId: string;
    title: string;
    amount: number;
    category: string;
    date: number;
    synced: boolean;
}

export interface StoreSettings {
    id: string; // 'settings' singleton usually
    shopId: string;
    storeName: string;
    address?: string;
    phone?: string;
    upiId?: string;
    printerName?: string; // For Bluetooth
    autoPrint: boolean;
    printLogo: boolean;
    // GST Settings
    gstEnabled: boolean;
    gstNumber?: string;
    gstRate?: number; // Default rate in %
    taxInclusive: boolean; // Are prices inclusive of tax?
    synced: boolean;
}

export interface SyncQueueEntry {
    id?: number; // Auto-increment
    collection: string;
    docId: string;
    action: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
    shopId?: string; // Optional context
}

class ZPOSDatabase extends Dexie {
    products!: Table<Product>;
    inventory!: Table<Inventory>;
    bills!: Table<Bill>;
    customers!: Table<Customer>;
    khataTransactions!: Table<KhataTransaction>;
    expenses!: Table<Expense>;
    storeSettings!: Table<StoreSettings>;
    syncQueue!: Table<SyncQueueEntry>;

    constructor() {
        super('ZPOSDatabase');
        this.version(4).stores({ // Incremented to 4
            products: 'id, barcode, category, name, shopId', // Index for search
            inventory: 'productId, shopId',
            bills: 'id, createdAt, customerId, synced, shopId',
            customers: 'id, phone, name, shopId',
            khataTransactions: 'id, customerId, date, shopId',
            expenses: 'id, date, category, shopId',
            storeSettings: 'id, shopId',
            syncQueue: '++id, collection, timestamp' // Queue for background sync
        });
    }
}

export const db = new ZPOSDatabase();
