'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession, signOut } from '@/lib/auth-client';
import { useRouter, Link } from '@/i18n/navigation';

/**
 * Settings page — sign-out-all, GDPR export, account deletion.
 *
 * Was 100% hardcoded English even though `settings.*` keys already exist
 * in both he.json and en.json (added in a prior session). This rewrite
 * just wires the existing translations.
 */
export default function SettingsPage() {
  const t = useTranslations('settings');
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
        toast.error(t('yourData.exportFailed'));
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
      toast.success(t('yourData.exportSuccess'));
    } catch (err) {
      toast.error(t('yourData.exportFailed'), { description: (err as Error).message });
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
        toast.success(t('danger.deleted'));
        router.push('/');
        router.refresh();
      } else {
        toast.error(t('danger.deleteFailed'));
      }
    } catch (err) {
      toast.error(t('danger.deleteFailed'), { description: (err as Error).message });
    } finally {
      setDeleting(false);
    }
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">{t('title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
          <CardDescription>{t('profile.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('profile.name')}</Label>
            <Input defaultValue={session.user.name ?? ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>{t('profile.email')}</Label>
            <Input defaultValue={session.user.email} disabled dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>{t('profile.memberSince')}</Label>
            <Input defaultValue={new Date(session.user.createdAt).toLocaleDateString()} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('billing.title')}</CardTitle>
          <CardDescription>{t('billing.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/account/billing">{t('billing.open')}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sessions.title')}</CardTitle>
          <CardDescription>{t('sessions.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOutAll}>
            {t('sessions.signOutAll')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('yourData.title')}</CardTitle>
          <CardDescription>{t('yourData.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleExportData} disabled={exporting}>
            {exporting ? `${t('yourData.export')}…` : t('yourData.export')}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">{t('danger.title')}</CardTitle>
          <CardDescription>{t('danger.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-red-700">{t('danger.confirmDescription')}</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? t('danger.deleting') : t('danger.confirmYes')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  {t('danger.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" onClick={handleDeleteAccount}>
              {t('danger.deleteAccount')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
