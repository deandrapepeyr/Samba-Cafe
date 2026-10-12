import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const expectedAmountStr = formData.get('expectedAmount') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Replace spaces and special chars in filename
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const filename = `${Date.now()}-${safeFilename}`;
    
    const uploadDir = path.join(process.cwd(), 'public', 'images', 'proofs');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, buffer);

    const imageUrl = `/images/proofs/${filename}`;

    // --- AI VERIFICATION (GEMINI) ---
    const apiKey = process.env.GEMINI_API_KEY;
    let aiVerification = null;
    
    if (apiKey && expectedAmountStr) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const expectedAmount = parseInt(expectedAmountStr);
        
        // Convert image to base64 for Gemini
        const base64Image = buffer.toString('base64');
        const mimeType = file.type || 'image/jpeg';
        
        const prompt = `
          Kamu adalah sistem verifikasi kasir otomatis di Indonesia.
          Perhatikan gambar bukti pembayaran (struk digital) ini. 
          Tugasmu adalah menganalisis gambar ini dan memberikan output dalam format JSON mentah tanpa markdown (\`\`\`).
          
          Cek hal berikut:
          1. Apakah ini benar gambar bukti pembayaran transfer/QRIS e-wallet/bank (GoPay, Dana, OVO, BCA, Livin, dll)?
          2. Apakah status transaksinya 'Berhasil' / 'Sukses'?
          3. Berapa nominal yang dibayarkan? Ekstrak angkanya saja.
          4. Apakah gambar ini terlihat seperti editan palsu yang kasar atau gambar acak/selfie?
          
          Nominal tagihan yang diharapkan adalah: Rp ${expectedAmount.toLocaleString('id-ID')}
          
          Format JSON yang harus kamu kembalikan persis seperti ini:
          {
            "is_valid": true atau false,
            "detected_amount": angka (contoh: 12000),
            "reason": "Penjelasan singkat dalam Bahasa Indonesia kenapa valid/tidak valid (misal: 'Nominal sesuai dan status berhasil')"
          }
        `;
        
        // Wrap the API call in a Promise.race to enforce an 8-second timeout
        const aiCall = ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
                prompt,
                { inlineData: { data: base64Image, mimeType: mimeType } }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("AI Request Timed Out (Server Google sedang penuh)")), 25000)
        );

        const response: any = await Promise.race([aiCall, timeoutPromise]);
        
        let responseText = response.text || "{}";
        // Clean markdown if present
        responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const aiResult = JSON.parse(responseText);
        aiVerification = aiResult;
      } catch (aiError: any) {
        console.error("AI Verification failed:", aiError);
        aiVerification = { error: "AI processing failed", details: aiError.message };
      }
    } else if (!apiKey) {
      console.log("GEMINI_API_KEY not found in environment. Skipping AI verification.");
    }

    return NextResponse.json({ 
      success: true, 
      imageUrl,
      ai_result: aiVerification
    });
  } catch (error: any) {
    console.error('Error uploading proof:', error);
    return NextResponse.json({ error: 'Failed to upload proof' }, { status: 500 });
  }
}
