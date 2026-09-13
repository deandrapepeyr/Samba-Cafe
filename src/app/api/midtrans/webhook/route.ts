import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Verify signature to ensure it's really from Midtrans
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    const hash = crypto.createHash('sha512');
    hash.update(data.order_id + data.status_code + data.gross_amount + serverKey);
    const calculatedSignature = hash.digest('hex');

    if (calculatedSignature !== data.signature_key) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const transactionStatus = data.transaction_status;
    const orderId = data.order_id;

    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      // Payment successful
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'preparing' }) // Moving straight to preparing for kitchen
        .eq('id', orderId);

      if (error) {
        console.error("Supabase update error:", error);
        return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
      }
    } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
      // Payment failed
      await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('Midtrans Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
