// functions/src/index.ts
import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentWritten, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';

import { db } from './firebaseAdmin';
import { sendSwiftReports, SENDGRID_API_KEY } from './sendSwiftReports';

// ---------- Region ----------
const REGION = 'us-east1'; // was 'us-central1'

// ---------- Mirror bank details to public_users ----------
/**
 * Mirror bank details from /users/{uid} → /public_users/{uid}
 * Supports nested structure: users/{uid}.bankDetails.{...}
 */
export const mirrorBankToPublic = onDocumentWritten(
  { region: REGION, document: 'users/{uid}' },
  async (event) => {
    const uid = String(event.params.uid || '');
    const after = event.data?.after?.data();
    if (!after) return;

    // Read nested bankDetails if present; otherwise fall back to top-level fields
    const raw: Record<string, unknown> =
      after.bankDetails && typeof after.bankDetails === 'object'
        ? (after.bankDetails as Record<string, unknown>)
        : (after as Record<string, unknown>);

    const get = (k: string) => {
      const v = raw[k];
      return v == null ? '' : (typeof v === 'string' ? v : String(v)).trim();
    };

    const fields = ['bankName', 'accountHolder', 'accountNumber', 'paymentEmail', 'branchCode', 'swiftCode'] as const;
    const hasAny = fields.some((k) => get(k).length > 0);

    // If cleared, reflect that state publicly
    if (!hasAny) {
      await db.collection('public_users').doc(uid).set(
        { hasBank: false, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      logger.info('ℹ️ No bank fields set; marked hasBank=false', { uid });
      return;
    }

    const payload = {
      bankDetails: {
        bankName: get('bankName'),
        accountHolder: get('accountHolder'),
        accountNumber: get('accountNumber'),
        paymentEmail: get('paymentEmail'),
        branchCode: get('branchCode'),
        swiftCode: get('swiftCode'),
      },
      hasBank: true,
      ownerId: uid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection('public_users').doc(uid).set(payload, { merge: true });
    logger.info('✅ mirrored bank details (nested-supported) to public_users', { uid });
  }
);

// ---------- Proof uploaded → mark Paid + decrement stock ----------
/**
 * When proof is uploaded (isProofUploaded flips to true) for an order:
 * 1) mark order as 'Paid'
 * 2) decrement ONLY that entrepreneur's product stock based on the order items
 */
export const onProofUploaded = onDocumentUpdated(
  { region: REGION, document: 'users/{userId}/orders/{orderId}' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Run once: only when it transitions to true
    if (before.isProofUploaded === true || after.isProofUploaded !== true) return;

    const userId = String(event.params.userId || '');
    const orderId = String(event.params.orderId || '');

    await db.runTransaction(async (tx) => {
      // 1) Mark order as paid
      const orderRef = db.doc(`users/${userId}/orders/${orderId}`);
      tx.set(orderRef, { status: 'Paid', paidAt: FieldValue.serverTimestamp() }, { merge: true });

      // 2) Decrement stock for the items in this order (this entrepreneur only)
      const items: Array<{ productId: string; quantity?: number }> = Array.isArray(after.items) ? after.items : [];
      for (const item of items) {
        if (!item?.productId) continue;
        const qty = Number(item.quantity ?? 1);
        const prodRef = db.doc(`users/${userId}/products/${item.productId}`);
        tx.update(prodRef, { stock: FieldValue.increment(-qty) });
      }
    });

    logger.info('✅ proof processed, order paid & stock decremented', { userId, orderId });
  }
);

// ---------- Schedulers ----------
/** DAILY Swift Report — 09:00 Africa/Johannesburg (v2 scheduler) */
export const dailySwiftReport = onSchedule(
  {
    region: REGION,
    schedule: 'every day 09:00',
    timeZone: 'Africa/Johannesburg',
    secrets: [SENDGRID_API_KEY],
  },
  async () => {
    await sendSwiftReports('daily');
    logger.info('✅ Daily Swift Reports run complete');
  }
);

/** WEEKLY Swift Report — Mondays 09:00 Africa/Johannesburg (v2 scheduler) */
export const weeklySwiftReport = onSchedule(
  {
    region: REGION,
    schedule: 'every monday 09:00',
    timeZone: 'Africa/Johannesburg',
    secrets: [SENDGRID_API_KEY],
  },
  async () => {
    await sendSwiftReports('weekly');
    logger.info('✅ Weekly Swift Reports run complete');
  }
);







