import { db } from '../config/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';
import { format } from 'date-fns';

export type VoucherPrefix = 'IMP' | 'EXP' | 'TRF' | 'PO' | 'ADJ' | 'NC';

/**
 * Generate sequential voucher number with date prefix
 * Format: {PREFIX}-{YYYYMMDD}-{SEQ}
 * Example: IMP-20260522-0001
 */
export const generateVoucherNumber = async (prefix: VoucherPrefix): Promise<string> => {
  const dateStr = format(new Date(), 'yyyyMMdd');
  const counterId = `${prefix}_${dateStr}`;
  const counterRef = db.collection('counters').doc(counterId);

  // We use a transaction to safely increment and get the counter
  const sequence = await db.runTransaction(async (txn) => {
    const doc = await txn.get(counterRef);
    let nextSeq = 1;

    if (doc.exists) {
      nextSeq = (doc.data()?.count || 0) + 1;
      txn.update(counterRef, { count: FieldValue.increment(1) });
    } else {
      txn.set(counterRef, { count: 1 });
    }

    return nextSeq;
  });

  // Pad sequence to 4 digits (e.g., 0001)
  const paddedSeq = sequence.toString().padStart(4, '0');
  
  return `${prefix}-${dateStr}-${paddedSeq}`;
};
