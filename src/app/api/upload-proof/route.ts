import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

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

    return NextResponse.json({ 
      success: true, 
      imageUrl
    });
  } catch (error: any) {
    console.error('Error uploading proof:', error);
    return NextResponse.json({ error: 'Failed to upload proof' }, { status: 500 });
  }
}

