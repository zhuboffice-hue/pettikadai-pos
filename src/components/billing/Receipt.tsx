import React, { forwardRef } from 'react';
import { Bill } from '@/lib/db/db';

interface ReceiptProps {
    bill: Bill;
    shopDetails?: {
        name: string;
        address?: string;
        phone?: string;
    };
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ bill, shopDetails }, ref) => {
    return (
        <div ref={ref} className="p-4 bg-white text-black font-mono text-sm w-[80mm] mx-auto hidden print:block">
            <div className="text-center mb-4 border-b border-black pb-2">
                <h1 className="font-bold text-xl uppercase">{shopDetails?.name || 'Kirana Shop'}</h1>
                {shopDetails?.address && <p>{shopDetails.address}</p>}
                {shopDetails?.phone && <p>Ph: {shopDetails.phone}</p>}
                <p className="border-t border-black mt-1 pt-1">
                    Date: {new Date(bill.createdAt).toLocaleString()}
                </p>
                <p>Bill #: {bill.id.slice(0, 8)}</p>
            </div>

            <table className="w-full text-left mb-4">
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
                            <td className="text-right">{item.total}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="border-t border-black pt-2 space-y-1">
                <div className="flex justify-between font-bold text-lg">
                    <span>TOTAL</span>
                    <span>₹{bill.totalAmount}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span>Payment Mode</span>
                    <span className="uppercase">{bill.paymentMode}</span>
                </div>
            </div>

            <div className="text-center mt-6 text-xs">
                <p>Thank you for shopping!</p>
                <p>Visit Again</p>
            </div>
        </div>
    );
});

Receipt.displayName = 'Receipt';
