'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface MaintenanceState {
  enabled: boolean;
  message: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export default function AdminMaintenancePage() {
  const [state, setState] = useState<MaintenanceState>({
    enabled: false,
    message: '',
    scheduledStart: null,
    scheduledEnd: null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch('/api/admin/maintenance')
      .then((r) => r.json())
      .then((d: { state: MaintenanceState }) => {
        if (d.state) setState(d.state);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Maintenance Mode</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance settings</CardTitle>
          <CardDescription>
            When enabled, visitors see a maintenance page instead of the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                id="enabled"
                type="checkbox"
                checked={state.enabled}
                onChange={(e) => setState((s) => ({ ...s, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <Label htmlFor="enabled" className="cursor-pointer font-medium">
                Maintenance mode enabled
              </Label>
            </div>

            <div>
              <Label htmlFor="message">Message (shown to visitors)</Label>
              <Textarea
                id="message"
                value={state.message ?? ''}
                onChange={(e) => setState((s) => ({ ...s, message: e.target.value }))}
                rows={3}
                placeholder="We are performing maintenance. Back soon!"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="start">Scheduled start (optional)</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={state.scheduledStart ? state.scheduledStart.slice(0, 16) : ''}
                  onChange={(e) =>
                    setState((s) => ({ ...s, scheduledStart: e.target.value || null }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="end">Scheduled end (optional)</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={state.scheduledEnd ? state.scheduledEnd.slice(0, 16) : ''}
                  onChange={(e) =>
                    setState((s) => ({ ...s, scheduledEnd: e.target.value || null }))
                  }
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {saved && <p className="self-center text-sm text-green-600">Saved!</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${state.enabled ? 'bg-red-500' : 'bg-green-500'}`}
            />
            <span className="text-sm font-medium">
              {state.enabled ? 'Maintenance mode is ON' : 'Site is live'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
