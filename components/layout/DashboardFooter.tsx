import Link from 'next/link';
import { Github, Heart, ExternalLink } from 'lucide-react';

export function DashboardFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* About */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Access Broker</h3>
            <p className="text-sm text-muted-foreground">
              Manage user authentication, custom claims, and application access for your Supabase
              projects.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/docs"
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/supabase"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://supabase.com/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  Supabase Docs
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/docs/getting-started"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Getting Started
                </Link>
              </li>
              <li>
                <Link
                  href="/docs/authorization"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Authorization Guide
                </Link>
              </li>
              <li>
                <Link
                  href="/docs/api-reference"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  API Reference
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} Access Broker. Built with{' '}
            <Heart className="inline h-3 w-3 text-destructive" /> for the community.
          </p>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/supabase"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
