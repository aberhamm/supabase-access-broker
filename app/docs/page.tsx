import { Metadata } from 'next';
import Link from 'next/link';
import { FileText, BookOpen, Zap, Shield, Rocket, Code, Play, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Documentation | Claims Admin Dashboard',
  description: 'Complete documentation for setting up authentication and custom claims',
};

const docs = [
  {
    slug: 'claims-guide',
    title: 'Claims Guide',
    description: 'Complete guide to Supabase custom claims - what they are, why use them, and how to implement',
    icon: BookOpen,
    category: 'Core Concepts',
    color: 'text-blue-600',
  },
  {
    slug: 'authentication-guide',
    title: 'Authentication Setup',
    description: 'Set up Supabase Auth with sign up/sign in flows and automatic role assignment',
    icon: Shield,
    category: 'Authentication',
    color: 'text-green-600',
  },
  {
    slug: 'app-auth-integration',
    title: 'Integration Patterns',
    description: 'Advanced patterns: self-service sign up, invites, multi-tenancy, and real-world examples',
    icon: Rocket,
    category: 'Authentication',
    color: 'text-purple-600',
  },
  {
    slug: 'multi-app-guide',
    title: 'Multi-App Architecture',
    description: 'Manage multiple applications with one auth system, app-specific roles, and permissions',
    icon: FileText,
    category: 'Architecture',
    color: 'text-orange-600',
  },
  {
    slug: 'rls-policies',
    title: 'RLS Policies',
    description: 'Set up Row Level Security policies with custom claims for database access control',
    icon: Lock,
    category: 'Security',
    color: 'text-red-600',
  },
  {
    slug: 'auth-quick-reference',
    title: 'Quick Reference',
    description: 'Copy-paste ready code snippets for all authentication tasks',
    icon: Zap,
    category: 'Reference',
    color: 'text-yellow-600',
  },
  {
    slug: 'quick-start',
    title: 'Quick Start',
    description: 'Get started in 5 minutes with the dashboard',
    icon: Play,
    category: 'Getting Started',
    color: 'text-green-600',
  },
  {
    slug: 'setup',
    title: 'Setup Guide',
    description: 'Detailed setup instructions and troubleshooting',
    icon: Code,
    category: 'Getting Started',
    color: 'text-red-600',
  },
];

const categories = [...new Set(docs.map(doc => doc.category))];

export default function DocsPage() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Documentation</h1>
        <p className="text-muted-foreground text-lg">
          Complete guides for authentication, custom claims, and integration patterns
        </p>
      </div>

      <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm">
          💡 <strong>Tip:</strong> Each guide includes a &quot;Copy for LLM&quot; button to easily paste the entire documentation into AI assistants like Claude or ChatGPT.
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">{category}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {docs
              .filter((doc) => doc.category === category)
              .map((doc) => {
                const Icon = doc.icon;
                return (
                  <Link key={doc.slug} href={`/docs/${doc.slug}`}>
                    <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-background ${doc.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{doc.title}</CardTitle>
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
      ))}

      <div className="mt-12 p-6 bg-muted rounded-lg">
        <h3 className="text-xl font-semibold mb-2">Need Help?</h3>
        <p className="text-muted-foreground mb-4">
          Check out the troubleshooting sections in each guide or review the quick reference for common patterns.
        </p>
        <div className="flex gap-2">
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
