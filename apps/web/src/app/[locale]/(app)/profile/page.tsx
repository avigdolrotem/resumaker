'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Save, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/lib/auth-client';

export default function ProfilePage() {
  const { data: session, refetch } = useSession();
  const router = useRouter();
  const [name, setName] = useState(session?.user.name ?? '');
  const [locale, setLocale] = useState<'he' | 'en'>('he');
  const [saving, setSaving] = useState(false);

  if (!session) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, locale }),
      });
      if (res.ok) {
        toast.success('Profile updated');
        await refetch?.();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Update failed');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-neutral-600">Manage your account preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Personal info
          </CardTitle>
          <CardDescription>How we display you in the app + emails</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={1}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={session.user.email} disabled dir="ltr" />
              <p className="text-xs text-neutral-500">
                Changing your email requires a verification step — coming soon.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locale">Default language</Label>
              <select
                id="locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value as 'he' | 'en')}
                className="focus:ring-brand-500 flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
              >
                <option value="he">עברית (Hebrew)</option>
                <option value="en">English</option>
              </select>
              <p className="text-xs text-neutral-500">
                Used for emails (verification, welcome). The UI follows the URL.
              </p>
            </div>

            <Button type="submit" disabled={saving}>
              <Save className="me-2 h-4 w-4" />
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-600">Email verified</span>
            <span>
              {session.user.emailVerified ? (
                <span className="text-emerald-600">✓ Yes</span>
              ) : (
                <span className="text-amber-600">Not yet</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600">Member since</span>
            <span dir="ltr">{new Date(session.user.createdAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
