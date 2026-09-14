'use client';

import { useState } from 'react';

export interface ProjectDocumentDTO {
  id: string;
  source: 'upload' | 'sharepoint_link';
  filename: string;
  sharepointUrl: string | null;
  uploadedByName: string;
  uploadedAt: string;
}

export function DocumentsPanel({
  transitionId,
  sharepointFolderUrl,
  initialDocuments,
}: {
  transitionId: string;
  sharepointFolderUrl: string | null;
  initialDocuments: ProjectDocumentDTO[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [linkFilename, setLinkFilename] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/transitions/${transitionId}/documents/upload`, { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed to upload ${file.name}.`);
        continue;
      }
      const doc = await res.json();
      setDocuments((d) => [doc, ...d]);
    }
    setUploading(false);
    e.target.value = '';
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkFilename.trim() || !linkUrl.trim()) return;
    setError(null);
    const res = await fetch(`/api/transitions/${transitionId}/documents/link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filename: linkFilename, sharepointUrl: linkUrl }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to add link.');
      return;
    }
    const doc = await res.json();
    setDocuments((d) => [doc, ...d]);
    setLinkFilename('');
    setLinkUrl('');
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 14, margin: '0 0 4px' }}>Documents</h2>
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 12px' }}>
        Uploaded and linked documents are stored/shown for reference — nothing is auto-extracted into intake yet.
      </p>

      {sharepointFolderUrl && (
        <div style={{ fontSize: 12, marginBottom: 12 }}>
          Sales Transition SharePoint folder:{' '}
          <a href={sharepointFolderUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--teal-dark)' }}>
            {sharepointFolderUrl}
          </a>
        </div>
      )}

      {error && (
        <div role="alert" style={{ color: '#b42318', fontSize: 12, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <label className="btn" style={{ cursor: 'pointer' }}>
          {uploading ? 'Uploading…' : '+ Upload document(s)'}
          <input type="file" multiple onChange={onUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>

      <form onSubmit={addLink} style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="input" style={{ width: 180 }} placeholder="Document name" value={linkFilename} onChange={(e) => setLinkFilename(e.target.value)} />
        <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="SharePoint link (URL)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        <button className="btn" type="submit">
          Add link
        </button>
      </form>

      {documents.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>No documents yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {documents.map((d) => (
            <li key={d.id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 6 }}>
              <span>
                {d.source === 'upload' ? (
                  <a href={`/api/documents/${d.id}/download`} style={{ color: 'var(--teal-dark)', fontWeight: 600 }}>
                    {d.filename}
                  </a>
                ) : (
                  <a href={d.sharepointUrl ?? '#'} target="_blank" rel="noreferrer" style={{ color: 'var(--teal-dark)', fontWeight: 600 }}>
                    {d.filename} ↗
                  </a>
                )}
                <span style={{ color: 'var(--muted)' }}> — {d.source === 'upload' ? 'uploaded' : 'linked'} by {d.uploadedByName}</span>
              </span>
              <span style={{ color: 'var(--muted)' }}>{new Date(d.uploadedAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
