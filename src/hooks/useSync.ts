
import { useLiveQuery } from "dexie-react-hooks";
import { db, SyncQueueEntry } from "@/lib/db/db";
import { doc, setDoc, deleteDoc, updateDoc, collection } from "firebase/firestore";
import { db as firestore } from "@/lib/firebase/config";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

export function useSync() {
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

    return { isSyncing, pendingCount: syncQueue?.length || 0, online };
}
