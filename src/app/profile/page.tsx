'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProfilePage() {
  const { userName, role, login } = useAuth();
  
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    password: ''
  });

  useEffect(() => {
    if (userName) {
      fetchProfile();
    }
  }, [userName]);

  const fetchProfile = async () => {
    try {
      // Because we only store 'name' in localStorage/AuthContext currently, 
      // we use it to find the user.
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('name', userName)
        .eq('role', role)
        .single();
        
      if (data && !error) {
        setProfile(data);
        setEditForm({
          name: data.name || '',
          username: data.username || '',
          password: '' // Don't fill password
        });
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    
    try {
      let updateData = {
        name: editForm.name,
        username: editForm.username,
      } as any;
      
      if (editForm.password) {
        updateData.password = editForm.password;
      }
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', profile.id);
        
      if (error) throw error;
      
      alert('Profile updated successfully!');
      
      // Update local storage and context if name changed
      if (editForm.name !== userName) {
        login(role, editForm.name); // Updates context & localstorage
      }
      
      setEditForm(prev => ({ ...prev, password: '' })); // Clear password field
      
    } catch (err: any) {
      alert("Failed to update profile: " + err.message);
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4 lg:p-8 flex items-center justify-center min-h-[calc(100vh-80px)] lg:min-h-screen">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Your Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your account settings and credentials.</p>
      </div>
      
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>
            Update your personal information and login credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 max-w-md">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input 
                value={editForm.name} 
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="bg-background border-border"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input 
                value={editForm.username} 
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                className="bg-background border-border"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Input 
                value={role === 'manager' ? 'Manager / Admin' : 'Cashier'} 
                disabled
                className="bg-muted border-border cursor-not-allowed opacity-50 text-muted-foreground"
              />
            </div>

            <div className="space-y-2 pt-4 border-t border-border">
              <label className="text-sm font-medium">New Password</label>
              <Input 
                type="password"
                placeholder="Leave blank to keep current password"
                value={editForm.password} 
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                className="bg-background border-border"
              />
            </div>
            
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !editForm.name || !editForm.username}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full mt-4"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
