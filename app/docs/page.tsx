import { Metadata } from 'next';
import Link from 'next/link';
import { FileText, BookOpen, Zap, Shield, Rocket, Code, Play, Lock, LucideIcon, Home } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAllDocs } from '@/lib/docs';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

export const metadata: Metadata = {
  title: 'Documentation | Claims Admin Dashboard',
  description: 'Complete documentation for setting up authentication and custom claims',
};

const iconMap: Record<string, LucideIcon> = {
  'setup': Code,
  'dashboard-quick-start': Play,
  'quick-start': Rocket,
  'overview': BookOpen,
  'installation': Code,
  'claims-guide': BookOpen,
  'complete-integration-guide': Rocket,
  'authentication-guide': Shield,
  'app-auth-integration': Rocket,
  'multi-app-guide': FileText,
  'auth-quick-reference': Zap,
  'rls-policies': Lock,
  'agent-context': FileText,
  'architecture': FileText,
  'development': Code,
  'contributing': FileText,
};

const colorMap: Record<string, string> = {
  'setup': 'text-red-600',
  'dashboard-quick-start': 'text-green-600',
  'quick-start': 'text-green-600',
  'overview': 'text-blue-600',
  'installation': 'text-orange-600',
  'claims-guide': 'text-blue-600',
  'complete-integration-guide': 'text-purple-600',
  'authentication-guide': 'text-green-600',
  'app-auth-integration': 'text-purple-600',
  'multi-app-guide': 'text-orange-600',
  'auth-quick-reference': 'text-yellow-600',
  'rls-policies': 'text-red-600',
  'agent-context': 'text-slate-600',
  'architecture': 'text-slate-600',
  'development': 'text-slate-600',
  'contributing': 'text-slate-600',
};

const CATEGORY_ORDER = [
  'getting-started',
  'guides',
  'authentication',
  'authorization',
  'advanced',
  'reference',
  'dashboard',
  'contributing',
] as const;

const categoryInfo: Record<string, { title: string; description: string }> = {
  'getting-started': {
    title: 'Getting Started',
    description: 'Start here to integrate auth + claims into your Next.js app',
  },
  guides: {
    title: 'Integration Guides',
    description: 'End-to-end walkthroughs and copy-paste references',
  },
  authentication: {
    title: 'Authentication',
    description: 'Sign-up/sign-in flows, callbacks, password & passwordless auth, sessions',
  },
  authorization: {
    title: 'Authorization',
    description: 'Claims, roles, permissions patterns, and RLS policies',
  },
  advanced: {
    title: 'Advanced',
    description: 'Multi-app architecture, API keys, and external integrations',
  },
  reference: {
    title: 'Reference',
    description: 'High-signal reference docs (including AI/agent context)',
  },
  dashboard: {
    title: 'Admin Dashboard',
    description: 'Run and configure the Claims Admin Dashboard',
  },
  contributing: {
    title: 'Contributing',
    description: 'Codebase architecture and contribution workflow',
  },
};

export default async function DocsPage() {
  const allDocs = await getAllDocs();

  // Group docs by category (dynamic)
  const docsByCategory = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [
      category,
      allDocs.filter((d) => d.category === category),
    ]),
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Documentation</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Documentation</h1>
            <p className="text-muted-foreground text-lg">
              Complete guides for authentication, custom claims, and integration patterns
            </p>
          </div>
          <Link href="/">
            <Button variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm">
          💡 <strong>Tip:</strong> Each guide includes a &quot;Copy for LLM&quot; button to easily paste the entire documentation into AI assistants like Claude or ChatGPT.
        </p>
      </div>

      {Object.entries(docsByCategory).map(([category, categoryDocs]) => {
        if (categoryDocs.length === 0) return null;

        return (
          <div key={category} className="mb-12">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2">
                {categoryInfo[category]?.title ?? category}
              </h2>
              <p className="text-muted-foreground">
                {categoryInfo[category]?.description ?? ''}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoryDocs.map((doc) => {
                const Icon = iconMap[doc.slug] || FileText;
                const color = colorMap[doc.slug] || 'text-gray-600';

                return (
                  <Link key={doc.slug} href={`/docs/${doc.slug}`}>
                    <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-background ${color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-lg">{doc.title}</CardTitle>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {doc.category}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {doc.audience}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription>{doc.description}</CardDescription>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="mt-12 p-6 bg-muted rounded-lg">
        <h3 className="text-xl font-semibold mb-2">Need Help?</h3>
        <p className="text-muted-foreground mb-4">
          Check out the troubleshooting sections in each guide or review the quick reference for common patterns.
        </p>
        <div className="flex gap-2">
          <Link href="/docs/quick-start">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
              App Quick Start
            </button>
          </Link>
          <Link href="/docs/auth-quick-reference">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
              Quick Reference
            </button>
          </Link>
          <Link href="/docs/setup">
            <button className="px-4 py-2 border rounded-md hover:bg-accent">
              Setup Guide
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
