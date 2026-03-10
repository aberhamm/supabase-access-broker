import { Metadata } from 'next';
import Link from 'next/link';
import { Home, Code2, ArrowRight, BookOpen, Server, CheckCircle2 } from 'lucide-react';
import { getDocsByTrack } from '@/lib/docs';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

export const metadata: Metadata = {
  title: 'Integrator Documentation | Access Broker',
  description: 'Connect your application to Access Broker for SSO and claims-based authorization',
};

export default async function IntegratorLandingPage() {
  const integratorDocs = await getDocsByTrack('integrator');
  const conceptDocs = await getDocsByTrack('concepts');

  // Curated journey for integrators
  const curatedJourney = [
    { slug: 'sso-integration-guide', milestone: 'Connect' },
    { slug: 'complete-integration-guide', milestone: 'Configure' },
    { slug: 'authentication-guide', milestone: 'Understand' },
    { slug: 'claims-guide', milestone: 'Enrich' },
    { slug: 'role-management-guide', milestone: 'Assign' },
    { slug: 'role-frontend-patterns', milestone: 'Implement' },
    { slug: 'authorization-patterns', milestone: 'Secure' },
    { slug: 'rls-policies', milestone: 'Protect' },
  ];

  // Map slugs to docs
  const allDocs = [...integratorDocs, ...conceptDocs];
  const journeyDocs = curatedJourney
    .map((item) => {
      const doc = allDocs.find((d) => d.slug === item.slug);
      return doc ? { ...doc, milestone: item.milestone } : null;
    })
    .filter((doc): doc is NonNullable<typeof doc> & { milestone: string } => doc !== null);

  return (
    <div className="docs-container min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-12">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Home className="h-4 w-4" />
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/docs"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Documentation
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">Integrator</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero */}
        <div className="mb-12">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Code2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="track-badge track-badge--integrator mb-2">Integrator Track</div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Integrate Your App</h1>
            </div>
          </div>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Connect your application to Access Broker for centralized authentication and
            claims-based authorization. Follow this guided path to implement secure, scalable auth.
          </p>
        </div>

        {/* Prerequisites */}
        <div className="mb-12 p-6 rounded-xl border bg-muted/30">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Prerequisites
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Supabase Project</p>
                <p className="text-sm text-muted-foreground">
                  An existing Supabase project with auth enabled
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Access Broker URL</p>
                <p className="text-sm text-muted-foreground">
                  The URL of a deployed Access Broker instance
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Journey */}
        <div className="mb-16">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Learning Journey</h2>
              <p className="text-muted-foreground mt-1">
                Follow this path to integrate your app step by step
              </p>
            </div>
            <div className="hidden sm:block text-sm text-muted-foreground">
              {journeyDocs.length} steps
            </div>
          </div>

          <div className="space-y-3">
            {journeyDocs.map((doc, index) => (
              <Link
                key={doc.slug}
                href={`/docs/${doc.track}/${doc.slug}`}
                className="stagger-item group flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-blue-500/50 hover:shadow-md transition-all duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Step indicator */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      {doc.milestone}
                    </span>
                  </div>
                  <h3 className="font-medium truncate group-hover:text-foreground transition-colors">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">{doc.description}</p>
                </div>

                {/* Arrow */}
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* All Integrator Docs */}
        {integratorDocs.length > 0 && (
          <div className="mb-16">
            <h2 className="text-xl font-semibold mb-4">All Integrator Docs</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {integratorDocs.map((doc, index) => (
                <Link
                  key={doc.slug}
                  href={`/docs/integrator/${doc.slug}`}
                  className="stagger-item group p-4 rounded-xl border bg-card hover:border-blue-500/30 hover:shadow-sm transition-all"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <h3 className="font-medium mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Related Concepts */}
        <div className="mb-12">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Foundational Concepts</h2>
            <Link
              href="/docs/concepts"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {conceptDocs.slice(0, 6).map((doc, index) => (
              <Link
                key={doc.slug}
                href={`/docs/concepts/${doc.slug}`}
                className="stagger-item group flex items-start gap-3 p-4 rounded-xl border bg-card hover:border-violet-500/30 hover:shadow-sm transition-all"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <BookOpen className="h-5 w-5 text-violet-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-medium mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors truncate">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Wrong Track */}
        <div className="p-6 rounded-xl border bg-muted/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Looking to deploy instead?</h3>
              <p className="text-sm text-muted-foreground">
                If you&apos;re setting up the Access Broker platform itself, check out the Operator
                track.
              </p>
            </div>
            <Link
              href="/docs/operator"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <Server className="h-4 w-4" />
              Operator Track
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
