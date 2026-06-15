"use client";

import { useState } from "react";
import type { HuddleDetail } from "@/app/actions/huddles";
import { HuddleHeader } from "./huddle-header";
import { OverviewTab } from "./overview-tab";
import { AgendaTab } from "./agenda-tab";
import { NotesTab } from "./notes-tab";
import { OutcomesTab } from "./outcomes-tab";
import { HuddleSettingsPanel } from "./huddle-settings-panel";

interface HuddleDetailViewProps {
  initial: HuddleDetail;
  departments: { id: string; name: string }[];
}

type Tab = "overview" | "agenda" | "notes" | "outcomes";

// Timeline-based IA: set up (Overview) → plan (Agenda) → run (Notes)
// → results (Outcomes). The settings gear in the header opens a modal
// for per-huddle config so it doesn't muddy the running-the-meeting
// tabs.
export function HuddleDetailView({
  initial,
  departments,
}: HuddleDetailViewProps) {
  const [detail, setDetail] = useState<HuddleDetail>(initial);
  const [tab, setTab] = useState<Tab>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="bg-[#F4F5F7] min-h-full">
      <HuddleHeader
        huddle={detail}
        onPatch={(patch) => setDetail({ ...detail, ...patch })}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="max-w-5xl mx-auto px-5 py-5">
        <nav className="flex items-center gap-1 mb-4">
          <TabButton
            active={tab === "overview"}
            onClick={() => setTab("overview")}
          >
            Overview
          </TabButton>
          <TabButton
            active={tab === "agenda"}
            onClick={() => setTab("agenda")}
            count={detail.agenda.length}
          >
            Agenda
          </TabButton>
          <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>
            Notes
          </TabButton>
          <TabButton
            active={tab === "outcomes"}
            onClick={() => setTab("outcomes")}
            count={detail.action_items.length + detail.decisions.length}
          >
            Outcomes
          </TabButton>
        </nav>

        {tab === "overview" && (
          <OverviewTab
            huddle={detail}
            onAttendeesChange={(a) =>
              setDetail({ ...detail, attendees: a, attendee_count: a.length })
            }
          />
        )}
        {tab === "agenda" && (
          <AgendaTab
            huddleId={detail.id}
            items={detail.agenda}
            canEdit={detail.viewer_can_edit}
            onItemsChange={(items) =>
              setDetail({
                ...detail,
                agenda: items,
                agenda_count: items.length,
              })
            }
          />
        )}
        {tab === "notes" && (
          <NotesTab
            huddleId={detail.id}
            notes={detail.notes}
            canEdit={detail.viewer_can_edit}
            onActionAdded={(item) =>
              setDetail({
                ...detail,
                action_items: [...detail.action_items, item],
                action_item_count: detail.action_item_count + 1,
              })
            }
            onDecisionAdded={(d) =>
              setDetail({ ...detail, decisions: [...detail.decisions, d] })
            }
          />
        )}
        {tab === "outcomes" && (
          <OutcomesTab
            huddleId={detail.id}
            actionItems={detail.action_items}
            decisions={detail.decisions}
            canEdit={detail.viewer_can_edit}
            onActionsChange={(items) =>
              setDetail({
                ...detail,
                action_items: items,
                action_item_count: items.length,
              })
            }
            onDecisionsChange={(items) =>
              setDetail({ ...detail, decisions: items })
            }
          />
        )}
      </div>

      <HuddleSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        huddle={detail}
        departments={departments}
        onPatch={(patch) => setDetail({ ...detail, ...patch })}
      />
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  count,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3 rounded-lg text-[13px] inline-flex items-center gap-1.5 transition-colors ${
        active
          ? "bg-[#5CE1A5]/15 text-[#059669]"
          : "text-[#6B7280] hover:bg-[#F4F5F7] hover:text-[#2D333A]"
      }`}
      style={{
        fontFamily: "var(--font-poppins)",
        fontWeight: active ? 700 : 600,
      }}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span
          className="h-4 min-w-4 px-1 rounded-full bg-[#0F172A]/10 text-[10px] tabular-nums inline-flex items-center justify-center"
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 700 }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
