import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, chatHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Fetch reporting data from Supabase
    // Get transactions for today, this week, this month
    const now = new Date();
    const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    // Simple week start (Sunday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0,0,0,0);
    const weekStr = weekStart.toISOString();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

    // Fetch all transactions from the start of the year to avoid multiple queries
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, total, created_at, method, cashier_name')
      .gte('created_at', yearStart);

    if (error) {
      console.error("Supabase fetch error:", error);
      throw new Error("Failed to fetch transaction data");
    }

    let todayTotal = 0;
    let todayCount = 0;
    let todayCash = 0;
    let todayQRIS = 0;
    const activeCashiersToday = new Set<string>();

    let weekTotal = 0;
    let weekCount = 0;
    let monthTotal = 0;
    let monthCount = 0;
    let yearTotal = 0;
    let yearCount = 0;

    transactions?.forEach(tx => {
      const txDate = new Date(tx.created_at);
      
      // Year
      yearTotal += tx.total;
      yearCount++;

      // Month
      if (txDate >= new Date(monthStart)) {
        monthTotal += tx.total;
        monthCount++;
      }

      // Week
      if (txDate >= weekStart) {
        weekTotal += tx.total;
        weekCount++;
      }

      // Today
      if (txDate >= new Date(todayStr)) {
        todayTotal += tx.total;
        todayCount++;
        
        if (tx.cashier_name) activeCashiersToday.add(tx.cashier_name);
        
        if (tx.method?.toLowerCase() === 'cash') {
          todayCash += tx.total;
        } else if (tx.method?.toLowerCase() === 'qris') {
          todayQRIS += tx.total;
        }
      }
    });

    const cashiersList = Array.from(activeCashiersToday).join(', ') || 'Belum ada';

    // Top items for the month
    const currentMonthTxIds = transactions?.filter(tx => new Date(tx.created_at) >= new Date(monthStart)).map(tx => tx.id) || [];
    let topItemsList = '';
    
    if (currentMonthTxIds.length > 0) {
      const idsToFetch = currentMonthTxIds.slice(0, 1000); // supabase .in limit safeguard
      const { data: itemsData } = await supabase
        .from('transaction_items')
        .select('product_name, quantity')
        .in('transaction_id', idsToFetch);

      if (itemsData) {
        const itemMap: Record<string, number> = {};
        itemsData.forEach(item => {
          if (!itemMap[item.product_name]) itemMap[item.product_name] = 0;
          itemMap[item.product_name] += item.quantity;
        });

        const sortedItems = Object.entries(itemMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5); // top 5

        topItemsList = sortedItems.map((item, idx) => `${idx + 1}. ${item[0]} (${item[1]} porsi)`).join('\n  ');
      }
    }

    const systemPrompt = `You are an AI Manager Assistant for Samba Cafe.
You are talking to the Cafe Manager. Your job is to answer questions about the cafe's sales performance based on the following real-time data context.

=== REAL-TIME DATA CONTEXT ===
- Penjualan Hari Ini: Rp ${todayTotal.toLocaleString('id-ID')} (${todayCount} transaksi)
  - Via Cash: Rp ${todayCash.toLocaleString('id-ID')}
  - Via QRIS: Rp ${todayQRIS.toLocaleString('id-ID')}
- Kasir yang Bertugas Hari Ini: ${cashiersList}
- Penjualan Minggu Ini (sejak Minggu): Rp ${weekTotal.toLocaleString('id-ID')} (${weekCount} transaksi)
- Penjualan Bulan Ini: Rp ${monthTotal.toLocaleString('id-ID')} (${monthCount} transaksi)
  - 5 Menu Terlaris Bulan Ini:
  ${topItemsList || 'Belum ada data'}
- Penjualan Tahun Ini: Rp ${yearTotal.toLocaleString('id-ID')} (${yearCount} transaksi)
==============================

Rules:
- Answer nicely and professionally in Indonesian.
- Keep your answers concise, don't hallucinate numbers that are not in the context.
- DO NOT use markdown code blocks or JSON formatting. Just reply with a normal friendly text message.`;

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b', 
        messages: messages,
        temperature: 0.5,
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Groq API Error Details:', errorData, 'Status:', response.status);
      return NextResponse.json({ error: 'Failed to communicate with AI service: ' + errorData }, { status: response.status || 500 });
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    return NextResponse.json({ reply: assistantMessage });

  } catch (error: any) {
    console.error('AI Manager API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
