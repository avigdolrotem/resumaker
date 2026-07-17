'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ImportResult {
  imported: number;
  errors: string[];
}

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/hr/jobs/bulk-import', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as ImportResult & { error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Import failed');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk import jobs</h1>
        <p className="text-muted-foreground mt-1">
          Upload a CSV file with columns: title, company, location, description, remote, seniority,
          applyUrl
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <Label htmlFor="csv-file">CSV file (max 500 rows)</Label>
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-muted-foreground file:bg-muted hover:file:bg-accent file:ease-snappy mt-1 block w-full text-sm file:me-4 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium file:transition-colors file:duration-200"
              />
            </div>

            <Button type="submit" disabled={!file || loading}>
              {loading ? 'Importing…' : 'Import jobs'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="animate-liquid-pop border-red-200">
          <CardContent className="pt-5">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="animate-liquid-pop">
          <CardContent className="space-y-2 pt-5">
            <p className="font-medium text-emerald-700">
              {result.imported} job{result.imported !== 1 ? 's' : ''} imported successfully.
            </p>
            {result.errors.length > 0 && (
              <div>
                <p className="text-foreground text-sm font-medium">Skipped rows:</p>
                <ul className="mt-1 space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-sm text-red-600">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
