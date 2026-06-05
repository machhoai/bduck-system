"use client";

import { useEffect, useState } from "react";
import { Bell, Mail, ShieldAlert } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { NotificationPriority } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { useNotificationSender } from "@/hooks/useNotificationSender";
import { useRoles } from "@/hooks/useRoles";
import { useUsers } from "@/hooks/useUsers";
import EmailNotificationForm from "./EmailNotificationForm";
import InAppNotificationForm from "./InAppNotificationForm";
import NotificationHistoryPanel from "./NotificationHistoryPanel";

type ComposerChannel = "IN_APP" | "EMAIL";

const EMPTY_EMAIL_HTML = "";

export default function NotificationWorkspace() {
  const { t } = useTranslation();
  const text = t.notification;
  const {
    dispatches,
    isLoading,
    canReadHistory,
    canSendInApp,
    canSendEmail,
    sendInAppNotification,
    sendEmailNotification,
  } = useNotificationSender({ limit: 40 });
  const { users, isLoading: usersLoading } = useUsers();
  const { roles, isLoading: rolesLoading } = useRoles();

  const [channel, setChannel] = useState<ComposerChannel>("IN_APP");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [inAppTitle, setInAppTitle] = useState("");
  const [inAppMessage, setInAppMessage] = useState("");
  const [priority, setPriority] = useState<NotificationPriority>("NORMAL");
  const [actionUrl, setActionUrl] = useState("");
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHtmlContent, setEmailHtmlContent] = useState(EMPTY_EMAIL_HTML);
  const [emailTextContent, setEmailTextContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (channel === "IN_APP" && !canSendInApp && canSendEmail) {
      setChannel("EMAIL");
    }
    if (channel === "EMAIL" && !canSendEmail && canSendInApp) {
      setChannel("IN_APP");
    }
  }, [canSendEmail, canSendInApp, channel]);

  const showValidationToast = (description: string) => {
    gooeyToast.error(text.requiredContent, {
      description,
      preset: "snappy",
      timing: { displayDuration: 5000 },
    });
  };

  const handleSendInApp = async () => {
    if (selectedUserIds.length === 0 && selectedRoleIds.length === 0) {
      showValidationToast(text.requiredRecipients);
      return;
    }
    if (!inAppTitle.trim() || !inAppMessage.trim()) {
      showValidationToast(text.requiredContent);
      return;
    }

    setIsSubmitting(true);
    try {
      await gooeyToast.promise(
        sendInAppNotification({
          recipient_user_ids: selectedUserIds,
          recipient_role_ids: selectedRoleIds,
          title: inAppTitle.trim(),
          message: inAppMessage.trim(),
          priority,
          action_url: actionUrl.trim() || null,
        }),
        {
          loading: text.sendingInApp,
          success: text.sentInApp,
          error: text.sendInAppError,
          description: {
            success: text.sentInAppDesc,
            error: text.sendInAppError,
          },
          action: {
            error: {
              label: text.retry,
              onClick: () => void handleSendInApp(),
            },
          },
        },
      );
      setInAppTitle("");
      setInAppMessage("");
      setActionUrl("");
      setSelectedUserIds([]);
      setSelectedRoleIds([]);
    } catch (error) {
      console.error("[NotificationWorkspace] send in-app error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    if (toEmails.length === 0) {
      showValidationToast(text.requiredEmailRecipients);
      return;
    }
    if (!emailSubject.trim() || !emailTextContent.trim()) {
      showValidationToast(text.requiredContent);
      return;
    }

    setIsSubmitting(true);
    try {
      await gooeyToast.promise(
        sendEmailNotification({
          to: toEmails,
          cc: ccEmails,
          bcc: bccEmails,
          subject: emailSubject.trim(),
          html_content: emailHtmlContent,
          text_content: emailTextContent,
        }),
        {
          loading: text.sendingEmail,
          success: text.sentEmail,
          error: text.sendEmailError,
          description: {
            success: text.sentEmailDesc,
            error: text.sendEmailError,
          },
          action: {
            error: {
              label: text.retry,
              onClick: () => void handleSendEmail(),
            },
          },
        },
      );
      setToEmails([]);
      setCcEmails([]);
      setBccEmails([]);
      setEmailSubject("");
      setEmailHtmlContent(EMPTY_EMAIL_HTML);
      setEmailTextContent("");
    } catch (error) {
      console.error("[NotificationWorkspace] send email error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCompose = canSendInApp || canSendEmail;
  const inAppDisabled =
    !canSendInApp || isSubmitting || usersLoading || rolesLoading;
  const emailDisabled = !canSendEmail || isSubmitting;

  return (
    <div className="space-y-3">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-normal text-text-primary">
            {text.title}
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">{text.subtitle}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {!canCompose ? (
            <section className="flex items-start gap-3 rounded-radius-md border border-border-subtle bg-surface-elevated p-4">
              <ShieldAlert className="h-5 w-5 shrink-0 text-accent-warning" />
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {text.noPermissionTitle}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {text.noPermissionDesc}
                </p>
              </div>
            </section>
          ) : (
            <>
              <div className="flex w-fit rounded-radius-sm border border-border-subtle bg-surface-elevated p-1">
                {canSendInApp && (
                  <button
                    type="button"
                    onClick={() => setChannel("IN_APP")}
                    className={`flex h-8 items-center gap-2 rounded-radius-sm px-3 text-sm font-semibold ${
                      channel === "IN_APP"
                        ? "bg-brand-primary text-white"
                        : "text-text-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    <Bell className="h-4 w-4" />
                    {text.inAppTab}
                  </button>
                )}
                {canSendEmail && (
                  <button
                    type="button"
                    onClick={() => setChannel("EMAIL")}
                    className={`flex h-8 items-center gap-2 rounded-radius-sm px-3 text-sm font-semibold ${
                      channel === "EMAIL"
                        ? "bg-brand-primary text-white"
                        : "text-text-secondary hover:bg-surface-subtle"
                    }`}
                  >
                    <Mail className="h-4 w-4" />
                    {text.emailTab}
                  </button>
                )}
              </div>

              {channel === "IN_APP" && canSendInApp ? (
                <InAppNotificationForm
                  users={users}
                  roles={roles}
                  selectedUserIds={selectedUserIds}
                  selectedRoleIds={selectedRoleIds}
                  title={inAppTitle}
                  message={inAppMessage}
                  priority={priority}
                  actionUrl={actionUrl}
                  disabled={inAppDisabled}
                  isSubmitting={isSubmitting}
                  labels={text}
                  onSelectedUserIdsChange={setSelectedUserIds}
                  onSelectedRoleIdsChange={setSelectedRoleIds}
                  onTitleChange={setInAppTitle}
                  onMessageChange={setInAppMessage}
                  onPriorityChange={setPriority}
                  onActionUrlChange={setActionUrl}
                  onSubmit={() => void handleSendInApp()}
                />
              ) : (
                <EmailNotificationForm
                  to={toEmails}
                  cc={ccEmails}
                  bcc={bccEmails}
                  subject={emailSubject}
                  htmlContent={emailHtmlContent}
                  disabled={emailDisabled}
                  isSubmitting={isSubmitting}
                  labels={text}
                  onToChange={setToEmails}
                  onCcChange={setCcEmails}
                  onBccChange={setBccEmails}
                  onSubjectChange={setEmailSubject}
                  onEditorChange={(html, plainText) => {
                    setEmailHtmlContent(html);
                    setEmailTextContent(plainText);
                  }}
                  onSubmit={() => void handleSendEmail()}
                />
              )}
            </>
          )}
        </div>

        <NotificationHistoryPanel
          dispatches={dispatches}
          isLoading={isLoading}
          canRead={canReadHistory}
          labels={text}
        />
      </div>
    </div>
  );
}
