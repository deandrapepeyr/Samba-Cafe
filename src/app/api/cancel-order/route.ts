import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, reason } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('transactions')
      .update({
        status: 'cancelled',
        payment_status: reason === 'EXPIRED' ? 'EXPIRED' : 'CANCELLED_BY_USER'
      })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id, status, payment_status');

    if (error) {
      console.error('Failed to cancel order:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orderId,
      status: 'cancelled',
      payment_status: reason === 'EXPIRED' ? 'EXPIRED' : 'CANCELLED_BY_USER'
    });
  } catch (err: any) {
    console.error('Cancel order error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
