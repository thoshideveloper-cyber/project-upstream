"use client";

import { Building2, Users as UsersIcon, Clock } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useUsers } from "@/hooks/use-users";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryManager } from "@/components/features/category-manager";
import { EmailSendingCard, EmailTemplatesCard } from "@/components/features/email-sending-card";
import { StageManager } from "@/components/features/stage-manager";
import { DataSourceManager } from "@/components/features/data-source-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: users } = useUsers();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" description="Firm, team, and cadence configuration." />

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" /> Firm
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Firm" value={user?.firm.name ?? "—"} />
              <Field label="Your role" value={
                <Badge variant="secondary" className="capitalize">{user?.role.toLowerCase()}</Badge>
              } />
              <Field label="Signed in as" value={user?.full_name ?? "—"} />
              <Field label="Email" value={user?.email ?? "—"} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" /> Cadence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Default interval" value="14 days (bi-weekly)" />
              <Field label="Anchor" value="Fixed to initial email date" />
              <Field label="Timezone" value="Asia/Kolkata (IST)" />
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Interval is configurable per company on the cadence tab. The clock starts when the
              first initial email is logged.
            </p>
          </CardContent>
        </Card>
      </div>

      <EmailSendingCard />

      <EmailTemplatesCard />

      <CategoryManager />

      <StageManager />

      <DataSourceManager />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <UsersIcon className="h-4 w-4" /> Team ({users?.items.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!users || users.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members.</p>
          ) : (
            <ul className="divide-y">
              {users.items.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{u.full_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{u.email}</span>
                  </div>
                  <Badge variant="outline" className="capitalize">{u.role.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
