import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { order_id, gross_amount, customer_name } = await req.json();

    if (!order_id || !gross_amount) {
      return NextResponse.json({ error: 'Missing order_id or gross_amount' }, { status: 400 });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      return NextResponse.json({ error: 'MIDTRANS_SERVER_KEY is not configured' }, { status: 500 });
    }

    // Midtrans requires Base64 of SERVER_KEY:
    const base64ServerKey = Buffer.from(serverKey + ':').toString('base64');

    // Menggunakan Sandbox API untuk keperluan testing
    const apiUrl = 'https://api.sandbox.midtrans.com/v2/charge';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${base64ServerKey}`
      },
      body: JSON.stringify({
        payment_type: "qris",
        transaction_details: {
          order_id: order_id,
          gross_amount: gross_amount
        },
        customer_details: {
          first_name: customer_name || "Pelanggan"
        },
        qris: {
          acquirer: "gopay" // standard for QRIS in Midtrans Sandbox
        }
      })
    });

    const data = await response.json();

    if (!response.ok || data.status_code !== '201') {
      console.error('Midtrans API Error:', data);
      return NextResponse.json({ error: data.status_message || 'Payment generation failed' }, { status: response.status || 500 });
    }

    // Usually, the QR image url is in the actions array
    const qrUrl = data.actions?.find((a: any) => a.name === 'generate-qr-code')?.url;

    if (!qrUrl) {
      return NextResponse.json({ error: 'QR Code URL not found in Midtrans response' }, { status: 500 });
    }

    return NextResponse.json({ 
      qr_url: qrUrl,
      transaction_id: data.transaction_id
    });

  } catch (error: any) {
    console.error('Midtrans Charge API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
