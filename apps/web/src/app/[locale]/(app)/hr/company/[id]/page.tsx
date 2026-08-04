'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { HrEditCompanyForm } from '@/components/hr/hr-edit-company-form';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Member {
  id: string;
  role: string;
  user: { id: string; email: string; name: string | null };
}

interface Company {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  websiteUrl: string | null;
  verified: boolean;
  companyMembers: Member[];
}

export default function CompanyDetailPage() {
  const { id, locale } = useParams<{ id: string; locale: string }>();
  const isHe = locale === 'he';
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'recruiter' | 'viewer'>('recruiter');
  const [inviteSending, setInviteSending] = useState(false);
  const [status, setStatus] = useState('');

  // In an effect, not during render. This used to call load() straight
  // from the render body guarded by `if (!company && !loading)` — so a
  // request that failed left company null, flipped loading back to
  // false, and immediately re-triggered itself. A bad or unknown id
  // didn't show "not found", it spun on "Loading…" while refetching
  // forever.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/companies/${id}`);
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const data = (await res.json()) as { company: Company };
      setCompany(data.company);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteSending(true);
    try {
      const res = await fetch(`/api/hr/companies/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        setStatus(isHe ? 'ההזמנה נשלחה' : 'Invite sent');
        setInviteEmail('');
        void load();
      } else {
        const data = (await res.json()) as { error: string };
        setStatus(data.error ?? (isHe ? 'שגיאה' : 'Error'));
      }
    } finally {
      setInviteSending(false);
    }
  }

  async function handleKick(memberId: string) {
    await fetch(`/api/hr/companies/${id}/members/${memberId}`, { method: 'DELETE' });
    void load();
  }

  if (loading && !company && !failed) {
    return <p className="text-muted-foreground p-6">{isHe ? 'טוען…' : 'Loading…'}</p>;
  }

  if (!company) {
    return (
      <p className="text-muted-foreground p-6">{isHe ? 'החברה לא נמצאה.' : 'Company not found.'}</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{company.name}</h1>
        {/* The badge existed on public job cards but never here, so an
            employer had no way to see their own verification state — the
            one place they'd go to fix it. */}
        {company.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
            <BadgeCheck className="h-3.5 w-3.5" />
            {isHe ? 'מאומת' : 'Verified'}
          </span>
        ) : (
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {isHe ? 'לא מאומת' : 'Not verified'}
          </span>
        )}
      </div>
      {company.description && <p className="text-muted-foreground">{company.description}</p>}
      {company.websiteUrl && (
        <a
          href={company.websiteUrl}
          className="hover:text-brand-600 text-sm text-blue-600 underline transition-colors duration-200"
          target="_blank"
          rel="noreferrer"
        >
          {company.websiteUrl}
        </a>
      )}

      <HrEditCompanyForm
        company={{
          id: company.id,
          name: company.name,
          description: company.description,
          websiteUrl: company.websiteUrl,
          verified: company.verified,
        }}
        isHe={isHe}
        onSaved={(updated) => setCompany((prev) => (prev ? { ...prev, ...updated } : prev))}
      />

      {/* Member list — glass-subtle, flat rows (scannable list, not chrome) */}
      <div className="glass-subtle overflow-hidden rounded-2xl">
        <CardHeader>
          <CardTitle>{isHe ? 'חברי הצוות' : 'Team members'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {company.companyMembers.map((m) => (
            <div
              key={m.id}
              className="hover:bg-accent/40 -mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                <p className="text-muted-foreground text-xs">{m.role}</p>
              </div>
              {m.role !== 'owner' && (
                <Button size="sm" variant="destructive" onClick={() => handleKick(m.id)}>
                  {isHe ? 'הסר' : 'Remove'}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isHe ? 'הזמן חבר צוות' : 'Invite a team member'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleInvite(e)} className="space-y-3">
            <div>
              <Label htmlFor="email">{isHe ? 'דוא״ל' : 'Email'}</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="role">{isHe ? 'תפקיד' : 'Role'}</Label>
              <select
                id="role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'recruiter' | 'viewer')}
                className="border-input bg-background/60 focus-visible:border-brand-400/60 focus-visible:ring-brand-500/18 ease-smooth block w-full rounded-xl border px-3.5 py-2 text-sm backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4"
              >
                <option value="recruiter">{isHe ? 'מגייס' : 'Recruiter'}</option>
                <option value="viewer">{isHe ? 'צופה' : 'Viewer'}</option>
              </select>
            </div>
            <Button type="submit" disabled={inviteSending}>
              {inviteSending ? (isHe ? 'שולח…' : 'Sending…') : isHe ? 'שלח הזמנה' : 'Send invite'}
            </Button>
            {status && <p className="text-muted-foreground text-sm">{status}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
