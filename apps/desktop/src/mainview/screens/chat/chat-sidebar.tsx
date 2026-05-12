import { MessageCircle, MessageSquarePlus } from "lucide-react";

import { DRAG, NO_DRAG } from "~/lib/drag-region";
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

// Placeholder conversation data — wire to real persistence later.
const PLACEHOLDER_GROUPS = [
  {
    label: "Today",
    items: [{ id: "draft", title: "New conversation" }],
  },
];

export function ChatSidebar() {
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
            >
              <MessageSquarePlus aria-hidden="true" />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {PLACEHOLDER_GROUPS.map((group) => (
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
                      isActive={item.id === "draft"}
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
