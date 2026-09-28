"use client";

import { Check } from "lucide-react";
import type { ContentChannel } from "@/lib/db/schema";
import { CHANNEL_LABELS } from "@/features/publikacje/content-status";
import type { ChannelOption } from "@/features/publikacje/load-inbox";

/** One toggle chip: a real checkbox styled as a pill. */
function ChipToggle({
  label,
  checked,
  disabled,
  soon,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  soon?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`pub-chip${checked ? " is-on" : ""}${soon ? " is-soon" : ""}`}
    >
      <input
        type="checkbox"
        className="pub-chip-input"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      {soon ? null : (
        <span className="pub-chip-mark" aria-hidden>
          <Check />
        </span>
      )}
      <span>{label}</span>
      {soon ? <span className="pub-chip-soon">wkrótce</span> : null}
    </label>
  );
}

/**
 * Where to publish: channels + group profiles as chips. Unavailable channels
 * stay visible as "wkrótce"; extra group profiles are unchecked by default.
 * Rendered inside the card's publish bar (rows "Gdzie" / "Też w").
 */
export function ChannelPicker({
  channels,
  selected,
  onToggleChannel,
  groupName,
  groupSiblings,
  extraProfileIds,
  onToggleProfile,
  disabled,
}: {
  channels: ChannelOption[];
  selected: ContentChannel[];
  onToggleChannel: (channel: ContentChannel) => void;
  groupName: string | null;
  groupSiblings: Array<{ id: string; name: string }>;
  extraProfileIds: string[];
  onToggleProfile: (profileId: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="pub-publish-row">
        <span className="pub-publish-label">Gdzie</span>
        <div className="pub-publish-options">
          {channels.map(({ channel, available }) => (
            <ChipToggle
              key={channel}
              label={CHANNEL_LABELS[channel]}
              checked={available && selected.includes(channel)}
              disabled={!available || disabled}
              soon={!available}
              onChange={() => onToggleChannel(channel)}
            />
          ))}
        </div>
      </div>

      {groupSiblings.length ? (
        <div className="pub-publish-row">
          <span className="pub-publish-label">Też w</span>
          <div className="pub-publish-options">
            {groupSiblings.map((profile) => (
              <ChipToggle
                key={profile.id}
                label={profile.name}
                checked={extraProfileIds.includes(profile.id)}
                disabled={disabled}
                onChange={() => onToggleProfile(profile.id)}
              />
            ))}
            {groupName ? (
              <span className="pub-publish-hint">grupa {groupName}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
