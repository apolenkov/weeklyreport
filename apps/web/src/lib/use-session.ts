// Canonical re-export — consumers may import either path. Keeping the
// component file ('.tsx') and the hook file ('.ts') split mirrors the
// useTRPC / TRPCProxyContext pattern in trpc-context.ts + trpc.ts.
export {
  type SessionState,
  type SessionUser,
  useSession,
} from "./session-provider";
