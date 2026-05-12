import { useMemo } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, MessageSquarePlus } from "lucide-react";

import { dbRpc } from "~/lib/db-rpc";
import { DRAG, NO_DRAG } from "~/lib/drag-region";
import { conversationsOptions } from "~/lib/queries";
import { cn } from "~/lib/utils";
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

export function ChatSidebar({
  activeConversationId,
  onSelectConversation,
}: ChatSidebarProps) {
  const queryClient = useQueryClient();
  const { data: conversations } = useQuery(conversationsOptions);

  const newChat = useMutation({
    mutationFn: () =>
      dbRpc.request("conversations:create", { title: "New chat" }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({
        queryKey: conversationsOptions.queryKey,
      });
      onSelectConversation(conv.id);
    },
  });

  const groups: ConvGroup[] = useMemo(() => {
    if (!conversations || conversations.length === 0) return [];
    const now = Date.now();
    const byLabel = new Map<string, ConvGroup>();
    for (const c of conversations) {
      const label = bucket(now, c.updatedAt);
      if (!byLabel.has(label)) byLabel.set(label, { label, items: [] });
      byLabel.get(label)!.items.push({ id: c.id, title: c.title });
    }
    return BUCKET_ORDER.map((label) => byLabel.get(label)).filter(
      (g): g is ConvGroup => !!g,
    );
  }, [conversations]);

  return (
    <Sidebar collapsible="icon" className="border-r border-black/60 pt-8">
      <SidebarHeader className={cn("border-b border-black/60 p-2", DRAG)}>
        {/* Brand row: when expanded, leaves room for the macOS traffic-light
            cluster (pl-16). When collapsed to icon mode, only the icon shows. */}
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
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      className="font-mono text-sm"
                      isActive={item.id === activeConversationId}
                      onClick={() => onSelectConversation(item.id)}
                    >
                      <MessageCircle aria-hidden="true" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
