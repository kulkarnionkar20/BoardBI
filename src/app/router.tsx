import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { ConnectionsPage } from "../features/connections/ConnectionsPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { ReportTabsHost } from "../features/report/ReportTabsHost";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/connections" replace /> },
      { path: "connections", element: <ConnectionsPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "reports/:id", element: <ReportTabsHost /> },
    ],
  },
]);
