import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { api } from "../../lib/api";
import type {
  CreateReportInput,
  ExportFile,
  Report,
  ReportData,
  UpdateReportInput,
} from "./types";

const LIST_KEY = ["reports"] as const;
const reportKey = (id: string) => ["reports", id] as const;
const dataKey = (id: string) => ["reports", id, "data"] as const;

export function useReports() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => api.get("reports").json<Report[]>(),
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: id ? reportKey(id) : ["reports", "none"],
    enabled: !!id,
    queryFn: () => api.get(`reports/${id}`).json<Report>(),
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReportInput) =>
      api.post("reports", { json: input }).json<Report>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useUpdateReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateReportInput) =>
      api.patch(`reports/${id}`, { json: input }).json<Report>(),
    onSuccess: (data) => {
      qc.setQueryData(reportKey(id), data);
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`reports/${id}`).json<{ ok: true }>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useLatestData(id: string | undefined) {
  return useQuery<ReportData | null>({
    queryKey: id ? dataKey(id) : ["reports", "none", "data"],
    enabled: !!id,
    queryFn: async () => {
      try {
        return await api.get(`reports/${id}/data/latest`).json<ReportData>();
      } catch (err) {
        if (err instanceof HTTPError && err.response.status === 404) return null;
        throw err;
      }
    },
    staleTime: Infinity,
  });
}

export function useRefreshData(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`reports/${id}/data`, { timeout: 120_000 }).json<ReportData>(),
    onSuccess: (data) => qc.setQueryData(dataKey(id), data),
  });
}

export function useExportReports() {
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post("reports/export", { json: { ids } }).json<ExportFile>(),
  });
}

export function useImportReports() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { connectionId: string; file: ExportFile }) =>
      api.post("reports/import", { json: body }).json<Report[]>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
