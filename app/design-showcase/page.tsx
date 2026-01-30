'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnhancedClaimBadge } from '@/components/claims/EnhancedClaimBadge';
import { Shield, Users, Activity, TrendingUp, Star, Key } from 'lucide-react';

export default function DesignShowcasePage() {
  return (
    <div className="min-h-screen p-8 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 animate-reveal">
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
          Design System Showcase
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Explore the enhanced visual design, motion system, and component library
        </p>
      </div>

      {/* Color Palette */}
      <section className="space-y-4">
        <h2 className="text-3xl font-bold animate-reveal">Color Palette</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="animate-reveal">
            <CardContent className="p-6">
              <div className="w-full h-24 rounded-lg bg-primary mb-3"></div>
              <p className="text-sm font-mono">Primary</p>
              <p className="text-xs text-muted-foreground">Blue-violet</p>
            </CardContent>
          </Card>
          <Card className="animate-reveal">
            <CardContent className="p-6">
              <div className="w-full h-24 rounded-lg bg-accent-vivid mb-3"></div>
              <p className="text-sm font-mono">Accent</p>
              <p className="text-xs text-muted-foreground">Blue accent</p>
            </CardContent>
          </Card>
          <Card className="animate-reveal">
            <CardContent className="p-6">
              <div className="w-full h-24 rounded-lg bg-success mb-3"></div>
              <p className="text-sm font-mono">Success</p>
              <p className="text-xs text-muted-foreground">Green</p>
            </CardContent>
          </Card>
          <Card className="animate-reveal">
            <CardContent className="p-6">
              <div className="w-full h-24 rounded-lg bg-warning mb-3"></div>
              <p className="text-sm font-mono">Warning</p>
              <p className="text-xs text-muted-foreground">Amber</p>
            </CardContent>
          </Card>
          <Card className="animate-reveal">
            <CardContent className="p-6">
              <div className="w-full h-24 rounded-lg bg-danger mb-3"></div>
              <p className="text-sm font-mono">Danger</p>
              <p className="text-xs text-muted-foreground">Red</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Card Styles */}
      <section className="space-y-4">
        <h2 className="text-3xl font-bold animate-reveal">Interactive Cards</h2>
        <p className="text-muted-foreground animate-reveal">Hover over cards to see the lift effect</p>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="card-hover animate-reveal">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Users</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">1,234</div>
              <p className="text-xs text-muted-foreground">Total registered users</p>
            </CardContent>
          </Card>

          <Card className="card-hover animate-reveal">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-success/10 ring-1 ring-success/20">
                  <Activity className="h-5 w-5 text-success" />
                </div>
                <CardTitle>Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">892</div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <p className="text-xs text-muted-foreground status-live">Active now</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover animate-reveal">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-success/10 ring-1 ring-success/20">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <CardTitle>Growth</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">+24%</div>
              <p className="text-xs text-muted-foreground">vs last month</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Buttons */}
      <section className="space-y-4">
        <h2 className="text-3xl font-bold animate-reveal">Buttons with Press Feedback</h2>
        <div className="flex flex-wrap gap-3 animate-reveal">
          <Button className="btn-press">Default Button</Button>
          <Button variant="outline" className="btn-press">Outline Button</Button>
          <Button variant="secondary" className="btn-press">Secondary Button</Button>
          <Button variant="ghost" className="btn-press">Ghost Button</Button>
          <Button variant="destructive" className="btn-press">Destructive Button</Button>
        </div>
      </section>

      {/* Badges */}
      <section className="space-y-4">
        <h2 className="text-3xl font-bold animate-reveal">Enhanced Badges</h2>
        <div className="space-y-4">
          <div className="animate-reveal">
            <p className="text-sm text-muted-foreground mb-3">Standard badges:</p>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </div>
          <div className="animate-reveal">
            <p className="text-sm text-muted-foreground mb-3">Enhanced badges with icons:</p>
            <div className="flex flex-wrap gap-2">
              <EnhancedClaimBadge claim="admin" variant="admin" />
              <EnhancedClaimBadge claim="moderator" variant="role" />
              <EnhancedClaimBadge claim="premium" variant="premium" />
              <EnhancedClaimBadge claim="verified" variant="verified" />
              <EnhancedClaimBadge claim="user" variant="default" />
            </div>
          </div>
        </div>
      </section>

      {/* Gradient Cards */}
      <section className="space-y-4">
        <h2 className="text-3xl font-bold animate-reveal">Gradient Backgrounds</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="relative overflow-hidden card-hover animate-reveal">
            <div className="absolute inset-0 gradient-primary opacity-10"></div>
            <CardHeader className="relative">
              <CardTitle>Primary Gradient</CardTitle>
              <CardDescription>Blue-violet gradient overlay</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <p className="text-sm text-muted-foreground">
                Perfect for highlighting important information or primary actions
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden card-hover animate-reveal">
            <div className="absolute inset-0 gradient-accent opacity-10"></div>
            <CardHeader className="relative">
              <CardTitle>Accent Gradient</CardTitle>
              <CardDescription>Blue gradient overlay</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <p className="text-sm text-muted-foreground">
                Ideal for secondary highlights and accent elements
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Loading States */}
      <section className="space-y-4">
        <h2 className="text-3xl font-bold animate-reveal">Skeleton Loading States</h2>
        <Card className="animate-reveal">
          <CardHeader>
            <CardTitle>Loading Animation</CardTitle>
            <CardDescription>Shimmer effect for content placeholders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-3/4"></div>
            <div className="skeleton h-4 w-1/2"></div>
          </CardContent>
        </Card>
      </section>

      {/* Progress Bars */}
      <section className="space-y-4">
        <h2 className="text-3xl font-bold animate-reveal">Progress Visualization</h2>
        <Card className="animate-reveal">
          <CardHeader>
            <CardTitle>Claims Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'admin', value: 75, color: 'from-primary to-primary/80' },
              { label: 'moderator', value: 60, color: 'from-primary/80 to-primary/60' },
              { label: 'premium', value: 45, color: 'from-warning to-warning' },
              { label: 'user', value: 90, color: 'from-success to-success' },
            ].map((item) => (
              <div key={item.label} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-mono text-sm font-medium">{item.label}</p>
                  <span className="text-sm font-medium tabular-nums text-muted-foreground group-hover:text-foreground transition-colors">
                    {item.value}%
                  </span>
                </div>
                <div className="relative w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${item.color} rounded-full transition-all duration-500 group-hover:shadow-lg`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Typography */}
      <section className="space-y-4">
        <h2 className="text-3xl font-bold animate-reveal">Typography System</h2>
        <Card className="animate-reveal">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Display Font (Karla)</p>
              <p className="text-2xl font-bold">The quick brown fox jumps over the lazy dog</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Mono Font (JetBrains Mono)</p>
              <code className="font-mono text-sm">const user = await getUser(id);</code>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Glassmorphism */}
      <section className="space-y-4">
        <h2 className="text-3xl font-bold animate-reveal">Glassmorphism Effect</h2>
        <div className="relative p-12 rounded-lg gradient-mesh">
          <Card className="glass glass-border animate-reveal">
            <CardHeader>
              <CardTitle>Glass Card</CardTitle>
              <CardDescription>Semi-transparent with backdrop blur</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This card uses glassmorphism effect - a frosted glass appearance
                with backdrop blur and semi-transparent background. Perfect for
                overlays and floating elements.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Mini Chart */}
      <section className="space-y-4">
        <h2 className="text-3xl font-bold animate-reveal">Data Visualization</h2>
        <Card className="card-hover animate-reveal">
          <CardHeader>
            <CardTitle>Mini Bar Chart</CardTitle>
            <CardDescription>Interactive visualization with hover effects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {[40, 65, 55, 80, 70, 90, 75, 60, 85, 95, 88, 92].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/20 rounded-t transition-all duration-300 hover:bg-primary/40 cursor-pointer"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Hover over bars to see the highlight effect
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <div className="text-center py-12 space-y-2 animate-reveal">
        <p className="text-muted-foreground">
          Design system built with attention to detail
        </p>
        <p className="text-xs text-muted-foreground">
          Command Center Precision Aesthetic
        </p>
      </div>
    </div>
  );
}
