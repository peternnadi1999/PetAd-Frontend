import type { SettlementSummary } from "../types/escrow";

/**
 * escrowService
 *
 * Placeholder escrow API calls.
 * TODO: replace stub bodies with real HTTP calls via the api-client.
 */
export const escrowService = {
  /**
   * Retry a failed settlement for the given escrow.
   * @param escrowId - The ID of the escrow to retry settlement for.
   */
  retrySettlement: async (_escrowId: string): Promise<void> => {
    // TODO: wire to real API endpoint, e.g.
    // return apiClient.post(`/escrow/${escrowId}/retry-settlement`);
  },

  /**
   * Fetch the settlement breakdown for the given escrow.
   * @param escrowId - The ID of the escrow.
   */
  async getSettlementSummary(escrowId: string): Promise<SettlementSummary> {
    const response = await fetch(`/api/escrow/${escrowId}/settlement-summary`);
    if (!response.ok) {
        const error = new Error("Failed to fetch settlement summary") as any;
        error.status = response.status;
        throw error;
    }
    return response.json();
  },
};
