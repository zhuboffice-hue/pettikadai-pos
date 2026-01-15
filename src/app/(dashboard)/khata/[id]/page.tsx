"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, KhataTransaction } from "@/lib/db/db";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from "@/components/providers/AuthProvider";

export default function CustomerLedgerPage() {
    const { userData } = useAuth();
    const shopId = userData?.shopId;
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const customer = useLiveQuery(() => db.customers.where('id').equals(id).first());
    const transactions = useLiveQuery(() =>
        db.khataTransactions.where('customerId').equals(id).reverse().toArray()
    );

    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);

    const handleTransaction = async (type: 'credit' | 'debit') => {
        if (!amount || isNaN(Number(amount))) return;
        if (!shopId) {
            toast.error("Shop ID missing");
            return;
        }
        setLoading(true);

        try {
            const val = parseFloat(amount);
            const transaction: KhataTransaction = {
                id: uuidv4(),
                shopId: shopId,
                customerId: id,
                amount: val,
                type,
                date: Date.now(),
                synced: false
            };

            await db.transaction('rw', db.customers, db.khataTransactions, db.syncQueue, async () => {
                // Add transaction
                await db.khataTransactions.add(transaction);
                // Update customer balance
                const currentBal = customer?.khataBalance || 0;
                const newBal = type === 'credit' ? currentBal + val : currentBal - val;

                await db.customers.update(id, { khataBalance: newBal, synced: false });

                // Sync items
                await db.syncQueue.add({
                    collection: 'khata_transactions',
                    docId: transaction.id,
                    action: 'create',
                    data: transaction,
                    timestamp: Date.now(),
                    shopId: shopId
                });
                await db.syncQueue.add({
                    collection: 'customers',
                    docId: id,
                    action: 'update',
                    data: { khataBalance: newBal }, // ideally full obj, but partial update logic in sync needed
                    timestamp: Date.now(),
                    shopId: shopId
                });
            });

            toast.success("Transaction Record Saved");
            setAmount("");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save transaction");
        } finally {
            setLoading(false);
        }
    };

    if (!customer) return <div className="p-10 text-center"><span className="loading loading-spinner"></span></div>;

    return (
        <div className="container mx-auto max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => router.back()} className="btn btn-ghost btn-circle">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold">{customer.name}</h1>
                    <p className="opacity-70">{customer.phone}</p>
                </div>
            </div>

            {/* Balance Card */}
            <div className="card bg-base-100 shadow-xl mb-6">
                <div className="card-body text-center">
                    <span className="text-sm uppercase tracking-wide opacity-70">Current Balance</span>
                    <div className={`text-4xl font-bold ${customer.khataBalance > 0 ? 'text-error' : 'text-success'}`}>
                        ₹{Math.abs(customer.khataBalance)}
                        <span className="text-sm ml-2 align-middle uppercase">
                            {customer.khataBalance > 0 ? 'Due' : 'Advance'}
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-2 border-t border-base-200">
                    <div className="p-4 border-r border-base-200">
                        <div className="join w-full">
                            <input
                                type="number"
                                placeholder="Amount"
                                className="join-item input input-bordered w-full"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                            <button
                                className="join-item btn btn-error"
                                disabled={loading}
                                onClick={() => handleTransaction('credit')}
                            >
                                <ArrowDownLeft className="w-4 h-4" /> Give Credit
                            </button>
                        </div>
                    </div>
                    <div className="p-4 flex items-center justify-center">
                        <button
                            className="btn btn-success w-full"
                            disabled={loading || !amount}
                            onClick={() => handleTransaction('debit')}
                        >
                            <ArrowUpRight className="w-4 h-4" /> Receive Payment
                        </button>
                    </div>
                </div>
            </div>

            {/* Ledger History */}
            <div className="bg-base-100 rounded-box shadow overflow-hidden">
                <div className="p-4 font-bold border-b border-base-200">Transaction History</div>
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions?.map(tx => (
                                <tr key={tx.id}>
                                    <td className="text-sm opacity-70">
                                        {new Date(tx.date).toLocaleString()}
                                    </td>
                                    <td>
                                        {tx.type === 'credit' ? (
                                            <span className="badge badge-error badge-outline gap-1"><ArrowDownLeft className="w-3 h-3" /> Credit Given</span>
                                        ) : (
                                            <span className="badge badge-success badge-outline gap-1"><ArrowUpRight className="w-3 h-3" /> Payment Received</span>
                                        )}
                                    </td>
                                    <td className={`font-bold ${tx.type === 'credit' ? 'text-error' : 'text-success'}`}>
                                        ₹{tx.amount}
                                    </td>
                                </tr>
                            ))}
                            {transactions && transactions.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="text-center p-8 opacity-50">No transactions yet</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
