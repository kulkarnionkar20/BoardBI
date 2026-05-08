import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { FieldDef } from "../../lib/jqlFields";

type FieldsResponse = {
  cached: boolean;
  fetchedAt: string;
  fields: FieldDef[];
};

export function useFields(connectionId: string | undefined) {
  return useQuery({
    queryKey: ["fields", connectionId],
    enabled: !!connectionId,
    queryFn: () => api.get(`fields/${connectionId}`).json<FieldsResponse>(),
    staleTime: 5 * 60_000,
  });
}
