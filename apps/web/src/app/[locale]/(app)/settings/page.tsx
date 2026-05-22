'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession, signOut } from '@/lib/auth-client';
import { useRouter } from '@/i18n/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSignOutAll() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  async function handleDeleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const res = await fetch('/api/account', { method: 'DELETE' });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      alert('Delete failed');
    }
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input defaultValue={session.user.name ?? ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue={session.user.email} disabled dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>Member since</Label>
            <Input defaultValue={new Date(session.user.createdAt).toLocaleDateString()} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Sign out from all devices</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOutAll}>
            Sign out everywhere
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Danger zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-red-700">
                Are you sure? This will permanently delete your account, resumes, and history.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
                  Yes, delete my account
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete my account
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
