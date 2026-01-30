import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Home, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { getDocContentByTrack, getDocsByTrack, DocTrack, DOC_TRACKS } from '@/lib/docs';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { CopyDocButton } from '@/components/docs/CopyDocButton';
import { TableOfContents } from '@/components/docs/TableOfContents';
import { MobileTOC } from '@/components/docs/MobileTOC';
import { ReadingProgress } from '@/components/docs/ReadingProgress';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

interface TrackDocPageProps {
  params: Promise<{ track: string; slug: string }>;
}

export async function generateStaticParams() {
  const tracks: DocTrack[] = ['integrator', 'operator', 'concepts'];
  const params = [];

  for (const track of tracks) {
    const docs = await getDocsByTrack(track);
    params.push(...docs.map((doc) => ({ track, slug: doc.slug })));
  }

  return params;
}

export async function generateMetadata({ params }: TrackDocPageProps): Promise<Metadata> {
  const { track, slug } = await params;

  if (!DOC_TRACKS.includes(track as DocTrack)) {
    return { title: 'Not Found' };
  }

  const result = await getDocContentByTrack(track as DocTrack, slug);

  if (!result) {
    return { title: 'Not Found' };
  }

  return {
    title: `${result.metadata.title} | Documentation`,
    description: result.metadata.description,
  };
}

// Track configuration
const trackConfig: Record<DocTrack, { label: string; color: string; badgeClass: string }> = {
  integrator: {
    label: 'Integrator',
    color: 'blue',
    badgeClass: 'track-badge--integrator',
  },
  operator: {
    label: 'Operator',
    color: 'emerald',
    badgeClass: 'track-badge--operator',
  },
  concepts: {
    label: 'Concepts',
    color: 'violet',
    badgeClass: 'track-badge--concepts',
  },
  reference: {
    label: 'Reference',
    color: 'gray',
    badgeClass: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
  contributing: {
    label: 'Contributing',
    color: 'orange',
    badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
};

export default async function TrackDocPage({ params }: TrackDocPageProps) {
  const { track, slug } = await params;

  if (!DOC_TRACKS.includes(track as DocTrack)) {
    notFound();
  }

  const result = await getDocContentByTrack(track as DocTrack, slug);

  if (!result) {
    notFound();
  }

  const { content, metadata } = result;

  // Get all docs from same track for prev/next navigation
  const trackDocs = await getDocsByTrack(track as DocTrack);
  const currentIndex = trackDocs.findIndex((d) => d.slug === slug);
  const prevDoc = currentIndex > 0 ? trackDocs[currentIndex - 1] : null;
  const nextDoc = currentIndex < trackDocs.length - 1 ? trackDocs[currentIndex + 1] : null;

  // Get related docs (excluding current)
  const relatedDocs = trackDocs
    .filter((d) => d.slug !== slug)
    .slice(0, 3);

  const config = trackConfig[track as DocTrack];

  return (
    <>
      <ReadingProgress />

      <div className="docs-container min-h-screen">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-8">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Home className="h-4 w-4" />
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
                  Docs
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/docs/${track}`} className="text-muted-foreground hover:text-foreground transition-colors">
                  {config.label}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium truncate max-w-[200px]">
                  {metadata.title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="doc-layout">
            {/* Main content */}
            <article className="min-w-0">
              {/* Header */}
              <header className="mb-8 pb-8 border-b">
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={`track-badge ${config.badgeClass}`}>
                    {config.label}
                  </span>
                  {metadata.audience !== 'all' && (
                    <span className="track-badge bg-muted text-muted-foreground">
                      {metadata.audience === 'app-developer' ? 'App Developer' : 'Dashboard Admin'}
                    </span>
                  )}
                </div>

                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                  {metadata.title}
                </h1>

                {metadata.description && (
                  <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                    {metadata.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <CopyDocButton content={content} />

                  <Link
                    href={`https://github.com/supabase-community/supabase-custom-claims/blob/main/admin-dashboard/content/docs/${metadata.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Edit on GitHub
                  </Link>
                </div>
              </header>

              {/* Markdown content */}
              <div className="doc-content">
                <MarkdownRenderer content={content} />
              </div>

              {/* Prev/Next Navigation */}
              {(prevDoc || nextDoc) && (
                <nav className="doc-nav">
                  {prevDoc ? (
                    <Link href={`/docs/${track}/${prevDoc.slug}`} className="doc-nav-link">
                      <span className="doc-nav-label">
                        <ChevronLeft className="h-3 w-3 inline mr-1" />
                        Previous
                      </span>
                      <span className="doc-nav-title">{prevDoc.title}</span>
                    </Link>
                  ) : (
                    <div />
                  )}
                  {nextDoc ? (
                    <Link href={`/docs/${track}/${nextDoc.slug}`} className="doc-nav-link doc-nav-link--next">
                      <span className="doc-nav-label">
                        Next
                        <ChevronRight className="h-3 w-3 inline ml-1" />
                      </span>
                      <span className="doc-nav-title">{nextDoc.title}</span>
                    </Link>
                  ) : (
                    <div />
                  )}
                </nav>
              )}

              {/* Related docs */}
              {relatedDocs.length > 0 && (
                <div className="mt-12 pt-8 border-t">
                  <h3 className="text-lg font-semibold mb-4">
                    More in {config.label}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {relatedDocs.map((relatedDoc) => (
                      <Link
                        key={relatedDoc.slug}
                        href={`/docs/${track}/${relatedDoc.slug}`}
                        className="group p-4 rounded-xl border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
                      >
                        <h4 className="font-medium mb-1 group-hover:text-primary transition-colors">
                          {relatedDoc.title}
                        </h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {relatedDoc.description}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Back to track overview */}
              <div className="mt-8 pt-8 border-t">
                <Link
                  href={`/docs/${track}`}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to {config.label} Overview
                </Link>
              </div>
            </article>

            {/* Table of contents sidebar */}
            <aside className="hidden lg:block">
              <TableOfContents content={content} />
            </aside>
          </div>
        </div>
      </div>

      {/* Mobile TOC */}
      <MobileTOC content={content} />
    </>
  );
}
