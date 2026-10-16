import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for storage uploads (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Safe filename
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const filename = `${Date.now()}-${safeFilename}`;
    const storagePath = `proofs/${filename}`;

    // Detect mime type
    const ext = safeFilename.split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      'image/jpeg';

    // Upload to Supabase Storage bucket "payment-proofs"
    const { error: uploadError } = await supabaseAdmin.storage
      .from('payment-proofs')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload proof: ' + uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('payment-proofs')
      .getPublicUrl(storagePath);

    const imageUrl = urlData.publicUrl;

    return NextResponse.json({
      success: true,
      imageUrl,
    });
  } catch (error: any) {
    console.error('Error uploading proof:', error);
    return NextResponse.json({ error: 'Failed to upload proof' }, { status: 500 });
  }
}
