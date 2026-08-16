'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Coffee, Lock, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    
    // Real login logic using Supabase 'users' table
    const { data, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${username},name.eq.${username}`)
      .eq('password', password)
      .single();

    if (fetchError || !data) {
      setError('Invalid username or password.');
      setIsLoggingIn(false);
    } else {
      login(data.role as 'manager' | 'cashier', data.name);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-500">
        
        <div className="p-8 text-center bg-primary/10 border-b border-primary/20">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/30">
            <Coffee size={40} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Samba Cafe</h1>
          <p className="text-muted-foreground mt-2">Smart Point of Sale System</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Welcome Back!</h2>
            <p className="text-sm text-muted-foreground">Please sign in to your account.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input 
                  type="text"
                  required
                  placeholder="manager atau cashier"
                  className="pl-10 h-12 bg-background border-border"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input 
                  type="password"
                  required
                  placeholder="••••••••"
                  className="pl-10 h-12 bg-background border-border"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-lg bg-primary text-primary-foreground hover:bg-primary/90 mt-6">
              Sign In
            </Button>
          </form>
          
          <div className="bg-muted p-4 rounded-lg text-xs text-muted-foreground space-y-2 text-center">
            <p className="font-semibold">Test Accounts:</p>
            <p>Manager: manager / admin123</p>
            <p>Cashier: sheera / password123</p>
          </div>
        </div>
        
        <div className="p-4 bg-muted/50 text-center border-t border-border">
          <p className="text-xs text-muted-foreground">© 2026 Samba Cafe POS. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
