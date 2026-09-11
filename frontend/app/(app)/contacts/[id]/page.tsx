"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Archive, ArchiveRestore, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { useContact, useArchiveContact, useUnarchiveContact } from "@/hooks/use-contacts";
import { ContactDialog } from "@/components/features/contact-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutreachTimeline } from "@/components/features/outreach-timeline";
import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import { TaskList } from "@/components/features/task-list";
import { useTasks } from "@/hooks/use-tasks";
import { useConfirm } from "@/components/features/confirm-dialog";
import { useDelayed } from "@/hooks/use-delayed";
import { toastUndo } from "@/lib/undo-toast";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: contact, isLoading, error } = useContact(Number(id));
  const archiveContact = useArchiveContact();
  const unarchiveContact = useUnarchiveContact();
  const confirm = useConfirm();
  const showSkeleton = useDelayed(isLoading);

  if (isLoading) {
    if (!showSkeleton) return null;
    return (
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded-md bg-ink-100 mb-4" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-ink-100" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Contact not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          {!contact.archived_at && (
            <>
              <ContactDialog
                companyId={contact.company_id}
                contact={contact}
                trigger={<Button variant="outline" size="sm">Edit</Button>}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const ok = await confirm({
                    title: `Archive ${contact.contact_person}?`,
                    description:
                      "They drop out of the rolodex and the pickers. Their touch history is kept — restore any time, or undo straight after.",
                    confirmLabel: "Archive",
                    tone: "destructive",
                  });
                  if (!ok) return;
                  try {
                    await archiveContact.mutateAsync(contact.id);
                    toastUndo(`${contact.contact_person} archived`, () =>
                      unarchiveContact.mutateAsync(contact.id),
                    );
                    router.back();
                  } catch {
                    toast.error("Failed to archive contact");
                  }
                }}
              >
                <Archive className="mr-1 h-4 w-4" />
                Archive
              </Button>
            </>
          )}
          {contact.archived_at && (
            <>
              <Badge variant="secondary">Archived</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await unarchiveContact.mutateAsync(contact.id);
                    toast.success("Contact restored");
                  } catch {
                    toast.error("Failed to restore contact");
                  }
                }}
              >
                <ArchiveRestore className="mr-1 h-4 w-4" />
                Restore
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <PageHeader
        title={contact.contact_person}
        description={
          [contact.designation, contact.company_name, contact.email]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Contact details */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Designation" value={contact.designation} />
              <Field label="Engagement" value={contact.engagement?.replace("_", "-")} />
              <Field label="Email" value={contact.email} />
              <Field label="Phone" value={contact.phone} />
              <Field label="Date connected" value={contact.date_connected} />
              <Field label="Last contact" value={contact.last_contact_date} />
              {contact.linkedin && (
                <div>
                  <dt className="text-xs text-muted-foreground">LinkedIn</dt>
                  <dd className="mt-0.5 text-sm">
                    <a
                      href={contact.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary-ink hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Profile
                    </a>
                  </dd>
                </div>
              )}
              <Field label="Primary" value={contact.is_primary ? "Yes" : null} />
            </dl>
            {contact.remark && (
              <div className="mt-4 pt-4 border-t">
                <dt className="text-xs text-muted-foreground">Remark</dt>
                <dd className="mt-1 text-sm">{contact.remark}</dd>
              </div>
            )}
            {contact.comments && (
              <div className="mt-3">
                <dt className="text-xs text-muted-foreground">Comments</dt>
                <dd className="mt-1 text-sm">{contact.comments}</dd>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Touch history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Touch history ({contact.events.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Person-scoped slice of the same append-only log the company shows. */}
            {/* No `contacts` here: on this person's own page "with <them>" on
                every row would be noise — attribution stays on the company view. */}
            <OutreachTimeline
              compact
              events={contact.events}
              emptyAction={
                contact.archived_at ? undefined : (
                  <LogOutreachDialog
                    companyId={contact.company_id}
                    companyName={contact.company_name ?? "this company"}
                    defaultContactId={contact.id}
                    defaultEventType="CALL"
                    trigger={
                      <Button size="sm" variant="outline">
                        Log a touch
                      </Button>
                    }
                  />
                )
              }
            />
          </CardContent>
        </Card>

        {/* Quick-add, deliberately not a full task surface: what you want on a
            person's page is "ring them Thursday", written in one line. Everything
            else about the task is editable from /tasks. */}
        {!contact.archived_at && <ContactTasks contactId={contact.id} />}
      </div>
    </div>
  );
}

function ContactTasks({ contactId }: { contactId: number }) {
  const { data, isLoading } = useTasks({ contact_id: contactId });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <TaskList
          tasks={data?.items ?? []}
          isLoading={isLoading}
          showProject={false}
          defaults={{ title: "", contact_id: contactId }}
          addPlaceholder="Add a task about this person and press Enter"
          emptyMessage="Nothing to do about this person right now."
        />
      </CardContent>
    </Card>
  );
}
