
import { useLiveQuery } from "dexie-react-hooks";
import { db, SyncQueueEntry } from "@/lib/db/db";
import { doc, setDoc, deleteDoc, updateDoc, collection, query, where, getDocs, getDoc, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db as firestore } from "@/lib/firebase/config";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/components/providers/AuthProvider";

export function useSync() {
    const { userData } = useAuth();
    const syncQueue = useLiveQuery(() => db.syncQueue.toArray());
    const [isSyncing, setIsSyncing] = useState(false);
    const [online, setOnline] = useState(true);

    useEffect(() => {
        setOnline(navigator.onLine);
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (online && syncQueue && syncQueue.length > 0 && !isSyncing) {
            processSyncQueue();
        }
    }, [syncQueue, online, isSyncing]);

    const processSyncQueue = async () => {
        if (!syncQueue || syncQueue.length === 0) return;
        setIsSyncing(true);

        try {
            // Process one by one to ensure order
            for (const entry of syncQueue) {
                await syncEntry(entry);
            }
        } catch (error) {
            console.error("Sync failed:", error);
        } finally {
            setIsSyncing(false);
        }
    };

    const syncEntry = async (entry: SyncQueueEntry) => {
        try {
            const { collection: col, docId, action, data } = entry;
            const ref = doc(firestore, col, docId);

            if (action === 'create' || action === 'update') {
                // Remove local-only fields if any before sending to Firestore
                const { synced, ...firestoreData } = data;
                await setDoc(ref, { ...firestoreData, synced: true, updatedAt: Date.now() }, { merge: true });

                // Update local doc status to synced
                if (col === 'bills') await db.bills.update(docId, { synced: true });
                if (col === 'products') await db.products.update(docId, { synced: true });
                if (col === 'customers') await db.customers.update(docId, { synced: true });
                if (col === 'inventory') await db.inventory.update(docId, { synced: true });

            } else if (action === 'delete') {
                await deleteDoc(ref);
            }

            // Remove from queue on success
            if (entry.id) await db.syncQueue.delete(entry.id);

        } catch (error) {
            console.error(`Failed to sync entry ${entry.id}:`, error);
            // Optional: Logic to retry or move to 'dead letter queue'
            throw error; // Stop processing to avoid out-of-order issues
        }
    };

    const manualSyncDown = async (shopId: string) => {
        if (!navigator.onLine) {
            toast.error("You are offline");
            return;
        }
        setIsSyncing(true);
        const toastId = toast.loading("Downloading Shop Data...");

        try {
            // 1. Fetch Data from Firestore (Network) - OUTSIDE Transaction
            // Products
            const pQuery = query(collection(firestore, 'products'), where('shopId', '==', shopId));
            const pSnap = await getDocs(pQuery);
            const products = pSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                synced: true
            }));

            // Inventory
            const invQuery = query(collection(firestore, 'inventory'), where('shopId', '==', shopId));
            const invSnap = await getDocs(invQuery);
            const inventory = invSnap.docs.map(d => ({
                productId: d.id,
                ...d.data(),
                synced: true
            }));

            // Customers
            const cQuery = query(collection(firestore, 'customers'), where('shopId', '==', shopId));
            const cSnap = await getDocs(cQuery);
            const customers = cSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                synced: true
            }));

            // Settings
            const sQuery = query(collection(firestore, 'storeSettings'), where('shopId', '==', shopId));
            const sSnap = await getDocs(sQuery);
            let settingsData = null;

            if (!sSnap.empty) {
                settingsData = { ...sSnap.docs[0].data(), id: 'settings', synced: true };
            } else {
                // FALLBACK: If no settings saved yet, try to get Shop Name from Registry
                try {
                    const shopDocRef = doc(firestore, 'shops', shopId);
                    const shopDoc = await getDoc(shopDocRef);
                    if (shopDoc.exists()) {
                        const shopData = shopDoc.data();
                        settingsData = {
                            id: 'settings',
                            shopId: shopId,
                            storeName: shopData.name || 'My Kirana Shop',
                            // Default values for other fields
                            address: '', phone: '', upiId: '',
                            autoPrint: false, printLogo: false,
                            gstEnabled: false, taxInclusive: true,
                            synced: true
                        };
                    }
                } catch (err) {
                    console.error("Failed to fetch shop registry details", err);
                }
            }

            // Bills (Orders) History
            const bQuery = query(collection(firestore, 'bills'), where('shopId', '==', shopId), orderBy('createdAt', 'desc'), limit(100));
            const bSnap = await getDocs(bQuery);
            const bills = bSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                synced: true
            }));

            // 2. Write to Local DB (Disk) - INSIDE Transaction
            await db.transaction('rw', [db.products, db.inventory, db.customers, db.storeSettings, db.bills], async () => {
                // Clear existing data to prevent leakage/stale data
                await db.products.clear();
                await db.inventory.clear();
                await db.customers.clear();
                await db.storeSettings.clear();

                await db.products.bulkPut(products as any);
                await db.inventory.bulkPut(inventory as any);
                await db.customers.bulkPut(customers as any);
                if (settingsData) {
                    await db.storeSettings.put(settingsData as any);
                }

                // Sync Bills
                await db.bills.clear();
                await db.bills.bulkPut(bills as any);
            });

            toast.success("Data Synced Successfully!", { id: toastId });
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error(error);
            toast.error("Sync Failed. Check Console.", { id: toastId });
        } finally {
            setIsSyncing(false);
        }
    };

    // Real-time Downward Sync (Cloud -> Local)
    useEffect(() => {
        if (!userData?.shopId || !navigator.onLine) return;
        const shopId = userData.shopId;

        console.log("Starting Real-time Sync for:", shopId);

        // 1. Products Listener
        const qProd = query(collection(firestore, 'products'), where('shopId', '==', shopId));
        const unsubProd = onSnapshot(qProd, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                try {
                    const data = change.doc.data();
                    if (change.type === "added" || change.type === "modified") {
                        if (!change.doc.id) return;
                        await db.products.put({ ...data, id: change.doc.id, synced: true } as any);
                    } else if (change.type === "removed") {
                        if (change.doc.id) await db.products.delete(change.doc.id);
                    }
                } catch (err) {
                    console.error("RT Prod Sync Error:", err);
                }
            });
        });

        // 2. Inventory Listener
        const qInv = query(collection(firestore, 'inventory'), where('shopId', '==', shopId));
        const unsubInv = onSnapshot(qInv, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                try {
                    const data = change.doc.data();
                    if (change.type === "added" || change.type === "modified") {
                        // Inventory PK is productId
                        if (!data.productId) return;

                        const invData = {
                            ...data,
                            synced: true
                        };
                        await db.inventory.put(invData as any);

                    } else if (change.type === "removed") {
                        if (data.productId) {
                            await db.inventory.where('productId').equals(data.productId).delete();
                        }
                    }
                } catch (err) {
                    console.error("RT Inv Sync Error:", err);
                }
            });
        });

        return () => {
            console.log("Stopping Real-time Sync");
            unsubProd();
            unsubInv();
        };
    }, [userData?.shopId, online]);


    return { isSyncing, pendingCount: syncQueue?.length || 0, online, manualSyncDown };
}
