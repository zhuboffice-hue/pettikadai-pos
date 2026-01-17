import React, { forwardRef } from 'react';
import { Bill, StoreSettings } from '@/lib/db/db';

interface ReceiptProps {
    bill: Bill;
    settings?: StoreSettings;
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ bill, settings }, ref) => {
    // GST Calculation
    const gstRate = settings?.gstRate || 0;
    const isGstEnabled = settings?.gstEnabled;

    // Tax Component = Total * (Rate / (100 + Rate))
    const taxAmount = isGstEnabled ? (bill.totalAmount * (gstRate / (100 + gstRate))) : 0;
    const taxableAmount = bill.totalAmount - taxAmount;
    const cgst = taxAmount / 2;
    const sgst = taxAmount / 2;

    return (
        <div ref={ref} className="hidden print:block bg-white text-black font-mono text-[10px] leading-tight">
            <style jsx global>{`
                @media print {
                    @page {
                        size: 58mm auto;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                }
            `}</style>
            <div className="p-1 w-[55mm] mx-auto">
                {/* Header */}
                <div className="text-center mb-4 border-b border-black pb-2">
                    <h1 className="font-bold text-xl uppercase">{settings?.storeName || 'Kirana Shop'}</h1>
                    {settings?.address && <p className="whitespace-pre-line">{settings.address}</p>}
                    {settings?.phone && <p>Ph: {settings.phone}</p>}
                    {isGstEnabled && settings?.gstNumber && (
                        <p className="font-bold mt-1">GSTIN: {settings.gstNumber}</p>
                    )}

                    <div className="flex justify-between border-t border-black mt-2 pt-1 text-xs">
                        <span>Date: {new Date(bill.createdAt).toLocaleDateString()}</span>
                        <span>Time: {new Date(bill.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-left text-xs">Bill #: {bill.id.slice(0, 8)}</div>
                    {bill.customerName && <div className="text-left text-xs">Cust: {bill.customerName}</div>}
                </div>

                {/* Items */}
                <table className="w-full text-left mb-4 text-xs">
                    <thead>
                        <tr className="border-b border-black">
                            <th className="w-[45%]">Item</th>
                            <th className="w-[20%] text-right">Qty</th>
                            <th className="w-[35%] text-right">Amt</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bill.items.map((item, idx) => (
                            <tr key={idx}>
                                <td className="truncate pr-1">{item.name}</td>
                                <td className="text-right">{item.qty} x {item.price}</td>
                                <td className="text-right">{item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="border-t border-black pt-2 space-y-1">
                    <div className="flex justify-between font-bold text-lg">
                        <span>TOTAL</span>
                        <span>₹{bill.totalAmount.toFixed(2)}</span>
                    </div>

                    {/* GST Breakdown */}
                    {isGstEnabled && gstRate > 0 && (
                        <div className="text-[10px] grid grid-cols-2 gap-x-4 border-t border-dashed border-gray-400 pt-1 mt-1">
                            <span>Taxable Amt:</span>
                            <span className="text-right">₹{taxableAmount.toFixed(2)}</span>

                            <span>CGST ({(gstRate / 2)}%):</span>
                            <span className="text-right">₹{cgst.toFixed(2)}</span>

                            <span>SGST ({(gstRate / 2)}%):</span>
                            <span className="text-right">₹{sgst.toFixed(2)}</span>

                            <span className="col-span-2 text-right italic font-medium mt-1">
                                (Prices are inclusive of Tax)
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between text-xs mt-2">
                        <span>Payment Mode</span>
                        <span className="uppercase font-bold">{bill.paymentMode}</span>
                    </div>
                </div>

                <div className="text-center mt-6 text-xs">
                    <p>Thank you for shopping!</p>
                    <p>Visit Again</p>
                    {settings?.printerName && <p className="text-[8px] opacity-50 mt-2">{settings.printerName}</p>}
                </div>
            </div>
        </div>
    );
});

Receipt.displayName = 'Receipt';
