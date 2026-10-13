async function check() {
  const res = await fetch('http://localhost:3000/api/verify-proof', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: 'C_261013_0004',
      imageUrl: '/images/proofs/1791866601219-WhatsAppImage2026-10-13at11.26.28.jpg',
      expectedAmount: 2000,
      force: false
    })
  });
  const data = await res.json();
  console.log('Result:', JSON.stringify(data, null, 2));
}

check();
