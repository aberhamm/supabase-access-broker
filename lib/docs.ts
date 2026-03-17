import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export const DOC_TRACKS = ['integrator', 'operator', 'concepts', 'reference', 'contributing'] as const;
export type DocTrack = (typeof DOC_TRACKS)[number];

const DOC_AUDIENCES = ['dashboard-admin', 'app-developer', 'all'] as const;
export type DocAudience = (typeof DOC_AUDIENCES)[number];

function isDocAudience(value: unknown): value is DocAudience {
  return typeof value === 'string' && (DOC_AUDIENCES as readonly string[]).includes(value);
}

export interface DocMetadata {
  slug: string;
  title: string;
  description: string;
  track: DocTrack;
  audience: DocAudience;
  order: number;
  filePath: string;
}

export async function getAllDocs(): Promise<DocMetadata[]> {
  const docsDir = path.join(process.cwd(), 'content/docs');
  const docs: DocMetadata[] = [];

  for (const track of DOC_TRACKS) {
    const trackPath = path.join(docsDir, track);

    if (!fs.existsSync(trackPath)) {
      continue;
    }

    const files = fs.readdirSync(trackPath).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(trackPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data } = matter(fileContent);

      docs.push({
        slug: file.replace('.md', ''),
        title: data.title || 'Untitled',
        description: data.description || '',
        track,
        audience: isDocAudience(data.audience) ? data.audience : 'all',
        order: data.order || 999,
        filePath: `${track}/${file}`,
      });
    }
  }

  return docs.sort((a, b) => {
    const trackOrder = Object.fromEntries(DOC_TRACKS.map((t, idx) => [t, idx])) as Record<DocTrack, number>;
    if (trackOrder[a.track] !== trackOrder[b.track]) {
      return trackOrder[a.track] - trackOrder[b.track];
    }
    return a.order - b.order;
  });
}

export async function getDocContent(slug: string): Promise<{ content: string; metadata: DocMetadata } | null> {
  const docs = await getAllDocs();
  const doc = docs.find(d => d.slug === slug);

  if (!doc) return null;

  const fullPath = path.join(process.cwd(), 'content/docs', doc.filePath);
  const fileContent = fs.readFileSync(fullPath, 'utf-8');
  const { content, data } = matter(fileContent);

  return {
    content,
    metadata: {
      ...doc,
      title: data.title || doc.title,
      description: data.description || doc.description,
    }
  };
}

export function getAllDocSlugs(): string[] {
  const docsDir = path.join(process.cwd(), 'content/docs');
  const slugs: string[] = [];

  for (const track of DOC_TRACKS) {
    const trackPath = path.join(docsDir, track);

    if (!fs.existsSync(trackPath)) {
      continue;
    }

    const files = fs.readdirSync(trackPath).filter(f => f.endsWith('.md'));
    slugs.push(...files.map(f => f.replace('.md', '')));
  }

  return slugs;
}

export async function getDocsByTrack(track: DocTrack): Promise<DocMetadata[]> {
  const allDocs = await getAllDocs();
  return allDocs.filter(doc => doc.track === track);
}

export async function getDocContentByTrack(
  track: DocTrack,
  slug: string
): Promise<{ content: string; metadata: DocMetadata } | null> {
  const docs = await getDocsByTrack(track);
  const doc = docs.find(d => d.slug === slug);

  if (!doc) return null;

  const fullPath = path.join(process.cwd(), 'content/docs', doc.filePath);
  const fileContent = fs.readFileSync(fullPath, 'utf-8');
  const { content, data } = matter(fileContent);

  return {
    content,
    metadata: {
      ...doc,
      title: data.title || doc.title,
      description: data.description || doc.description,
    }
  };
}
