import fs from 'fs';
import path from 'path';

export interface DocMetadata {
  slug: string;
  title: string;
  description: string;
  fileName: string;
}

export const docsMetadata: Record<string, DocMetadata> = {
  'claims-guide': {
    slug: 'claims-guide',
    title: 'Supabase Custom Claims Guide',
    description: 'Complete guide to Supabase custom claims',
    fileName: 'CLAIMS_GUIDE.md',
  },
  'authentication-guide': {
    slug: 'authentication-guide',
    title: 'Authentication Setup Guide',
    description: 'Set up Supabase Auth with automatic role assignment',
    fileName: 'AUTHENTICATION_GUIDE.md',
  },
  'app-auth-integration': {
    slug: 'app-auth-integration',
    title: 'App Authentication Integration Guide',
    description: 'Advanced integration patterns for authentication',
    fileName: 'APP_AUTH_INTEGRATION_GUIDE.md',
  },
  'multi-app-guide': {
    slug: 'multi-app-guide',
    title: 'Multi-App Architecture Guide',
    description: 'Managing multiple applications with one auth system',
    fileName: 'MULTI_APP_GUIDE.md',
  },
  'auth-quick-reference': {
    slug: 'auth-quick-reference',
    title: 'Authentication Quick Reference',
    description: 'Copy-paste ready code snippets',
    fileName: 'AUTH_QUICK_REFERENCE.md',
  },
  'setup': {
    slug: 'setup',
    title: 'Setup Guide',
    description: 'Detailed setup instructions',
    fileName: 'SETUP.md',
  },
  'quick-start': {
    slug: 'quick-start',
    title: 'Quick Start',
    description: 'Get started in 5 minutes',
    fileName: 'QUICK_START.md',
  },
  'rls-policies': {
    slug: 'rls-policies',
    title: 'RLS Policies Guide',
    description: 'Set up Row Level Security policies with custom claims',
    fileName: 'RLS_POLICIES_GUIDE.md',
  },
};

export async function getDocContent(slug: string): Promise<string | null> {
  const doc = docsMetadata[slug];
  if (!doc) return null;

  try {
    const filePath = path.join(process.cwd(), doc.fileName);
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Error reading doc ${slug}:`, error);
    return null;
  }
}

export function getAllDocSlugs(): string[] {
  return Object.keys(docsMetadata);
}
