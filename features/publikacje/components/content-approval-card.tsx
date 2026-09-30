"use client";

import {
  Check,
  Loader2,
  MessageSquareText,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "@/lib/toast";
import { RejectPopover } from "@/components/ui/reject-popover";
import type { ContentChannel } from "@/lib/db/schema";
import {
  acceptContent,
  generateContentImage,
  getContentPublishStatus,
  rejectContent,
  removePostImage,
  uploadPostImage,
} from "@/features/publikacje/actions";
import { PostImagePicker } from "@/features/publikacje/components/post-image-picker";
import { PostTextEditor } from "@/features/publikacje/components/post-text-editor";
import { ChannelPicker } from "@/features/publikacje/components/channel-picker";
import type {
  ChannelOption,
  InboxItem,
} from "@/features/publikacje/load-inbox";
import { MANUAL_BODY_MAX } from "@/features/publikacje/manual-post-rules";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";

const POLL_MS = 2000;
const POLL_LIMIT = 30;

/** Today as "YYYY-MM-DD" - posts cannot be scheduled in the past. */
function todayValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
  }).format(date);
}

/** Waits for background publishing and reports each target by name. */
async function reportPublishResult(
  itemId: string,
  profileNames: Map<string, string>,
) {
  for (let i = 0; i < POLL_LIMIT; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const status = await getContentPublishStatus({ itemId });
    if (!status.ok) return;
    if (status.targets.some((t) => t.status === "queued")) continue;

    const failed = status.targets.filter((t) => t.status === "failed");
    const published = status.targets.filter((t) => t.status === "published");
    if (published.length) {
      toast.success({
        title:
          published.length > 1
            ? `Opublikowano w ${published.length} wizytówkach`
            : "Post jest już w Google",
      });
    }
    for (const target of failed) {
      toast.error({
        title: `Nie opublikowano: ${profileNames.get(target.profileId) ?? "wizytówka"}`,
        description: target.error ?? undefined,
      });
    }
    return;
  }
  toast.info({
    title: "Publikacja trwa dłużej",
    description: "Sprawdź status w zakładce Wszystkie.",
  });
}

/**
 * One AI proposal in the inbox: image, title, post, targets and the three
 * decisions - Akceptuj / Edytuj przez czat / Odrzuć.
 */
export function ContentApprovalCard({
  item,
  channels,
  groupName,
  groupSiblings,
  activeProfile,
  isEditing,
  onEdit,
  onExitEdit,
}: {
  item: InboxItem;
  channels: ChannelOption[];
  groupName: string | null;
  groupSiblings: Array<{ id: string; name: string }>;
  activeProfile: { id: string; name: string };
  /** This post is open in the docked chat. */
  isEditing: boolean;
  /** Opens the post in the docked chat (edit mode). */
  onEdit: () => void;
  /** Closes the edit mode (the "Edytujesz z AI" badge). */
  onExitEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<
    "accept" | "reject" | "image" | "upload" | null
  >(null);
  const [selected, setSelected] = useState<ContentChannel[]>(
    channels.filter((c) => c.available).map((c) => c.channel),
  );
  const [extraProfileIds, setExtraProfileIds] = useState<string[]>([]);
  const [schedule, setSchedule] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");

  const disabled = pending || busy !== null;

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  function accept() {
    if (!selected.length) {
      toast.error({ title: "Wybierz co najmniej jeden kanał" });
      return;
    }
    let scheduledAt: string | null = null;
    if (schedule) {
      if (!date) {
        toast.error({ title: "Wybierz dzień publikacji" });
        return;
      }
      const when = new Date(`${date}T${time}:00`);
      if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
        toast.error({ title: "Data publikacji musi być w przyszłości" });
        return;
      }
      scheduledAt = when.toISOString();
    }

    setBusy("accept");
    startTransition(async () => {
      const result = await acceptContent({
        itemId: item.id,
        channels: selected,
        extraProfileIds,
        scheduledAt,
      });
      if (!result.ok) {
        setBusy(null);
        toast.error({ title: "Nie zaakceptowano", description: result.error });
        return;
      }
      if (result.status === "scheduled") {
        toast.success({ title: "Zaplanowano publikację" });
      } else {
        toast.info({ title: "Publikuję w Google…" });
        const names = new Map(
          [activeProfile, ...groupSiblings].map((p) => [p.id, p.name]),
        );
        await reportPublishResult(item.id, names);
      }
      setBusy(null);
      router.refresh();
    });
  }

  function reject(reason: string | undefined) {
    setBusy("reject");
    startTransition(async () => {
      const result = await rejectContent({ itemId: item.id, reason });
      setBusy(null);
      if (!result.ok) {
        toast.error({ title: "Nie odrzucono", description: result.error });
        return;
      }
      toast.success({
        title:
          item.origin === "manual"
            ? "Post usunięty z listy"
            : "Propozycja odrzucona",
        description: reason
          ? "Powód trafił do kontekstu firmy - AI nie zaproponuje tego ponownie."
          : undefined,
      });
      router.refresh();
    });
  }

  function uploadImage(file: File) {
    const data = new FormData();
    data.set("itemId", item.id);
    data.set("image", file);
    setBusy("upload");
    startTransition(async () => {
      const result = await uploadPostImage(data);
      setBusy(null);
      if (!result.ok) {
        toast.error({ title: "Nie wgrano zdjęcia", description: result.error });
        return;
      }
      toast.success({ title: "Zdjęcie dodane do posta" });
      router.refresh();
    });
  }

  function removeImage() {
    setBusy("upload");
    startTransition(async () => {
      const result = await removePostImage({ itemId: item.id });
      setBusy(null);
      if (!result.ok) {
        toast.error({
          title: "Nie usunięto zdjęcia",
          description: result.error,
        });
        return;
      }
      toast.success({
        title: "Usunięto zdjęcie",
        description: "Możesz je przywrócić w czacie: „Cofnij ostatnią zmianę”.",
      });
      router.refresh();
    });
  }

  function makeImage() {
    setBusy("image");
    startTransition(async () => {
      const result = await generateContentImage({ itemId: item.id });
      setBusy(null);
      if (!result.ok) {
        toast.error({
          title: "Nie powstała grafika",
          description: result.error,
        });
        return;
      }
      toast.success({ title: "Grafika gotowa" });
      router.refresh();
    });
  }

  const meta = (
    <div className="pub-card-meta">
      {item.origin === "manual" ? (
        <span className="pub-origin is-manual">
          <UserRound aria-hidden />
          Twój post
        </span>
      ) : (
        <span className="pub-origin">
          <Sparkles aria-hidden />
          Propozycja AI
        </span>
      )}
      <span className="pub-card-meta-text">Post w Google</span>
      <span className="pub-card-dot" aria-hidden />
      <span className="pub-card-meta-text mono">
        {formatDay(new Date(item.createdAt))}
      </span>
      {item.revisionCount > 0 ? (
        <>
          <span className="pub-card-dot" aria-hidden />
          <span className="pub-card-meta-text">
            zmiany: <span className="mono">{item.revisionCount}</span>
          </span>
        </>
      ) : null}
      <span className="pub-card-count mono">
        {item.body.length} / {MANUAL_BODY_MAX} zn.
      </span>
    </div>
  );

  return (
    <article
      id={`pub-post-${item.id}`}
      className={`pub-card${isEditing ? " is-editing" : ""}`}
    >
      {isEditing ? (
        <span className="pub-card-badge">
          <Sparkles aria-hidden />
          <span className="pub-ai-text">Edytujesz z AI</span>
          <span className="pub-card-badge-sep" aria-hidden />
          <button
            type="button"
            className="pub-card-badge-close"
            aria-label="Zakończ edycję z AI"
            title="Zakończ edycję"
            onClick={onExitEdit}
          >
            <X aria-hidden />
          </button>
        </span>
      ) : null}

      <div className="pub-card-top">
        <div className="pub-card-media">
          <PostImagePicker
            previewUrl={item.imageUrl}
            disabled={disabled}
            busy={busy === "upload"}
            onPick={uploadImage}
            onRemove={removeImage}
            onGenerate={makeImage}
            generating={busy === "image"}
          />
        </div>

        <div className="pub-card-main">
          {meta}
          <PostTextEditor item={item} disabled={disabled} />
        </div>
      </div>

      <div className="pub-publish">
        <ChannelPicker
          channels={channels}
          selected={selected}
          onToggleChannel={(channel) =>
            setSelected((list) => toggle(list, channel))
          }
          groupName={groupName}
          groupSiblings={groupSiblings}
          extraProfileIds={extraProfileIds}
          onToggleProfile={(id) =>
            setExtraProfileIds((list) => toggle(list, id))
          }
          disabled={disabled}
        />

        <div className="pub-publish-row">
          <span className="pub-publish-label">Kiedy</span>
          <div className="pub-publish-options">
            <div
              className="pub-when"
              role="group"
              aria-label="Kiedy opublikować"
            >
              <button
                type="button"
                className={`pub-when-option${schedule ? "" : " is-active"}`}
                aria-pressed={!schedule}
                disabled={disabled}
                onClick={() => setSchedule(false)}
              >
                Od razu
              </button>
              <button
                type="button"
                className={`pub-when-option${schedule ? " is-active" : ""}`}
                aria-pressed={schedule}
                disabled={disabled}
                onClick={() => setSchedule(true)}
              >
                Zaplanuj
              </button>
            </div>
            {schedule ? (
              <div className="pub-card-schedule">
                <DateField
                  className="pub-card-date-field"
                  ariaLabel="Dzień publikacji"
                  value={date}
                  min={todayValue()}
                  disabled={disabled}
                  onChange={setDate}
                />
                <TimeField
                  className="pub-card-time"
                  ariaLabel="Godzina publikacji"
                  value={time}
                  onChange={setTime}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="pub-card-actions">
        <button
          type="button"
          className={`ui-btn pub-card-chat${isEditing ? " is-active" : ""}`}
          disabled={disabled}
          aria-pressed={isEditing}
          onClick={onEdit}
        >
          <MessageSquareText aria-hidden />
          {isEditing ? "Edytujesz w czacie" : "Edytuj przez czat"}
        </button>
        <div className="pub-card-decide">
          {item.origin === "manual" ? (
            <button
              type="button"
              className="ui-btn ui-btn-soft-danger"
              disabled={disabled}
              onClick={() => reject(undefined)}
            >
              {busy === "reject" ? (
                <Loader2 aria-hidden className="ui-btn-spinner" />
              ) : (
                <Trash2 aria-hidden />
              )}
              Usuń
            </button>
          ) : (
            <RejectPopover pending={busy === "reject"} onConfirm={reject} />
          )}
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={disabled}
            onClick={accept}
          >
            {busy === "accept" ? (
              <Loader2 aria-hidden className="ui-btn-spinner" />
            ) : (
              <Check aria-hidden />
            )}
            {schedule ? "Akceptuj i zaplanuj" : "Akceptuj i opublikuj"}
          </button>
        </div>
      </footer>
    </article>
  );
}
