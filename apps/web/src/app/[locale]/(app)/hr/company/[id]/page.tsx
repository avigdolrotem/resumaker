'use client';

import { useState } from 'react';
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
  companyMembers: Member[];
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'recruiter' | 'viewer'>('recruiter');
  const [inviteSending, setInviteSending] = useState(false);
  const [status, setStatus] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/companies/${id}`);
      if (res.ok) {
        const data = (await res.json()) as { company: Company };
        setCompany(data.company);
      }
    } finally {
      setLoading(false);
    }
  }

  // Load on mount using useEffect-equivalent via server action pattern
  if (!company && !loading) {
    void load();
  }

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
        setStatus('Invite sent');
        setInviteEmail('');
        void load();
      } else {
        const data = (await res.json()) as { error: string };
        setStatus(data.error ?? 'Error');
      }
    } finally {
      setInviteSending(false);
    }
  }

  async function handleKick(memberId: string) {
    await fetch(`/api/hr/companies/${id}/members/${memberId}`, { method: 'DELETE' });
    void load();
  }

  if (loading && !company) {
    return <p className="p-6 text-neutral-500">Loading…</p>;
  }

  if (!company) {
    return <p className="p-6 text-neutral-500">Company not found.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{company.name}</h1>
      {company.description && <p className="text-neutral-600">{company.description}</p>}
      {company.websiteUrl && (
        <a
          href={company.websiteUrl}
          className="text-sm text-blue-600 underline"
          target="_blank"
          rel="noreferrer"
        >
          {company.websiteUrl}
        </a>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {company.companyMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                <p className="text-xs text-neutral-500">{m.role}</p>
              </div>
              {m.role !== 'owner' && (
                <Button size="sm" variant="destructive" onClick={() => handleKick(m.id)}>
                  Remove
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite a team member</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleInvite(e)} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'recruiter' | 'viewer')}
                className="border-input bg-background block w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="recruiter">Recruiter</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <Button type="submit" disabled={inviteSending}>
              {inviteSending ? 'Sending…' : 'Send invite'}
            </Button>
            {status && <p className="text-sm text-neutral-600">{status}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
