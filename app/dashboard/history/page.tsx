'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/header';
import { getHistory, clearHistory, type GenerationHistory } from '@/lib/storage';
import Link from 'next/link';

export default function HistoryPage() {
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const historyData = getHistory();
    setHistory(historyData);
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      clearHistory();
      loadHistory();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <>
      <Header
        title="Generation History"
        subtitle="View all your past headshot generations"
        action={{
          label: 'Create New',
          href: '/dashboard/create',
          icon: 'add_photo_alternate'
        }}
      />

      {/* Toolbar */}
      {history.length > 0 && (
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-zinc-500">{history.length} generation{history.length !== 1 ? 's' : ''}</p>
          <button
            onClick={handleClearHistory}
            className="text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">delete_sweep</span>
            Clear History
          </button>
        </div>
      )}

      {/* History list */}
      {history.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-zinc-600">history</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">No history yet</h3>
          <p className="text-zinc-500 mb-6 max-w-sm mx-auto">
            Your generation history will appear here after you create your first headshot.
          </p>
          <Link
            href="/dashboard/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors"
          >
            <span className="material-symbols-outlined">add_photo_alternate</span>
            Create Your First Headshot
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden"
            >
              {/* Main row */}
              <button
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                className="w-full p-4 flex items-center gap-4 hover:bg-zinc-800/50 transition-colors"
              >
                {/* Original thumbnail */}
                <div className="w-14 h-18 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-zinc-600">person</span>
                </div>

                {/* Arrow */}
                <span className="material-symbols-outlined text-indigo-400">arrow_forward</span>

                {/* Generated thumbnails */}
                <div className="flex -space-x-3">
                  {entry.generatedImages.slice(0, 3).map((_, i) => (
                    <div
                      key={i}
                      className="w-14 h-18 rounded-lg bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-2 border-zinc-900 flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-white/30 text-lg">person</span>
                    </div>
                  ))}
                  {entry.generatedImages.length > 3 && (
                    <div className="w-14 h-18 rounded-lg bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center">
                      <span className="text-xs text-zinc-400">+{entry.generatedImages.length - 3}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 text-left">
                  <p className="font-medium">{entry.styleName}</p>
                  <p className="text-sm text-zinc-500">{formatDate(entry.createdAt)}</p>
                </div>

                {/* Stats */}
                <div className="text-right">
                  <p className="text-sm text-zinc-400">{entry.generatedImages.length} image{entry.generatedImages.length !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-zinc-600">{entry.processingTime}s processing</p>
                </div>

                {/* Expand icon */}
                <span className={`material-symbols-outlined text-zinc-500 transition-transform ${
                  expandedId === entry.id ? 'rotate-180' : ''
                }`}>
                  expand_more
                </span>
              </button>

              {/* Expanded content */}
              {expandedId === entry.id && (
                <div className="p-4 pt-0 border-t border-zinc-800 mt-4">
                  <div className="grid sm:grid-cols-2 gap-6">
                    {/* Original */}
                    <div>
                      <p className="text-sm text-zinc-500 mb-2">Original Photo</p>
                      <div className="aspect-[3/4] rounded-xl bg-zinc-800 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-zinc-600">person</span>
                      </div>
                    </div>

                    {/* Generated */}
                    <div>
                      <p className="text-sm text-zinc-500 mb-2">Generated ({entry.generatedImages.length})</p>
                      <div className="grid grid-cols-2 gap-2">
                        {entry.generatedImages.map((_, i) => (
                          <div
                            key={i}
                            className="aspect-[3/4] rounded-xl bg-gradient-to-br from-indigo-900/50 to-purple-900/50 flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-2xl text-white/30">person</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 mt-4">
                    <Link
                      href={`/dashboard/create?style=${entry.styleId}`}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-center font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg">refresh</span>
                      Re-run with Same Style
                    </Link>
                    <Link
                      href="/dashboard/create"
                      className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                    >
                      <span className="material-symbols-outlined">style</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
