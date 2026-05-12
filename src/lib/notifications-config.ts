// Plain runtime constants + type aliases for the notifications system.
// These live outside the "use server" file in src/app/actions/notifications.ts
// because Next.js doesn't allow non-async exports from a "use server"
// module. Server actions and client components both import from here.

export type NotificationType =
  | "task_assigned"
  | "task_comment"
  | "task_due_soon"
  | "announcement_posted"
  | "announcement_mention"
  | "event_invited"
  | "event_reminder"
  | "board_member_added"
  | "board_card_assigned"
  | "board_card_comment"
  | "board_card_mention"
  | "team_member_invited"
  | "team_member_joined"
  | "department_assigned"
  | "mention"
  | "system";

export type NotificationEntityType =
  | "task"
  | "announcement"
  | "event"
  | "board"
  | "board_card"
  | "profile"
  | "department"
  | "organization";

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationType,
  { in_app: boolean; email: boolean }
> = {
  task_assigned: { in_app: true, email: true },
  task_comment: { in_app: true, email: false },
  task_due_soon: { in_app: true, email: false },
  announcement_posted: { in_app: true, email: false },
  announcement_mention: { in_app: true, email: true },
  event_invited: { in_app: true, email: true },
  event_reminder: { in_app: true, email: false },
  board_member_added: { in_app: true, email: true },
  board_card_assigned: { in_app: true, email: false },
  board_card_comment: { in_app: true, email: false },
  board_card_mention: { in_app: true, email: true },
  team_member_invited: { in_app: true, email: false },
  team_member_joined: { in_app: true, email: false },
  department_assigned: { in_app: true, email: false },
  mention: { in_app: true, email: false },
  system: { in_app: true, email: false },
};

export const NOTIFICATION_CATEGORIES: {
  category: string;
  description: string;
  items: { type: NotificationType; label: string; description: string }[];
}[] = [
  {
    category: "Tasks",
    description: "Updates about tasks you own or are assigned to.",
    items: [
      {
        type: "task_assigned",
        label: "Task assigned to you",
        description: "When someone assigns you a task.",
      },
      {
        type: "task_comment",
        label: "Comment on your task",
        description:
          "When someone comments on a task you created or are assigned to.",
      },
    ],
  },
  {
    category: "Announcements",
    description: "New posts in your org or department.",
    items: [
      {
        type: "announcement_posted",
        label: "New announcement",
        description:
          "When a new announcement is posted to your org or department.",
      },
    ],
  },
  {
    category: "Calendar",
    description: "Invitations and reminders for events.",
    items: [
      {
        type: "event_invited",
        label: "Invited to an event",
        description: "When you're added as an attendee on an event.",
      },
    ],
  },
  {
    category: "Project Boards",
    description: "Updates on the boards and cards you're part of.",
    items: [
      {
        type: "board_member_added",
        label: "Added to a board",
        description: "When someone adds you to a project board.",
      },
      {
        type: "board_card_assigned",
        label: "Card assigned to you",
        description: "When someone assigns you to a card on a board.",
      },
      {
        type: "board_card_comment",
        label: "Comment on your card",
        description:
          "When someone comments on a card you own or are assigned to.",
      },
    ],
  },
  {
    category: "Team",
    description: "Updates about your church's team and departments.",
    items: [
      {
        type: "team_member_joined",
        label: "New teammate joined",
        description: "When an invitee accepts and joins your organization.",
      },
      {
        type: "department_assigned",
        label: "Added to a department",
        description: "When someone assigns you to a ministry or department.",
      },
    ],
  },
];
