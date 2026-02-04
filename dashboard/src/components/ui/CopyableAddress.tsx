'use client';

import { useState } from 'react';
import { shortenAddress, getExplorerUrl } from '@/lib/contract';

interface Props {
  address: string;
  showExplorerLink?: boolean;
}

export function CopyableAddress({ address, showExplorerLink = false }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const content = (
    <span
      onClick={handleCopy}
      className="font-mono cursor-pointer hover:text-teal-600 transition-colors"
      title={`${address}\nClick to copy`}
    >
      {shortenAddress(address)}
      {copied && <span className="ml-1 text-green-600 text-xs">✓</span>}
    </span>
  );

  if (showExplorerLink) {
    return (
      <a href={getExplorerUrl(address)} target="_blank" rel="noopener noreferrer"
         className="text-teal-600 hover:underline">
        {content}
      </a>
    );
  }

  return content;
}
