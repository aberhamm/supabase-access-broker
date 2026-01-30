import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const DOC_CATEGORIES = [
  'getting-started',
  'authentication',
  'authorization',
  'guides',
  'advanced',
  'dashboard',
  'reference',
  'contributing',
] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

const DOC_AUDIENCES = ['dashboard-admin', 'app-developer', 'all'] as const;
export type DocAudience = (typeof DOC_AUDIENCES)[number];

export const DOC_TRACKS = ['integrator', 'operator', 'concepts', 'reference', 'contributing'] as const;
export type DocTrack = (typeof DOC_TRACKS)[number];

function isDocCategory(value: unknown): value is DocCategory {
  return typeof value === 'string' && (DOC_CATEGORIES as readonly string[]).includes(value);
}

function isDocAudience(value: unknown): value is DocAudience {
  return typeof value === 'string' && (DOC_AUDIENCES as readonly string[]).includes(value);
}

function getTrack(category: DocCategory, audience: DocAudience): DocTrack {
  if (category === 'reference') return 'reference';
  if (category === 'contributing') return 'contributing';
  if (audience === 'app-developer') return 'integrator';
  if (audience === 'dashboard-admin') return 'operator';
  return 'concepts'; // audience: all
}

export interface DocMetadata {
  slug: string;
  title: string;
  description: string;
  category: DocCategory;
  audience: DocAudience;
  track: DocTrack;
  order: number;
  filePath: string;
}

export async function getAllDocs(): Promise<DocMetadata[]> {
  const docsDir = path.join(process.cwd(), 'content/docs');
  const docs: DocMetadata[] = [];

  for (const category of DOC_CATEGORIES) {
    const categoryPath = path.join(docsDir, category);

    // Check if directory exists
    if (!fs.existsSync(categoryPath)) {
      continue;
    }

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data } = matter(fileContent);

      const docCategory = isDocCategory(data.category) ? data.category : category;
      const docAudience = isDocAudience(data.audience) ? data.audience : 'all';

      docs.push({
        slug: file.replace('.md', ''),
        title: data.title || 'Untitled',
        description: data.description || '',
        category: docCategory,
        audience: docAudience,
        track: getTrack(docCategory, docAudience),
        order: data.order || 999,
        filePath: `${category}/${file}`,
      });
    }
  }

  return docs.sort((a, b) => {
    // Sort by category first
    const categoryOrder = Object.fromEntries(DOC_CATEGORIES.map((c, idx) => [c, idx])) as Record<
      DocCategory,
      number
    >;
    if (categoryOrder[a.category] !== categoryOrder[b.category]) {
      return categoryOrder[a.category] - categoryOrder[b.category];
    }
    // Then by order within category
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

  for (const category of DOC_CATEGORIES) {
    const categoryPath = path.join(docsDir, category);

    if (!fs.existsSync(categoryPath)) {
      continue;
    }

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md'));
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
