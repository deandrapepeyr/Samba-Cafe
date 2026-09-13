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

    // Fetch all transactions from the start of the month to avoid multiple queries
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('total, created_at, method')
      .gte('created_at', monthStart);

    if (error) {
      console.error("Supabase fetch error:", error);
      throw new Error("Failed to fetch transaction data");
    }

    let todayTotal = 0;
    let todayCount = 0;
    let weekTotal = 0;
    let weekCount = 0;
    let monthTotal = 0;
    let monthCount = 0;

    transactions?.forEach(tx => {
      const txDate = new Date(tx.created_at);
      
      // Month
      monthTotal += tx.total;
      monthCount++;

      // Week
      if (txDate >= weekStart) {
        weekTotal += tx.total;
        weekCount++;
      }

      // Today
      if (txDate >= new Date(todayStr)) {
        todayTotal += tx.total;
        todayCount++;
      }
    });

    const systemPrompt = `You are an AI Manager Assistant for Samba Cafe.
You are talking to the Cafe Manager. Your job is to answer questions about the cafe's sales performance based on the following real-time data context.

=== REAL-TIME DATA CONTEXT ===
- Penjualan Hari Ini: Rp ${todayTotal.toLocaleString('id-ID')} (${todayCount} transaksi)
- Penjualan Minggu Ini (sejak Minggu): Rp ${weekTotal.toLocaleString('id-ID')} (${weekCount} transaksi)
- Penjualan Bulan Ini: Rp ${monthTotal.toLocaleString('id-ID')} (${monthCount} transaksi)
==============================

Rules:
- Answer nicely and professionally in Indonesian.
- Keep your answers concise, don't hallucinate numbers that are not in the context.
- If asked about top products or things not in the context, politely apologize and say you only have access to total sales data right now.
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
        model: 'llama3-70b-8192', 
        messages: messages,
        temperature: 0.5,
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Groq API Error:', errorData);
      return NextResponse.json({ error: 'Failed to communicate with AI service' }, { status: 500 });
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    return NextResponse.json({ reply: assistantMessage });

  } catch (error: any) {
    console.error('AI Manager API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
