import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface DocMetadata {
  slug: string;
  title: string;
  description: string;
  category: 'dashboard' | 'integration' | 'core';
  audience: 'dashboard-admin' | 'app-developer' | 'all';
  order: number;
  filePath: string;
}

export async function getAllDocs(): Promise<DocMetadata[]> {
  const docsDir = path.join(process.cwd(), 'content/docs');
  const categories: ('dashboard' | 'integration' | 'core')[] = ['dashboard', 'integration', 'core'];
  const docs: DocMetadata[] = [];

  for (const category of categories) {
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

      docs.push({
        slug: file.replace('.md', ''),
        title: data.title || 'Untitled',
        description: data.description || '',
        category: data.category || category,
        audience: data.audience || 'all',
        order: data.order || 999,
        filePath: `${category}/${file}`,
      });
    }
  }

  return docs.sort((a, b) => {
    // Sort by category first (dashboard, integration, core)
    const categoryOrder = { dashboard: 1, integration: 2, core: 3 };
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
  const categories = ['dashboard', 'integration', 'core'];
  const slugs: string[] = [];

  for (const category of categories) {
    const categoryPath = path.join(docsDir, category);

    if (!fs.existsSync(categoryPath)) {
      continue;
    }

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md'));
    slugs.push(...files.map(f => f.replace('.md', '')));
  }

  return slugs;
}
