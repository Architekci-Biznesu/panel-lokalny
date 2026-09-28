"use client";

import type { ContentChannel } from "@/lib/db/schema";
import { CHANNEL_LABELS } from "@/features/publikacje/content-status";
import type { ChannelOption } from "@/features/publikacje/load-inbox";

/**
 * Channels + group profiles for one publication. Unavailable channels stay
 * visible as "wkrótce"; extra group profiles are unchecked by default.
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
    <div className="pub-targets">
      <div className="pub-targets-row">
        <span className="pub-targets-label">Kanały</span>
        <div className="pub-targets-options">
          {channels.map(({ channel, available }) => (
            <label
              key={channel}
              className={`pub-target-option${available ? "" : " is-soon"}`}
            >
              <input
                type="checkbox"
                className="ui-check"
                checked={available && selected.includes(channel)}
                disabled={!available || disabled}
                onChange={() => onToggleChannel(channel)}
              />
              <span>{CHANNEL_LABELS[channel]}</span>
              {available ? null : (
                <span className="ui-pill ui-pill-neutral">wkrótce</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {groupSiblings.length ? (
        <div className="pub-targets-row">
          <span className="pub-targets-label">
            Publikuj też w{groupName ? ` (${groupName})` : ""}:
          </span>
          <div className="pub-targets-options">
            {groupSiblings.map((profile) => (
              <label key={profile.id} className="pub-target-option">
                <input
                  type="checkbox"
                  className="ui-check"
                  checked={extraProfileIds.includes(profile.id)}
                  disabled={disabled}
                  onChange={() => onToggleProfile(profile.id)}
                />
                <span>{profile.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
