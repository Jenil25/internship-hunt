'use client';

import { useState } from 'react';

export default function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  }

  return (
    <button onClick={handleCopy} className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 14px' }}>
      {copied ? '✅ Copied!' : `📋 ${label}`}
    </button>
  );
}
