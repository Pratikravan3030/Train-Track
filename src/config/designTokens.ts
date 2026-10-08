/**
 * Design Tokens for DYPCET Training & Placement Management Portal
 * Centralized color palette, border radiuses, shadows, and spacing tokens
 */

export const DESIGN_TOKENS = {
  colors: {
    // Primary College Navy & Blue
    primary: {
      50: '#eef6ff',
      100: '#dbeafe',
      500: '#2563eb',
      600: '#1d4ed8',
      700: '#1e40af',
      800: '#1e3a8a',
      900: '#0f172a',
    },
    // Academic Gold / Amber (accent for DYPCET crest & accolades)
    accent: {
      50: '#fffbeb',
      100: '#fef3c7',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
    },
    // Status colors
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      600: '#059669',
      700: '#047857',
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      600: '#dc2626',
      700: '#b91c1c',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      600: '#d97706',
      700: '#b45309',
    },
  },
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-full',
  },
  shadows: {
    card: 'shadow-sm shadow-slate-100/70 border border-slate-100',
    hover: 'hover:shadow-md transition-shadow duration-200',
    modal: 'shadow-2xl border border-slate-100',
    dropdown: 'shadow-lg border border-slate-100',
  },
  transitions: {
    default: 'transition-all duration-200 ease-in-out',
  },
} as const;
