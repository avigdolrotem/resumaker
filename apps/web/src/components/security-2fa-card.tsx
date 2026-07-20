'use client';

/**
 * Security 2FA Card — renders inside the Security tab of /settings.
 *
 * States:
 *  - not-enrolled: shows "Enable 2FA" button
 *  - enrolling:    shows QR code + backup codes + TOTP confirm input
 *  - enrolled:     shows green "2FA is on" badge, backup-code reveal, disable button
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Step = 'idle' | 'enrolling' | 'enrolled';

interface EnrollData {
  totpURI: string;
  backupCodes: string[];
}

interface Security2FACardProps {
  /** Pass true when the current session user already has 2FA enabled. */
  initialEnabled?: boolean;
}

export function Security2FACard({ initialEnabled = false }: Security2FACardProps) {
  const t = useTranslations('settings.twoFactor');
  const [step, setStep] = useState<Step>(initialEnabled ? 'enrolled' : 'idle');
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEnable() {
    if (!password) {
      toast.error(t('enablePasswordRequired'));
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.twoFactor.enable({ password });
      if (result.error) {
        toast.error(result.error.message ?? t('enableFailed'));
        return;
      }
      setEnrollData({ totpURI: result.data.totpURI, backupCodes: result.data.backupCodes });
      setBackupCodes(result.data.backupCodes);
      setPassword('');
      setStep('enrolling');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (totpCode.length !== 6) {
      toast.error(t('codeRequired'));
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: totpCode });
      if (result.error) {
        toast.error(result.error.message ?? t('invalidCode'));
        return;
      }
      toast.success(t('verifySuccess'));
      setTotpCode('');
      setEnrollData(null);
      setStep('enrolled');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (!password) {
      toast.error(t('disablePasswordRequired'));
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.twoFactor.disable({ password });
      if (result.error) {
        toast.error(result.error.message ?? t('disableFailed'));
        return;
      }
      toast.success(t('disableSuccess'));
      setPassword('');
      setBackupCodes(null);
      setShowBackupCodes(false);
      setStep('idle');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{t('title')}</CardTitle>
          {step === 'enrolled' && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {t('badgeOn')}
            </span>
          )}
        </div>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── IDLE: not enrolled ── */}
        {step === 'idle' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="2fa-password-enable">{t('currentPassword')}</Label>
              <Input
                id="2fa-password-enable"
                type="password"
                autoComplete="current-password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button onClick={handleEnable} disabled={loading}>
              {loading ? t('starting') : t('enable')}
            </Button>
          </div>
        )}

        {/* ── ENROLLING: show QR + backup codes + verify form ── */}
        {step === 'enrolling' && enrollData && (
          <div className="space-y-5">
            <p className="text-muted-foreground text-sm">{t('scanInstructions')}</p>

            <div className="flex justify-center rounded-lg border p-4">
              <QRCodeSVG value={enrollData.totpURI} size={180} />
            </div>

            <details className="text-muted-foreground text-xs">
              <summary className="cursor-pointer">{t('cantScan')}</summary>
              <p className="mt-1 break-all font-mono">{enrollData.totpURI}</p>
            </details>

            {backupCodes && (
              <div className="bg-muted space-y-1 rounded-md p-3">
                <p className="text-sm font-medium">{t('backupCodesTitle')}</p>
                <p className="text-muted-foreground text-xs">{t('backupCodesDescription')}</p>
                <ul className="mt-2 grid grid-cols-2 gap-1">
                  {backupCodes.map((code) => (
                    <li key={code} className="font-mono text-xs">
                      {code}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="2fa-totp-code">{t('authenticatorCode')}</Label>
              <Input
                id="2fa-totp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleVerify} disabled={loading}>
                {loading ? t('verifying') : t('confirmEnable')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('idle');
                  setEnrollData(null);
                  setTotpCode('');
                }}
                disabled={loading}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* ── ENROLLED: management view ── */}
        {step === 'enrolled' && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">{t('protectedText')}</p>

            <Button variant="outline" size="sm" onClick={() => setShowBackupCodes((v) => !v)}>
              {showBackupCodes ? t('hideBackupCodes') : t('showBackupCodes')}
            </Button>

            {showBackupCodes && backupCodes && (
              <div className="bg-muted rounded-md p-3">
                <ul className="grid grid-cols-2 gap-1">
                  {backupCodes.map((code) => (
                    <li key={code} className="font-mono text-xs">
                      {code}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="2fa-password-disable">{t('disablePasswordLabel')}</Label>
              <Input
                id="2fa-password-disable"
                type="password"
                autoComplete="current-password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button variant="destructive" onClick={handleDisable} disabled={loading}>
              {loading ? t('disabling') : t('disable')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
