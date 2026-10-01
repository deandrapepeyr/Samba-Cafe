export interface CustomerSession {
  sessionId: string;
  customerName: string;
  createdAt: number;
}

const SESSION_KEY = 'samba_customer_session';

export function getCustomerSession(): CustomerSession | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  
  try {
    const session: CustomerSession = JSON.parse(stored);
    // Optional: session expiry logic (e.g., expire after 24 hours)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - session.createdAt > ONE_DAY) {
      clearCustomerSession();
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

export function createCustomerSession(customerName: string): CustomerSession {
  // Generate a random, hard-to-guess session ID
  const sessionId = Array.from({ length: 16 }, () => 
    Math.floor(Math.random() * 36).toString(36)
  ).join('').toUpperCase();

  const session: CustomerSession = {
    sessionId,
    customerName,
    createdAt: Date.now()
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return session;
}

export function clearCustomerSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}
