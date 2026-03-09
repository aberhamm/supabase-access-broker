import { Metadata } from 'next';
import Link from 'next/link';
import { Home, BookOpen, ArrowRight, Code2, Server, Shield, Key } from 'lucide-react';
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
  title: 'Concepts Documentation | access broker',
  description: 'Foundational concepts for authentication, authorization, claims, and roles',
};

export default async function ConceptsLandingPage() {
  const conceptDocs = await getDocsByTrack('concepts');

  // Group concepts by topic with icons
  const groups = [
    {
      title: 'Authentication',
      description: 'Sign-up, sign-in, sessions, and user identity management',
      icon: Key,
      color: 'blue',
      docs: conceptDocs.filter(d =>
        d.category === 'authentication' ||
        d.slug.includes('auth') ||
        d.slug.includes('session') ||
        d.slug.includes('logout') ||
        d.slug.includes('password')
      ),
    },
    {
      title: 'Authorization',
      description: 'Claims, roles, permissions, and access control patterns',
      icon: Shield,
      color: 'emerald',
      docs: conceptDocs.filter(d =>
        d.category === 'authorization' ||
        d.slug.includes('role') ||
        d.slug.includes('claim') ||
        d.slug.includes('admin') ||
        d.slug.includes('rls')
      ),
    },
  ];

  // Get uncategorized docs
  const categorizedSlugs = groups.flatMap(g => g.docs.map(d => d.slug));
  const otherDocs = conceptDocs.filter(d => !categorizedSlugs.includes(d.slug));

  if (otherDocs.length > 0) {
    groups.push({
      title: 'Additional Topics',
      description: 'Other foundational concepts and reference materials',
      icon: BookOpen,
      color: 'violet',
      docs: otherDocs,
    });
  }

  const colorMap: Record<string, { bg: string; text: string; hoverBorder: string; hoverText: string }> = {
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-600 dark:text-blue-400',
      hoverBorder: 'hover:border-blue-500/30',
      hoverText: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      hoverBorder: 'hover:border-emerald-500/30',
      hoverText: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    },
    violet: {
      bg: 'bg-violet-500/10',
      text: 'text-violet-600 dark:text-violet-400',
      hoverBorder: 'hover:border-violet-500/30',
      hoverText: 'group-hover:text-violet-600 dark:group-hover:text-violet-400',
    },
  };

  return (
    <div className="docs-container min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-12">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <Home className="h-4 w-4" />
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
                Documentation
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">Concepts</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero */}
        <div className="mb-12">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="p-3 rounded-xl bg-violet-500/10">
              <BookOpen className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <div className="track-badge track-badge--concepts mb-2">Concepts Track</div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Foundational Concepts
              </h1>
            </div>
          </div>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Understand how authentication, authorization, claims, and roles work in access broker. These concepts apply whether you&apos;re integrating an app or operating the platform.
          </p>
        </div>

        {/* Topic Groups */}
        {groups.map((group, groupIndex) => {
          const Icon = group.icon;
          const colors = colorMap[group.color] || colorMap.violet;

          return group.docs.length > 0 ? (
            <div key={group.title} className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${colors.bg}`}>
                  <Icon className={`h-5 w-5 ${colors.text}`} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{group.title}</h2>
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.docs.map((doc, index) => (
                  <Link
                    key={doc.slug}
                    href={`/docs/concepts/${doc.slug}`}
                    className={`stagger-item group p-4 rounded-xl border bg-card ${colors.hoverBorder} hover:shadow-sm transition-all`}
                    style={{ animationDelay: `${(groupIndex * 6 + index) * 50}ms` }}
                  >
                    <h3 className={`font-medium mb-1 transition-colors ${colors.hoverText}`}>
                      {doc.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {doc.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null;
        })}

        {/* Navigate to Tracks */}
        <div className="grid sm:grid-cols-2 gap-4 mt-16">
          <Link
            href="/docs/integrator"
            className="group p-6 rounded-xl border bg-card hover:border-blue-500/50 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <Code2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Ready to Integrate?
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Apply these concepts to connect your app to access broker
                </p>
                <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                  Go to Integrator Track
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>

          <Link
            href="/docs/operator"
            className="group p-6 rounded-xl border bg-card hover:border-emerald-500/50 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                <Server className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Ready to Deploy?
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Apply these concepts to deploy and manage the platform
                </p>
                <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Go to Operator Track
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
