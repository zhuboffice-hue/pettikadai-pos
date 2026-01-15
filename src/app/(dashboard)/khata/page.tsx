
"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Customer } from "@/lib/db/db";
import { Plus, Search, User, Phone, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

export default function KhataPage() {
    const { userData } = useAuth();
    const shopId = userData?.shopId;
    const router = useRouter();

    const customers = useLiveQuery(async () => {
        if (!shopId) return [];
        return await db.customers.where('shopId').equals(shopId).toArray();
    }, [shopId]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });

    const filteredCustomers = customers?.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
    );

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const customer: Customer = {
                id: uuidv4(),
                shopId: shopId!,
                name: newCustomer.name,
                phone: newCustomer.phone,
                khataBalance: 0,
                lastVisit: Date.now(),
                synced: false
            };

            await db.customers.add(customer);
            await db.syncQueue.add({
                collection: 'customers',
                docId: customer.id,
                action: 'create',
                data: customer,
                timestamp: Date.now(),
                shopId: shopId
            });

            toast.success("Customer added");
            setIsModalOpen(false);
            setNewCustomer({ name: "", phone: "" });
        } catch (error) {
            toast.error("Failed to add customer");
        }
    };

    return (
        <div className="container mx-auto max-w-5xl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Kadan (Credit Book)</h1>
                <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> New Customer
                </button>
            </div>

            <div className="bg-base-100 p-4 rounded-box shadow flex gap-4 mb-6">
                <Search className="w-5 h-5 text-gray-500 mt-3" />
                <input
                    type="text"
                    placeholder="Search by name or phone..."
                    className="input input-bordered w-full"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers?.map(customer => (
                    <div
                        key={customer.id}
                        className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => router.push(`/khata/${customer.id}`)}
                    >
                        <div className="card-body p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{customer.name}</h3>
                                    <div className="flex items-center text-sm opacity-70 mt-1">
                                        <Phone className="w-3 h-3 mr-1" /> {customer.phone}
                                    </div>
                                </div>
                                <div className="avatar placeholder">
                                    <div className="bg-neutral text-neutral-content rounded-full w-10">
                                        <User className="w-6 h-6" />
                                    </div>
                                </div>
                            </div>

                            <div className="divider my-2"></div>

                            <div className="flex justify-between items-center">
                                <span className="text-sm">Balance</span>
                                <span className={`text-xl font-bold ${customer.khataBalance > 0 ? 'text-error' : 'text-success'}`}>
                                    ₹{Math.abs(customer.khataBalance)} {customer.khataBalance > 0 ? 'Due' : 'Adv'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Customer Modal */}
            {isModalOpen && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">Add New Customer</h3>
                        <form onSubmit={handleAddCustomer} className="space-y-4">
                            <div className="form-control">
                                <label className="label">Name</label>
                                <input
                                    required
                                    className="input input-bordered"
                                    value={newCustomer.name}
                                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">Phone</label>
                                <input
                                    required
                                    type="tel"
                                    className="input input-bordered"
                                    value={newCustomer.phone}
                                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                />
                            </div>
                            <div className="modal-action">
                                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
