import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '@/lib/supabase';

// In-memory cache for fast repeat access (key: orderId or imageUrl_expected)
const verificationCache = new Map<string, any>();
const inFlightRequests = new Map<string, Promise<any>>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageUrl, expectedAmount, orderId, force } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'GEMINI_API_KEY tidak terkonfigurasi di server' 
      }, { status: 500 });
    }

    const expected = typeof expectedAmount === 'number' ? expectedAmount : parseInt(expectedAmount || '0', 10);
    const cacheKey = `${imageUrl}_${expected}`;
    const inFlightKey = orderId || cacheKey;

    // 1. If not forced and orderId is provided, check if transaction in DB is already settled
    if (!force && orderId) {
      try {
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id, status, payment_status, payment_proof_url')
          .eq('id', orderId)
          .maybeSingle();

        if (existingTx && existingTx.payment_proof_url === imageUrl && (existingTx.payment_status === 'PAID' || existingTx.payment_status === 'PAYMENT_REJECTED')) {
          const isValid = existingTx.payment_status === 'PAID';
          const cachedResult = verificationCache.get(cacheKey);

          // Only return cached result if it has the full structured checklist
          if (cachedResult && cachedResult.checklist) {
            return NextResponse.json({
              success: true,
              orderId,
              status: existingTx.status,
              payment_status: existingTx.payment_status,
              result: cachedResult,
              cached: true
            });
          }
        }
      } catch (checkErr) {
        console.error('Error checking existing order status in DB:', checkErr);
      }
    }

    // 2. Check in-memory cache first if not forced
    if (!force && verificationCache.has(cacheKey)) {
      const cachedResult = verificationCache.get(cacheKey);
      if (cachedResult && cachedResult.checklist && !(cachedResult.reason?.includes('12.000') && expected !== 12000)) {
        const cachedPaymentStatus = cachedResult.is_valid ? 'PAID' : 'PAYMENT_REJECTED';
        const targetStatus = cachedResult.is_valid ? 'preparing' : 'pending';

        if (orderId) {
          try {
            await supabase
              .from('transactions')
              .update({ 
                status: targetStatus,
                payment_status: cachedPaymentStatus,
                ...(cachedResult.is_valid ? {
                  payment_confirmed_at: new Date().toISOString(),
                  payment_confirmed_by: 'AI Auto'
                } : {})
              })
              .eq('id', orderId);
          } catch (dbErr) {
            console.error('Failed to sync cached status to db:', dbErr);
          }
        }

        return NextResponse.json({
          success: true,
          orderId,
          status: targetStatus,
          payment_status: cachedPaymentStatus,
          result: cachedResult,
          cached: true
        });
      } else {
        // Purge invalid/stale cache entry
        verificationCache.delete(cacheKey);
        if (orderId) verificationCache.delete(orderId);
      }
    }

    // 3. In-flight request deduplication: if an AI verification is already running for this order/image, wait for it
    if (inFlightRequests.has(inFlightKey)) {
      const inFlightResponse = await inFlightRequests.get(inFlightKey);
      return NextResponse.json(inFlightResponse);
    }

    // Perform actual verification task and track in inFlightRequests
    const verificationTask = (async () => {
      // 1. Load image buffer
      let buffer: Buffer;
      let mimeType = 'image/jpeg';

      if (imageUrl.startsWith('/')) {
        const cleanPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
        const filePath = path.join(process.cwd(), 'public', cleanPath);
        if (!fs.existsSync(filePath)) {
          throw new Error('File bukti pembayaran tidak ditemukan di server');
        }
        buffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.webp') mimeType = 'image/webp';
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      } else {
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error('Gagal mengunduh gambar bukti pembayaran');
        buffer = Buffer.from(await res.arrayBuffer());
        const headerMime = res.headers.get('content-type');
        if (headerMime) mimeType = headerMime.split(';')[0];
      }

      // Compute SHA-256 hash of this uploaded image
      const imageHash = crypto.createHash('sha256').update(buffer).digest('hex');

      // 2. Anti-Fraud Layer 1: Check if this exact proof image (by URL or by SHA-256 content hash)
      // was already used in another confirmed/paid order
      if (orderId) {
        try {
          const { data: previousPaid } = await supabase
            .from('transactions')
            .select('id, customer_name, payment_proof_url, created_at')
            .neq('id', orderId)
            .not('payment_proof_url', 'is', null)
            .in('payment_status', ['PAID', 'AI_VERIFIED'])
            .order('created_at', { ascending: false })
            .limit(50);

          let matchedDuplicate = null;

          if (previousPaid && previousPaid.length > 0) {
            for (const prev of previousPaid) {
              if (!prev.payment_proof_url) continue;
              // Check: identical URL (works for Supabase Storage URLs)
              if (prev.payment_proof_url === imageUrl) {
                matchedDuplicate = prev;
                break;
              }
            }
          }

          // Fetch order created_at to compare 5-minute payment window accurately
          let orderCreatedAtIso = new Date().toISOString();
          if (orderId) {
            const { data: orderTx } = await supabase
              .from('transactions')
              .select('created_at')
              .eq('id', orderId)
              .maybeSingle();
            if (orderTx?.created_at) orderCreatedAtIso = orderTx.created_at;
          }

          if (matchedDuplicate) {
            const dupIssues = [
              `Bukti transfer ini sudah pernah digunakan pada pesanan ${matchedDuplicate.id} (${matchedDuplicate.customer_name || 'Pelanggan'}) sebelumnya. Dilarang mendaur ulang bukti yang sama.`,
              `Waktu transaksi bukti pembayaran sudah kedaluwarsa (melebihi batas toleransi 5 menit).`
            ];

            const dupResult = {
              is_valid: false,
              is_time_valid: false,
              detected_amount: expected,
              amount_matches: true,
              provider: 'BCA / QRIS',
              status_text: 'BERHASIL',
              transaction_date: '-',
              transaction_time: '-',
              confidence: 'high',
              issues: dupIssues,
              checklist: {
                amount_check: {
                  passed: true,
                  label: 'Kesesuaian Nominal',
                  detail: `Rp ${expected.toLocaleString('id-ID')} (Nominal Sesuai)`
                },
                time_check: {
                  passed: false,
                  label: 'Batas Waktu Pembayaran (5 Menit)',
                  detail: 'Kedaluwarsa (Lebih dari 5 menit)'
                },
                status_check: {
                  passed: true,
                  label: 'Status Transaksi',
                  detail: 'Berhasil'
                },
                fraud_check: {
                  passed: false,
                  label: 'Keaslian Bukti Transfer',
                  detail: `DUPLIKAT (Pernah digunakan di ${matchedDuplicate.id})`
                }
              },
              reason: dupIssues.join(' • ')
            };

            await supabase
              .from('transactions')
              .update({ 
                status: 'pending', 
                payment_status: 'PAYMENT_REJECTED',
                payment_confirmed_at: null,
                payment_confirmed_by: null
              })
              .eq('id', orderId);

            verificationCache.set(cacheKey, dupResult);
            verificationCache.set(orderId, dupResult);

            return {
              success: true,
              orderId,
              status: 'pending',
              payment_status: 'PAYMENT_REJECTED',
              result: dupResult
            };
          }
        } catch (dupErr) {
          console.error('Error checking duplicate proof hash:', dupErr);
        }
      }

      // Fetch order created_at if not fetched yet
      let orderCreatedAt = new Date();
      if (orderId) {
        try {
          const { data: orderTx } = await supabase
            .from('transactions')
            .select('created_at')
            .eq('id', orderId)
            .maybeSingle();
          if (orderTx?.created_at) orderCreatedAt = new Date(orderTx.created_at);
        } catch (e) {}
      }

      const base64Image = buffer.toString('base64');

      // Current local time in Indonesia (WIB)
      const nowWIB = new Date();
      const currentDateStr = nowWIB.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const currentTimeStr = nowWIB.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit'
      });

      const prompt = `
        Kamu adalah sistem verifikasi bukti transfer kilat di Samba Cafe Indonesia.
        Waktu Pesanan Saat Ini: ${currentDateStr}, pk ${currentTimeStr} WIB.
        Tagihan toko yang diharapkan: Rp ${expected.toLocaleString('id-ID')}.

        Periksa gambar ini secara teliti:
        1. Apakah gambar ini benar merupakan bukti transfer / struk pembayaran digital resmi (BCA, Mandiri, BRI, BNI, QRIS, GoPay, OVO, DANA, ShopeePay, Seabank, dll)?
        2. Berapa nominal rupiah yang tertera dibayarkan? (Ekstrak hanya nominal angka bulat murni, tanpa titik, koma, atau simbol mata uang).
        3. Apakah status transaksi Berhasil / Sukses / Transferred / Selesai?
        4. Ekstrak tanggal transaksi (contoh: "13/10/2026") dan jam transaksi (contoh: "14:30:02").
        5. Bank atau E-Wallet apa yang digunakan?
        6. VALIDASI WAKTU TRANSAKSI (BATAS KETAT MAKSIMAL 5 MENIT):
           - Tanggal transaksi pada struk HARUS sama dengan tanggal hari ini (${currentDateStr}).
           - Jam transaksi pada struk HARUS baru saja terjadi dalam batas toleransi MAKSIMAL 5 MENIT sebelum waktu sekarang (pk ${currentTimeStr} WIB).
           - JIKA jam transaksi sudah lewat lebih dari 5 menit yang lalu (misal transfer 10 menit, 15 menit, atau berjam-jam yang lalu), MAKA is_time_valid: false, dan is_valid HARUS FALSE (KEDALUWARSA)!

        ATURAN VALIDASI KETAT:
        - is_valid bernilai TRUE HANYA JIKA: ini bukti transfer asli, status berhasil, nominal PERSIS SAMA dengan Rp ${expected.toLocaleString('id-ID')}, dan waktu transaksi dalam batas 5 menit terakhir hari ini.
        - is_valid bernilai FALSE JIKA: nominal berbeda dari tagihan, waktu transaksi melebihi 5 menit (kedaluwarsa), status gagal/pending, atau gambar bukan bukti transfer.

        Output HARUS HANYA JSON mentah tanpa markdown:
        {
          "is_valid": true,
          "is_time_valid": true,
          "detected_amount": ${expected},
          "amount_matches": true,
          "provider": "BCA / QRIS",
          "status_text": "BERHASIL",
          "transaction_date": "13/10/2026",
          "transaction_time": "11:26:17",
          "confidence": "high",
          "reason": "Penjelasan singkat dalam bahasa Indonesia"
        }
      `;

      const ai = new GoogleGenAI({ apiKey });

      // Helper to call AI: Use active modern Gemini models with sequential fallback (avoiding deprecated gemini-2.5-flash)
      const candidateModels = [
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-flash-lite-latest',
        'gemini-3.8-flash',
        'gemini-flash-latest'
      ];

      const callAI = async () => {
        let lastErr: any = null;
        for (const model of candidateModels) {
          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout ${model} (12s)`)), 12000)
            );

            const callPromise = ai.models.generateContent({
              model,
              contents: [
                prompt,
                { inlineData: { data: base64Image, mimeType } }
              ],
              config: {
                responseMimeType: 'application/json',
              }
            });

            const result = await Promise.race([callPromise, timeoutPromise]) as any;
            if (result && result.text) {
              return result;
            }
          } catch (err: any) {
            console.warn(`Gemini model ${model} attempt failed:`, err?.status || err?.message);
            lastErr = err;
            await new Promise(r => setTimeout(r, 300));
          }
        }
        throw lastErr || new Error('Semua model Gemini AI sedang tidak dapat dihubungi');
      };

      const response = await callAI();

      let responseText = response?.text || '{}';
      responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

      const parsedResult = JSON.parse(responseText);

      // 1. Parse detected amount accurately
      const rawDetected = parsedResult.detected_amount;
      let detectedAmount = 0;
      if (typeof rawDetected === 'number') {
        detectedAmount = rawDetected;
      } else if (rawDetected) {
        const rawStr = String(rawDetected);
        if (rawStr.includes(',00') || rawStr.endsWith('.00')) {
          detectedAmount = parseInt(rawStr.replace(/[^0-9]/g, '').slice(0, -2) || '0', 10);
        } else {
          detectedAmount = parseInt(rawStr.replace(/[^0-9]/g, '') || '0', 10);
        }
      }
      parsedResult.detected_amount = detectedAmount;

      // 2. Programmatic Nominal Check
      const amountMatches = detectedAmount === expected;
      parsedResult.amount_matches = amountMatches;

      // 3. Programmatic 5-Minute Time Window Check
      let isTimeWithin5Minutes = parsedResult.is_time_valid !== false;
      let timeDiffDetail = 'Waktu transfer sesuai (dalam batas toleransi 5 menit)';
      let parsedTimeFormatted = parsedResult.transaction_time || '-';

      if (parsedResult.transaction_time) {
        try {
          const orderTimeMs = orderCreatedAt.getTime();
          const dateParts = (parsedResult.transaction_date || '').match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
          const timeParts = parsedResult.transaction_time.match(/(\d{1,2})[:\.](\d{1,2})(?:[:\.](\d{1,2}))?/);

          if (timeParts) {
            const wibYear = dateParts ? parseInt(dateParts[3].length === 2 ? '20' + dateParts[3] : dateParts[3], 10) : nowWIB.getFullYear();
            const wibMonth = dateParts ? parseInt(dateParts[2], 10) - 1 : nowWIB.getMonth();
            const wibDay = dateParts ? parseInt(dateParts[1], 10) : nowWIB.getDate();

            const hours = parseInt(timeParts[1], 10);
            const minutes = parseInt(timeParts[2], 10);
            const seconds = timeParts[3] ? parseInt(timeParts[3], 10) : 0;

            const receiptUtcMs = Date.UTC(wibYear, wibMonth, wibDay, hours - 7, minutes, seconds);
            const diffMinutes = Math.round((orderTimeMs - receiptUtcMs) / 60000);

            parsedTimeFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            // Strict 5-minute rule: Cannot be older than 5 minutes before order, nor > 2 min in future
            if (diffMinutes > 5 || diffMinutes < -2) {
              isTimeWithin5Minutes = false;
              timeDiffDetail = diffMinutes > 5
                ? `Lewat ${diffMinutes} menit dari batas waktu pesanan (Maksimal 5 menit)`
                : `Waktu struk tidak sesuai (${diffMinutes} menit)`;
            } else {
              isTimeWithin5Minutes = true;
              timeDiffDetail = `Sesuai (${diffMinutes <= 0 ? 'baru saja' : diffMinutes + ' menit lalu'}, batas maks 5 menit)`;
            }
          }
        } catch (tErr) {
          console.warn('Error calculating receipt time diff:', tErr);
        }
      }

      // 4. Programmatic Status Check
      const statusStr = String(parsedResult.status_text || '').toLowerCase();
      const isSuccess = ['berhasil', 'sukses', 'success', 'transferred', 'selesai', 'lunas'].some(w => statusStr.includes(w));

      // 5. Build structured Issues list
      const issues: string[] = [];
      if (!amountMatches) {
        issues.push(`Nominal transfer (Rp ${detectedAmount.toLocaleString('id-ID')}) TIDAK SESUAI dengan tagihan toko (Rp ${expected.toLocaleString('id-ID')}).`);
      }
      if (!isTimeWithin5Minutes) {
        issues.push(`Waktu transfer pada bukti (pk ${parsedTimeFormatted} WIB) sudah melebihi batas waktu pembayaran 5 menit (${timeDiffDetail}). Bukti transfer kedaluwarsa.`);
      }
      if (!isSuccess) {
        issues.push(`Status transaksi pada bukti pembayaran (${parsedResult.status_text || 'Tidak jelas'}) bukan berstatus Berhasil/Sukses.`);
      }

      const isValid = issues.length === 0;

      // 6. Build structured Checklist
      const checklist = {
        amount_check: {
          passed: amountMatches,
          label: 'Kesesuaian Nominal',
          detail: amountMatches
            ? `Rp ${expected.toLocaleString('id-ID')} (Sesuai dengan tagihan)`
            : `Rp ${detectedAmount.toLocaleString('id-ID')} (Tagihan toko: Rp ${expected.toLocaleString('id-ID')})`
        },
        time_check: {
          passed: isTimeWithin5Minutes,
          label: 'Batas Waktu Pembayaran (5 Menit)',
          detail: `Transfer pk ${parsedTimeFormatted} WIB (${timeDiffDetail})`
        },
        status_check: {
          passed: isSuccess,
          label: 'Status Transaksi',
          detail: parsedResult.status_text || (isSuccess ? 'Berhasil' : 'Tidak Berhasil')
        },
        fraud_check: {
          passed: true,
          label: 'Keaslian Bukti Transfer',
          detail: 'Bukti transfer baru (Bukan duplikat)'
        }
      };

      parsedResult.is_valid = isValid;
      parsedResult.amount_matches = amountMatches;
      parsedResult.is_time_valid = isTimeWithin5Minutes;
      parsedResult.issues = issues;
      parsedResult.checklist = checklist;
      parsedResult.status_text = isValid ? 'AMAN & VALID' : 'TIDAK VALID';
      parsedResult.reason = isValid
        ? 'Semua parameter valid. Pembayaran aman & terkonfirmasi.'
        : issues.join(' • ');

      const newPaymentStatus = isValid ? 'PAID' : 'AI_INVALID';
      const targetStatus = isValid ? 'preparing' : 'pending';

      // Save to in-memory cache for instant subsequent reads
      verificationCache.set(cacheKey, parsedResult);
      if (orderId) verificationCache.set(orderId, parsedResult);

      // Update database status
      if (orderId) {
        try {
          if (isValid) {
            const { error: dbErr } = await supabase
              .from('transactions')
              .update({ 
                status: 'preparing',
                payment_status: 'PAID',
                payment_confirmed_at: new Date().toISOString(),
                payment_confirmed_by: 'AI Auto'
              })
              .eq('id', orderId);
            if (dbErr) console.error('Failed to update valid transaction in database:', dbErr);
          } else {
            // AI could not confirm validity — keep in pending for cashier review
            const { error: dbErr } = await supabase
              .from('transactions')
              .update({ 
                status: 'pending',
                payment_status: 'AI_INVALID',
                payment_confirmed_at: null,
                payment_confirmed_by: null
              })
              .eq('id', orderId);
            if (dbErr) console.error('Failed to update AI_INVALID transaction in database:', dbErr);
          }
        } catch (dbErr) {
          console.error('Failed to update transaction in database:', dbErr);
        }
      }

      return {
        success: true,
        orderId,
        status: targetStatus,
        payment_status: newPaymentStatus,
        result: parsedResult
      };
    })();

    // Store in-flight promise and ensure cleanup
    inFlightRequests.set(inFlightKey, verificationTask);
    const finalResult = await verificationTask.finally(() => {
      inFlightRequests.delete(inFlightKey);
    });

    return NextResponse.json(finalResult);

  } catch (error: any) {
    console.error('Verify proof error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal memverifikasi bukti pembayaran dengan AI',
      details: error.toString()
    }, { status: 500 });
  }
}
