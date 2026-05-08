import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type {
  CreateConnectionInput,
  JiraConnection,
  TestConnectionResult,
} from "./types";

const KEY = ["connections"] as const;

export function useConnections() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get("connections").json<JiraConnection[]>(),
  });
}

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConnectionInput) =>
      api.post("connections", { json: input }).json<JiraConnection>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`connections/${id}`).json<{ ok: true }>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`connections/${id}/test`).json<TestConnectionResult>(),
  });
}
