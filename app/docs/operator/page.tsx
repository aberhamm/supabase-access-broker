import { Metadata } from 'next';
import Link from 'next/link';
import { Home, Server, ArrowRight, BookOpen, Code2, CheckCircle2 } from 'lucide-react';
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
  title: 'Operator Documentation | Access Broker',
  description: 'Deploy and manage the Access Broker platform for your organization',
};

export default async function OperatorLandingPage() {
  const operatorDocs = await getDocsByTrack('operator');
  const conceptDocs = await getDocsByTrack('concepts');

  // Curated journey for operators
  const curatedJourney = [
    { slug: 'dashboard-quick-start', milestone: 'Launch' },
    { slug: 'setup', milestone: 'Configure' },
    { slug: 'installation', milestone: 'Deploy' },
    { slug: 'environment-configuration', milestone: 'Customize' },
    { slug: 'auth-portal-sso-passkeys', milestone: 'Enable' },
    { slug: 'multi-app-guide', milestone: 'Scale' },
    { slug: 'admin-types', milestone: 'Secure' },
    { slug: 'api-keys-guide', milestone: 'Integrate' },
  ];

  // Map slugs to docs
  const allDocs = [...operatorDocs, ...conceptDocs];
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
              <BreadcrumbPage className="font-medium">Operator</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero */}
        <div className="mb-12">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <Server className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="track-badge track-badge--operator mb-2">Operator Track</div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Deploy & Manage</h1>
            </div>
          </div>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Set up, configure, and operate the Access Broker platform for your organization. This
            guide covers everything from initial deployment to multi-app management.
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
                <p className="font-medium">Docker Environment</p>
                <p className="text-sm text-muted-foreground">Docker and Docker Compose installed</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Supabase Project</p>
                <p className="text-sm text-muted-foreground">
                  A Supabase project for the broker database
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Journey */}
        <div className="mb-16">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Deployment Journey</h2>
              <p className="text-muted-foreground mt-1">
                Follow this path to deploy and configure the platform
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
                className="stagger-item group flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-emerald-500/50 hover:shadow-md transition-all duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Step indicator */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground group-hover:bg-emerald-500/10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {doc.milestone}
                    </span>
                  </div>
                  <h3 className="font-medium truncate group-hover:text-foreground transition-colors">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">{doc.description}</p>
                </div>

                {/* Arrow */}
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* All Operator Docs */}
        {operatorDocs.length > 0 && (
          <div className="mb-16">
            <h2 className="text-xl font-semibold mb-4">All Operator Docs</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {operatorDocs.map((doc, index) => (
                <Link
                  key={doc.slug}
                  href={`/docs/operator/${doc.slug}`}
                  className="stagger-item group p-4 rounded-xl border bg-card hover:border-emerald-500/30 hover:shadow-sm transition-all"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <h3 className="font-medium mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
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
              <h3 className="font-semibold mb-1">Looking to integrate instead?</h3>
              <p className="text-sm text-muted-foreground">
                If you&apos;re connecting your app to Access Broker, check out the Integrator track.
              </p>
            </div>
            <Link
              href="/docs/integrator"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
            >
              <Code2 className="h-4 w-4" />
              Integrator Track
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
