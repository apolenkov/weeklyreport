"use client";

import {
  MAX_FULL_NAME_LENGTH,
  MAX_SHORT_NAME_LENGTH,
  type OrganizationPublic,
  type OrganizationUpdate,
} from "@customreport/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { revalidateOrgLandingPage } from "../../../shared/ui/settings/settings-tab";

type IdentityDraft = OrganizationUpdate;

interface SubmittedIdentity {
  readonly baseIdentity: string;
  readonly value: OrganizationPublic;
}

const EMPTY_IDENTITY: IdentityDraft = { shortName: "", fullName: "" };

function useSaveOrgIdentity(onSaved: () => void) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return useMutation(
    trpc.admin.updateOrganization.mutationOptions({
      onSuccess: async () => {
        onSaved();
        invalidateAdmin(qc, trpc);
        toast.success("Organization identity saved");
        await revalidateOrgLandingPage();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
}

function identityKey(value: IdentityDraft | undefined): string | undefined {
  return value ? JSON.stringify([value.shortName, value.fullName]) : undefined;
}

function visibleIdentity(
  draft: IdentityDraft | undefined,
  submitted: SubmittedIdentity | undefined,
  serverIdentity: string | undefined,
  serverValue: IdentityDraft | undefined,
): IdentityDraft {
  const submittedValue =
    submitted === undefined || submitted.baseIdentity !== serverIdentity
      ? undefined
      : submitted.value;
  return draft ?? submittedValue ?? serverValue ?? EMPTY_IDENTITY;
}

function canSaveIdentity(
  value: IdentityDraft,
  isPending: boolean,
  isHydrated: boolean,
  loadError: boolean,
): boolean {
  return (
    !isPending &&
    isHydrated &&
    !loadError &&
    value.shortName.trim().length > 0 &&
    value.fullName.trim().length > 0 &&
    value.shortName.length <= MAX_SHORT_NAME_LENGTH &&
    value.fullName.length <= MAX_FULL_NAME_LENGTH
  );
}

export function useOrgIdentityForm() {
  const trpc = useTRPC();
  const orgQuery = useQuery(trpc.admin.getOrganization.queryOptions());
  const [draft, setDraft] = useState<IdentityDraft>();
  const [submitted, setSubmitted] = useState<SubmittedIdentity>();
  const pendingSave = useRef<SubmittedIdentity | null>(null);
  const serverIdentity = identityKey(orgQuery.data);
  const value = visibleIdentity(
    draft,
    submitted,
    serverIdentity,
    orgQuery.data,
  );
  const updateMutation = useSaveOrgIdentity(() => {
    if (pendingSave.current !== null) setSubmitted(pendingSave.current);
    setDraft(undefined);
  });
  const isHydrated = !orgQuery.isLoading && orgQuery.data !== undefined;

  return {
    ...value,
    shortNameOver: value.shortName.length > MAX_SHORT_NAME_LENGTH,
    fullNameOver: value.fullName.length > MAX_FULL_NAME_LENGTH,
    isSaving: updateMutation.isPending,
    isSaved: updateMutation.isSuccess,
    loadError: orgQuery.isError,
    isLoading: orgQuery.isLoading,
    isHydrated,
    canSave: canSaveIdentity(
      value,
      updateMutation.isPending,
      isHydrated,
      orgQuery.isError,
    ),
    editShortName: (shortName: string) => {
      if (updateMutation.isPending) return;
      updateMutation.reset();
      setSubmitted(undefined);
      setDraft({ shortName, fullName: value.fullName });
    },
    editFullName: (fullName: string) => {
      if (updateMutation.isPending) return;
      updateMutation.reset();
      setSubmitted(undefined);
      setDraft({ shortName: value.shortName, fullName });
    },
    save: () => {
      if (updateMutation.isPending) return;
      const input = {
        shortName: value.shortName.trim(),
        fullName: value.fullName.trim(),
      };
      if (serverIdentity !== undefined) {
        pendingSave.current = { baseIdentity: serverIdentity, value: input };
      }
      updateMutation.mutate(input);
    },
  };
}
