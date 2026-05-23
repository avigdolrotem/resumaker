'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession, signOut } from '@/lib/auth-client';
import { useRouter, Link } from '@/i18n/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleSignOutAll() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  async function handleExportData() {
    setExporting(true);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) {
        toast.error('Export failed', { description: 'Please try again.' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resumaker-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export ready', { description: 'Your data has been downloaded.' });
    } catch (err) {
      toast.error('Export failed', { description: (err as Error).message });
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Account deleted');
        router.push('/');
        router.refresh();
      } else {
        toast.error('Could not delete account', { description: 'Please contact support.' });
      }
    } catch (err) {
      toast.error('Network error', { description: (err as Error).message });
    } finally {
      setDeleting(false);
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
          <CardTitle>Billing</CardTitle>
          <CardDescription>Manage your subscription and view usage</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/account/billing">Open billing settings</Link>
          </Button>
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

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Download everything we have about your account (GDPR + Israeli Privacy Law)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleExportData} disabled={exporting}>
            {exporting ? 'Preparing…' : 'Export my data'}
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
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Yes, delete my account'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
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
