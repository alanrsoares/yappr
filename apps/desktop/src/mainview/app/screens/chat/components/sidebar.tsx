import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  MessageCircle,
  MessageSquarePlus,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { dbRpc } from "~/lib/db-rpc";
import { DRAG, NO_DRAG } from "~/lib/drag-region";
import {
  archivedConversationsOptions,
  conversationsOptions,
  conversationsQueryRootKey,
} from "~/lib/queries";
import { cn } from "~/lib/utils";
import { Button } from "~/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/ui/sidebar";

interface ChatSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

type ConvGroup = {
  label: string;
  items: Array<{ id: string; title: string }>;
};

function bucket(now: number, updatedAt: number): string {
  const delta = now - updatedAt;
  if (delta < DAY_MS) return "Today";
  if (delta < 2 * DAY_MS) return "Yesterday";
  if (delta < 7 * DAY_MS) return "Previous 7 days";
  return "Older";
}

const BUCKET_ORDER = ["Today", "Yesterday", "Previous 7 days", "Older"];

const isConvGroup = (group: ConvGroup | undefined): group is ConvGroup =>
  group !== undefined;

function buildGroups(
  list: Array<{ id: string; title: string; updatedAt: number }>,
  now: number,
): ConvGroup[] {
  if (!list || list.length === 0) return [];
  const byLabel = new Map<string, ConvGroup>();
  for (const c of list) {
    const label = bucket(now, c.updatedAt);
    if (!byLabel.has(label)) byLabel.set(label, { label, items: [] });
    byLabel.get(label)!.items.push({ id: c.id, title: c.title });
  }
  return BUCKET_ORDER.map((label) => byLabel.get(label)).filter(isConvGroup);
}

export function ChatSidebar({
  activeConversationId,
  onSelectConversation,
}: ChatSidebarProps) {
  const queryClient = useQueryClient();
  const [archivedOpen, setArchivedOpen] = useState(false);
  const { data: conversations } = useQuery(conversationsOptions);
  const { data: archivedConversations } = useQuery(
    archivedConversationsOptions,
  );

  const newChat = useMutation({
    mutationFn: () =>
      dbRpc.request("conversations:create", { title: "New chat" }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: conversationsQueryRootKey });
      onSelectConversation(conv.id);
    },
  });

  const setArchived = useMutation({
    mutationFn: (input: { id: string; archived: boolean }) =>
      dbRpc.request("conversations:setArchived", input),
    onSuccess: (_, { id, archived }) => {
      queryClient.invalidateQueries({ queryKey: conversationsQueryRootKey });
      if (archived && id === activeConversationId) {
        onSelectConversation(null);
      }
    },
  });

  const deleteConv = useMutation({
    mutationFn: (id: string) => dbRpc.request("conversations:delete", { id }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: conversationsQueryRootKey });
      queryClient.removeQueries({ queryKey: ["db", "messages", id] });
      if (id === activeConversationId) {
        onSelectConversation(null);
      }
    },
  });

  const { groups, archivedGroups } = useMemo(() => {
    // Buckets are wall-clock relative (Today / Yesterday / …).
    const now = Date.now();
    return {
      groups: buildGroups(
        (conversations ?? []).map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
        })),
        now,
      ),
      archivedGroups: buildGroups(
        (archivedConversations ?? []).map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
        })),
        now,
      ),
    };
  }, [conversations, archivedConversations]);

  const archivedTotal = archivedConversations?.length ?? 0;
  const convActionsBusy = setArchived.isPending || deleteConv.isPending;

  return (
    <Sidebar collapsible="icon" className="border-r border-black/60 pt-8">
      <SidebarHeader className={cn("border-b border-black/60 p-2", DRAG)}>
        <div className="flex items-center gap-2 px-1 py-1 pl-16 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:pl-0 group-data-[collapsible=icon]:justify-center">
          <MessageCircle
            className="size-4 shrink-0 text-led-amber/80"
            aria-hidden="true"
          />
          <span
            translate="no"
            className="font-mono text-sm font-semibold tracking-tight text-foreground group-data-[collapsible=icon]:hidden"
          >
            Yappr
          </span>
        </div>

        <SidebarMenu className="mt-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New chat"
              className={cn("font-mono text-xs", NO_DRAG)}
              onClick={() => newChat.mutate()}
              disabled={newChat.isPending}
            >
              <MessageSquarePlus aria-hidden="true" />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <ConversationRow
                    key={item.id}
                    title={item.title}
                    isActive={item.id === activeConversationId}
                    kind="active"
                    disabled={convActionsBusy}
                    onSelect={() => onSelectConversation(item.id)}
                    onArchive={() =>
                      setArchived.mutate({ id: item.id, archived: true })
                    }
                    onDelete={() => deleteConv.mutate(item.id)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {archivedTotal > 0 ? (
          <SidebarGroup className="mt-2 border-t border-black/40 pt-2">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-1 px-2 py-1.5 font-mono text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground",
                NO_DRAG,
              )}
              onClick={() => setArchivedOpen((o) => !o)}
            >
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 transition-transform",
                  archivedOpen && "rotate-90",
                )}
                aria-hidden="true"
              />
              <span>Archived</span>
              <span className="ml-auto tabular-nums opacity-70">
                {archivedTotal}
              </span>
            </button>
            {archivedOpen ? (
              <SidebarGroupContent>
                {archivedGroups.map((group) => (
                  <div key={group.label} className="mt-2 first:mt-0">
                    <SidebarGroupLabel className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground/90">
                      {group.label}
                    </SidebarGroupLabel>
                    <SidebarMenu className="mt-1">
                      {group.items.map((item) => (
                        <ConversationRow
                          key={item.id}
                          title={item.title}
                          isActive={item.id === activeConversationId}
                          kind="archived"
                          disabled={convActionsBusy}
                          onSelect={() => onSelectConversation(item.id)}
                          onUnarchive={() =>
                            setArchived.mutate({
                              id: item.id,
                              archived: false,
                            })
                          }
                          onDelete={() => deleteConv.mutate(item.id)}
                        />
                      ))}
                    </SidebarMenu>
                  </div>
                ))}
              </SidebarGroupContent>
            ) : null}
          </SidebarGroup>
        ) : null}
      </SidebarContent>
    </Sidebar>
  );
}

interface ConversationRowProps {
  title: string;
  isActive: boolean;
  kind: "active" | "archived";
  disabled?: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete: () => void;
}

function ConversationRow({
  title,
  isActive,
  kind,
  disabled,
  onSelect,
  onArchive,
  onUnarchive,
  onDelete,
}: ConversationRowProps) {
  return (
    <SidebarMenuItem>
      <div className="group/conv flex w-full min-w-0 items-stretch gap-0">
        <SidebarMenuButton
          tooltip={title}
          className="min-w-0 flex-1 pr-1 font-mono text-sm"
          isActive={isActive}
          onClick={onSelect}
        >
          <MessageCircle aria-hidden="true" className="shrink-0" />
          <span className="truncate">{title}</span>
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className={cn(
                "size-8 shrink-0 opacity-0 transition-opacity group-hover/conv:opacity-100 data-[state=open]:opacity-100 group-data-[collapsible=icon]:opacity-100",
                NO_DRAG,
              )}
              aria-label="Conversation actions"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={4}
            className={cn("min-w-[10rem] font-mono text-xs", NO_DRAG)}
          >
            {kind === "active" ? (
              <DropdownMenuItem
                disabled={disabled}
                className="gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  onArchive?.();
                }}
              >
                <Archive className="size-3.5" aria-hidden="true" />
                Archive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={disabled}
                className="gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  onUnarchive?.();
                }}
              >
                <ArchiveRestore className="size-3.5" aria-hidden="true" />
                Unarchive
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={disabled}
              className={cn(
                "gap-2 text-destructive focus:bg-destructive/15 focus:text-destructive",
              )}
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SidebarMenuItem>
  );
}
