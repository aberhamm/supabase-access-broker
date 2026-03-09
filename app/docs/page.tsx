import { Metadata } from 'next';
import Link from 'next/link';
import { Home, Code2, Server, BookOpen, ArrowRight, Sparkles } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

export const metadata: Metadata = {
  title: 'Documentation | Supabase Access Broker',
  description: 'Complete documentation for authentication, authorization, and custom claims',
};

const tracks = [
  {
    id: 'integrator',
    title: 'Integrator',
    description: "I'm building an app that uses Access Broker for authentication and authorization",
    icon: Code2,
    href: '/docs/integrator',
    features: ['SSO Integration', 'Claims & Roles', 'Frontend Patterns'],
    cta: 'Start Integrating',
    gradient: 'from-blue-500/20 via-blue-500/5 to-transparent',
    iconBg: 'bg-blue-500/10 group-hover:bg-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderHover: 'hover:border-blue-500/50',
    dotColor: 'bg-blue-500',
  },
  {
    id: 'operator',
    title: 'Operator',
    description: "I'm deploying or managing the Access Broker platform for my organization",
    icon: Server,
    href: '/docs/operator',
    features: ['Installation & Setup', 'Configuration', 'Multi-App Management'],
    cta: 'Start Deploying',
    gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    iconBg: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderHover: 'hover:border-emerald-500/50',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'concepts',
    title: 'Concepts',
    description: 'I want to understand how authentication, authorization, claims, and roles work',
    icon: BookOpen,
    href: '/docs/concepts',
    features: ['Authentication', 'Authorization', 'Foundational Topics'],
    cta: 'Explore Concepts',
    gradient: 'from-violet-500/20 via-violet-500/5 to-transparent',
    iconBg: 'bg-violet-500/10 group-hover:bg-violet-500/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    borderHover: 'hover:border-violet-500/50',
    dotColor: 'bg-violet-500',
  },
];

export default function DocsHomePage() {
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
              <BreadcrumbPage className="font-medium">Documentation</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero */}
        <div className="mb-12 text-center sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium rounded-full bg-muted text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Choose your learning path
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Documentation
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Select the track that matches your role. Each path is tailored to get you productive as quickly as possible.
          </p>
        </div>

        {/* Track Cards */}
        <div className="grid gap-6 mb-16">
          {tracks.map((track, index) => {
            const Icon = track.icon;
            return (
              <Link
                key={track.id}
                href={track.href}
                className={`stagger-item group relative flex flex-col sm:flex-row items-start gap-6 p-6 sm:p-8 rounded-2xl border bg-card transition-all duration-300 ${track.borderHover} hover:shadow-lg hover:-translate-y-1`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Gradient overlay */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${track.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />

                {/* Icon */}
                <div className={`relative flex-shrink-0 p-4 rounded-xl ${track.iconBg} transition-colors duration-300`}>
                  <Icon className={`h-8 w-8 ${track.iconColor}`} />
                </div>

                {/* Content */}
                <div className="relative flex-1 min-w-0">
                  <h2 className="text-2xl font-semibold mb-2 group-hover:text-foreground transition-colors">
                    {track.title}
                  </h2>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    {track.description}
                  </p>

                  {/* Features */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
                    {track.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className={`w-1.5 h-1.5 rounded-full ${track.dotColor}`} />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground group-hover:gap-3 transition-all">
                    {track.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Help Section */}
        <div className="help-callout">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Not sure where to start?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong>Integrator</strong> if you&apos;re connecting an app. <strong>Operator</strong> if you&apos;re setting up the platform. <strong>Concepts</strong> to learn the fundamentals first.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
            >
              <Home className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
