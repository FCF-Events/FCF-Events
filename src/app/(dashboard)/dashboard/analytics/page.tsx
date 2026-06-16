import { DashboardCharts } from "@/components/charts/dashboard-charts";
import { ExportCsvButton } from "@/components/export-csv-button";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { getAnalyticsData, getDashboardMetrics } from "@/lib/data";

export default async function AnalyticsPage() {
  const [metrics, analytics] = await Promise.all([getDashboardMetrics(), getAnalyticsData()]);
  const noShowRate = Math.max(0, 100 - metrics.checkInPercentage);
  const analyticsExportColumns = [
    { key: "section", header: "Section" },
    { key: "label", header: "Label" },
    { key: "value", header: "Value" },
    { key: "registrations", header: "Registrations" },
    { key: "checkins", header: "Check-ins" },
  ];
  const analyticsExportRows = [
    { section: "Metric", label: "Repeat attendee rate", value: `${metrics.repeatAttendeeRate}%` },
    { section: "Metric", label: "No-show rate", value: `${noShowRate}%` },
    { section: "Metric", label: "SMS consent rate", value: `${metrics.smsConsentRate}%` },
    { section: "Metric", label: "Capacity utilization", value: "37%" },
    ...analytics.registrationTrend.map((item) => ({
      section: "Registration trend",
      label: item.date,
      registrations: item.registrations,
      checkins: item.checkins,
    })),
    ...analytics.ticketBreakdown.map((item) => ({
      section: "Ticket breakdown",
      label: item.name,
      value: item.value,
    })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="Registration, attendance, repeat attendee, ticket, session, company, discount, and SMS conversion views."
        action={<ExportCsvButton columns={analyticsExportColumns} rows={analyticsExportRows} filename="analytics.csv" />}
      />
      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Repeat attendee rate" value={`${metrics.repeatAttendeeRate}%`} />
        <MetricCard label="No-show rate" value={`${noShowRate}%`} />
        <MetricCard label="SMS consent rate" value={`${metrics.smsConsentRate}%`} />
        <MetricCard label="Capacity utilization" value="37%" />
      </div>
      <DashboardCharts registrationTrend={analytics.registrationTrend} ticketBreakdown={analytics.ticketBreakdown} />
    </>
  );
}
