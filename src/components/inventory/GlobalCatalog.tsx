"use client";

import { useState } from "react";
// @ts-ignore
import * as XLSX from "xlsx";
import { Plus, Upload, Search, PackageCheck, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";

export interface CatalogItem {
    name: string;
    category: string;
    description?: string;
}

const DEFAULT_CATALOG: CatalogItem[] = [
    { name: "Sugar", category: "Groceries" },
    { name: "Tea Powder", category: "Groceries" },
    { name: "Coffee Powder", category: "Groceries" },
    { name: "Salt", category: "Groceries" },
    { name: "Oil", category: "Groceries" },
    { name: "Tamarind", category: "Groceries" },
    { name: "Asafoetida", category: "Groceries" },
    { name: "Shampoo Sachets", category: "Personal Care" },
    { name: "Toothpaste Sachets", category: "Personal Care" },
    { name: "Toothbrush (basic)", category: "Personal Care" },
    { name: "Hair Oil Sachets", category: "Personal Care" },
    { name: "Detergent Powder Sachets", category: "Household" },
    { name: "Phenyl", category: "Household" },
];

interface GlobalCatalogProps {
    onAddProduct: (item: CatalogItem) => void;
    existingProductNames: Set<string>;
}

export default function GlobalCatalog({ onAddProduct, existingProductNames }: GlobalCatalogProps) {
    const [catalog, setCatalog] = useState<CatalogItem[]>(DEFAULT_CATALOG);
    const [searchTerm, setSearchTerm] = useState("");
    const [importedItems, setImportedItems] = useState<CatalogItem[]>([]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

                const newItems: CatalogItem[] = jsonData.map(row => ({
                    name: row.Name || row.name || row.Item || "Unknown",
                    category: row.Category || row.category || "General",
                    description: row.Description || row.description || ""
                })).filter(item => item.name !== "Unknown");

                setImportedItems(newItems);
                toast.success(`Found ${newItems.length} items from Excel`);
            } catch (err) {
                console.error(err);
                toast.error("Failed to parse Excel file");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const combinedCatalog = [...importedItems, ...catalog];
    const filteredCatalog = combinedCatalog.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header / Upload */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-base-200/50 p-4 rounded-xl border border-base-300">
                <div className="flex-1 w-full">
                    <h3 className="font-bold flex items-center gap-2">
                        <Upload className="w-5 h-5 text-primary" /> Import from Excel
                    </h3>
                    <p className="text-xs opacity-60">Upload .xlsx file with "Name" and "Category" columns</p>
                </div>
                <div>
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileUpload}
                        className="file-input file-input-bordered file-input-sm w-full max-w-xs"
                    />
                </div>
            </div>

            {/* Catalog Search & List */}
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search Global Catalog..."
                        className="input input-bordered w-full pl-10"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredCatalog.map((item, i) => {
                        const exists = existingProductNames.has(item.name.toLowerCase());
                        return (
                            <div key={i} className={`card border ${exists ? 'bg-base-200/50 border-base-200' : 'bg-base-100 border-base-300 shadow-sm'}`}>
                                <div className="card-body p-4 flex flex-row items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h4 className={`font-bold truncate ${exists ? 'opacity-50' : ''}`}>{item.name}</h4>
                                        <p className="text-xs opacity-60">{item.category}</p>
                                    </div>
                                    <button
                                        className={`btn btn-sm ${exists ? 'btn-ghost btn-disabled' : 'btn-outline btn-primary'}`}
                                        onClick={() => !exists && onAddProduct(item)}
                                    >
                                        {exists ? <PackageCheck className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                        {exists ? "Added" : "Add"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredCatalog.length === 0 && (
                    <div className="text-center py-10 opacity-50">
                        No items found in catalog
                    </div>
                )}
            </div>
        </div>
    );
}
