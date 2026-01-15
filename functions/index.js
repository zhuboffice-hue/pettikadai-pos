
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

/**
 * Trigger: On Bill Creation
 * Purpose: Deduct inventory and update daily sales count
 */
exports.finalizeBill = functions.firestore
    .document("bills/{billId}")
    .onCreate(async (snap, context) => {
        const bill = snap.data();
        const items = bill.items;

        // Batch write for atomic updates
        const batch = db.batch();

        // 1. Deduct Inventory
        for (const item of items) {
            const productRef = db.collection("inventory").doc(item.productId);
            batch.set(productRef, {
                currentStock: admin.firestore.FieldValue.increment(-item.qty),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // 2. Update Daily Sales Aggregation
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const reportRef = db.collection("reports").doc(`daily_sales_${today}`);

        batch.set(reportRef, {
            totalSales: admin.firestore.FieldValue.increment(bill.totalAmount),
            billCount: admin.firestore.FieldValue.increment(1),
            date: today
        }, { merge: true });

        // 3. Update Customer Khata if used (Redundant safety check)
        if (bill.paymentMode === 'credit' && bill.customerId) {
            const customerRef = db.collection("customers").doc(bill.customerId);
            batch.update(customerRef, {
                khataBalance: admin.firestore.FieldValue.increment(bill.totalAmount),
                lastVisit: admin.firestore.FieldValue.serverTimestamp()
            });

            // Log transaction
            const txRef = db.collection("khata_transactions").doc();
            batch.set(txRef, {
                customerId: bill.customerId,
                amount: bill.totalAmount,
                type: 'credit',
                referenceBillId: context.params.billId,
                date: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return batch.commit();
    });

/**
 * Scheduled: Daily Profit Calculation
 * Purpose: Calculate rough margin based on simple logic
 * Run every night at 11:59 PM
 */
exports.dailySummary = functions.pubsub.schedule('59 23 * * *').onRun(async (context) => {
    const today = new Date().toISOString().split('T')[0];
    const billsSnap = await db.collection('bills')
        .where('createdAt', '>=', new Date(today).getTime()) // Assuming createdAt is timestamp
        .get();

    let totalRevenue = 0;
    let estimatedCost = 0;

    for (const doc of billsSnap.docs) {
        const bill = doc.data();
        totalRevenue += bill.totalAmount;

        // Fetch product cost prices (In real app, cache this or store cost in bill item)
        // Here assuming flat 20% margin for estimation if cost not found
        estimatedCost += bill.totalAmount * 0.8;
    }

    const profit = totalRevenue - estimatedCost;

    await db.collection("reports").doc(`daily_profit_${today}`).set({
        revenue: totalRevenue,
        estimatedProfit: profit,
        date: today,
        calculatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Daily summary for ${today} completed.`);
});
