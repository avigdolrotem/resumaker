'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface ImportedProfile {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  summary?: string;
  skills?: string[];
  experience?: Array<{
    company?: string;
    title?: string;
    description?: string;
    highlights?: string[];
  }>;
}

/**
 * "Import from PDF/TXT" button — uploads a resume file, extracts text,
 * parses with Claude haiku, calls onImport with structured fields.
 */
export function ImportProfileButton({ onImport }: { onImport: (p: ImportedProfile) => void }) {
  const t = useTranslations('import');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/profile/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(t('failed'), { description: data.error });
        return;
      }
      onImport(data);
      toast.success(t('success'));
    } catch (err) {
      toast.error(t('failed'), { description: (err as Error).message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="me-2 h-4 w-4" />
        )}
        {uploading ? t('uploading') : t('button')}
      </Button>
    </>
  );
}
