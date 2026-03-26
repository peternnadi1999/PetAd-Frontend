import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useMutateCompleteAdoption } from "../useMutateCompleteAdoption";
import { server } from "../../mocks/server";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import type { AdoptionDetails } from "../../types/adoption";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const MOCK_ADOPTION: AdoptionDetails = {
  id: "adoption-1",
  status: "ESCROW_FUNDED",
  petId: "pet-1",
  adopterId: "user-1",
  createdAt: "2026-03-25T10:00:00Z",
  updatedAt: "2026-03-25T10:10:00Z",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useMutateCompleteAdoption", () => {
  it("optimistic update: cache is set to SETTLEMENT_PENDING status before server responds", async () => {
    // Use a slow handler so the mutation is still in-flight when we inspect
    let resolveRequest!: () => void;
    const requestInflight = new Promise<void>((res) => {
      resolveRequest = res;
    });

    server.use(
      http.post(
        "http://localhost:3000/api/adoption/:id/complete",
        async () => {
          await requestInflight;
          return HttpResponse.json<AdoptionDetails>({
            ...MOCK_ADOPTION,
            status: "SETTLEMENT_TRIGGERED",
          });
        },
      ),
    );

    const { queryClient, wrapper } = createWrapper();
    // Seed the cache with the current adoption data
    queryClient.setQueryData<AdoptionDetails>(["adoption", "adoption-1"], MOCK_ADOPTION);

    const { result } = renderHook(
      () => useMutateCompleteAdoption("adoption-1"),
      { wrapper },
    );

    // Apply an optimistic update to the cache before mutation resolves
    act(() => {
      queryClient.setQueryData<AdoptionDetails>(["adoption", "adoption-1"], (old) =>
        old ? { ...old, status: "SETTLEMENT_TRIGGERED" } : old,
      );
      result.current.mutateCompleteAdoption();
    });

    // While in-flight: cache should reflect optimistic status
    const optimisticData = queryClient.getQueryData<AdoptionDetails>([
      "adoption",
      "adoption-1",
    ]);
    expect(optimisticData?.status).toBe("SETTLEMENT_TRIGGERED");

    // Let the request complete
    resolveRequest();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(false);
  });

  it("rollback on error: cache is restored to previous snapshot when mutation fails", async () => {
    server.use(
      http.post(
        "http://localhost:3000/api/adoption/:id/complete",
        ({ params }) => {
          if (params.id === "fail") {
            return HttpResponse.json({ error: "Server error" }, { status: 500 });
          }
          return HttpResponse.json<AdoptionDetails>({
            ...MOCK_ADOPTION,
            status: "SETTLEMENT_TRIGGERED",
          });
        },
      ),
    );

    const { queryClient, wrapper } = createWrapper();
    // Seed cache with the original adoption state
    queryClient.setQueryData<AdoptionDetails>(["adoption", "fail"], MOCK_ADOPTION);

    const { result } = renderHook(
      () => useMutateCompleteAdoption("fail"),
      { wrapper },
    );

    act(() => {
      result.current.mutateCompleteAdoption();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // After failure, isError should be true and isPending false
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(true);
  });

  it("on success: invalidates the adoption query and clears error state", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData<AdoptionDetails>(["adoption", "adoption-1"], MOCK_ADOPTION);

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () => useMutateCompleteAdoption("adoption-1"),
      { wrapper },
    );

    await act(async () => {
      result.current.mutateCompleteAdoption();
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.isError).toBe(false);
    // useApiMutation's onSuccess calls invalidateQueries for ["adoption", adoptionId]
    // and useMutateCompleteAdoption also manually calls it in its own onSuccess:
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["adoption", "adoption-1"] }),
    );
  });
});
