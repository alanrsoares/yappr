"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { StickToBottom } from "use-stick-to-bottom";

import { cn } from "~/lib/utils";

export type ChatContainerRootProps = {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export type ChatContainerContentProps = {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

const ChatContainerRoot = ({
  children,
  className,
  ...props
}: ChatContainerRootProps) => (
  <StickToBottom
    className={cn("flex overflow-y-auto", className)}
    resize="smooth"
    initial="instant"
    role="log"
    {...props}
  >
    {children}
  </StickToBottom>
);

const ChatContainerContent = ({
  children,
  className,
  ...props
}: ChatContainerContentProps) => (
  <StickToBottom.Content
    className={cn("flex w-full flex-col", className)}
    {...props}
  >
    {children}
  </StickToBottom.Content>
);

const ChatContainerScrollAnchor = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("h-px w-full shrink-0 scroll-mt-4", className)}
    aria-hidden="true"
    {...props}
  />
);

export { ChatContainerContent, ChatContainerRoot, ChatContainerScrollAnchor };
