'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AppRoleSelector } from '@/components/apps/AppRoleSelector';
import type { AppConfig } from '@/types/claims';

export interface AppSelection {
  selected: boolean;
  role: string;
}

interface AppAccessStepProps {
  apps: AppConfig[];
  selections: Record<string, AppSelection>;
  onSelectionsChange: (selections: Record<string, AppSelection>) => void;
  createdEmail: string;
  onFinish: () => void;
  onSkip: () => void;
  loading: boolean;
}

export function AppAccessStep({
  apps,
  selections,
  onSelectionsChange,
  createdEmail,
  onFinish,
  onSkip,
  loading,
}: AppAccessStepProps) {
  const enabledApps = apps.filter((app) => app.enabled);
  const selectedCount = Object.values(selections).filter((s) => s.selected).length;

  const toggleApp = (appId: string) => {
    const current = selections[appId] || { selected: false, role: 'user' };
    onSelectionsChange({
      ...selections,
      [appId]: { ...current, selected: !current.selected },
    });
  };

  const setRole = (appId: string, role: string) => {
    const current = selections[appId] || { selected: true, role: 'user' };
    onSelectionsChange({
      ...selections,
      [appId]: { ...current, role },
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
        <p className="text-sm text-muted-foreground">
          Created <span className="font-medium text-foreground">{createdEmail}</span>
          {' '}&mdash; optionally grant app access below.
        </p>
      </div>

      {enabledApps.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No apps configured yet.
        </p>
      ) : (
        <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {enabledApps.map((app) => {
            const sel = selections[app.id] || { selected: false, role: 'user' };
            return (
              <div
                key={app.id}
                className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                  sel.selected ? 'border-primary/30 bg-primary/5' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`app-${app.id}`}
                    checked={sel.selected}
                    onCheckedChange={() => toggleApp(app.id)}
                    disabled={loading}
                  />
                  <label
                    htmlFor={`app-${app.id}`}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    {app.color && (
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: app.color }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium">{app.name}</p>
                      {app.description && (
                        <p className="text-xs text-muted-foreground">
                          {app.description}
                        </p>
                      )}
                    </div>
                  </label>
                </div>
                {sel.selected && (
                  <AppRoleSelector
                    currentRole={sel.role}
                    onRoleChange={(role) => setRole(app.id, role)}
                    disabled={loading}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onSkip}
          disabled={loading}
        >
          Skip
        </Button>
        <Button
          onClick={onFinish}
          disabled={loading || selectedCount === 0}
        >
          {loading
            ? 'Granting access...'
            : `Grant Access${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
        </Button>
      </div>
    </div>
  );
}
