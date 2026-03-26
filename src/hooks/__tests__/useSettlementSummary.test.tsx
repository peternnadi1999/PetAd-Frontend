import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettlementSummary } from '../useSettlementSummary';
import { escrowService } from '../../api/escrowService';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import React from 'react';
import type { SettlementSummary } from '../../types/escrow';

vi.mock('../../api/escrowService', () => ({
  escrowService: {
    getSettlementSummary: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSettlementSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return settlement data successfully', async () => {
    const mockSummary: SettlementSummary = {
      onChainStatus: 'SUCCESS',
      confirmations: 12,
      payments: [
        {
          id: 'pay-1',
          amount: 20000,
          asset: 'XLM',
          destination: 'GD7...X4Y',
          status: 'SUCCESS',
        },
      ],
      stellarExplorerUrl: 'https://stellar.expert/tx/mock',
    };

    vi.mocked(escrowService.getSettlementSummary).mockResolvedValue(mockSummary);

    const { result } = renderHook(() => useSettlementSummary('escrow-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(mockSummary);
    expect(result.current.isError).toBe(false);
    expect(result.current.isNotFound).toBe(false);
  });

  it('should return isNotFound true for 404 error', async () => {
    const error = new Error('Not Found') as any;
    error.status = 404;
    vi.mocked(escrowService.getSettlementSummary).mockRejectedValue(error);

    const { result } = renderHook(() => useSettlementSummary('not-found'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNotFound).toBe(true);
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should return isError true for other errors', async () => {
    vi.mocked(escrowService.getSettlementSummary).mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useSettlementSummary('escrow-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.isNotFound).toBe(false);
  });
});
