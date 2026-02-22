'use client';

import { useState, ReactNode } from 'react';

interface StepExplanationProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export default function StepExplanation({
  title,
  children,
  defaultExpanded = false,
}: StepExplanationProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-6 border border-blue-200 rounded-lg bg-blue-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="font-medium text-blue-800">{title}</span>
        <svg
          className={`w-5 h-5 text-blue-600 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 text-sm text-gray-700 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}
