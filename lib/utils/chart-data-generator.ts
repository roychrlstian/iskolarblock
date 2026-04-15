interface Application {
  id: string;
  status: string;
  createdAt: string;
  applicationPeriodId: string | null;
  applicationDetails?: {
    personalInfo?: {
      yearLevel?: string;
    };
  } | null;
}

interface ApplicationPeriod {
  id: string;
  startDate: string;
  endDate: string;
}

interface ChartDataPoint {
  month: string;
  applications: number;
}

const MONTH_ORDER: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseMonthLabel(label: string): number {
  const parts = label.split(" ");
  const monthAbbr = parts[0];
  const year = parseInt(parts[1] || "0", 10);
  const monthIndex = MONTH_ORDER[monthAbbr] ?? 0;
  return year * 12 + monthIndex;
}

function groupByMonth(applications: Application[]): ChartDataPoint[] {
  const monthMap = new Map<string, number>();
  applications.forEach((app) => {
    const date = new Date(app.createdAt);
    const monthKey = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
  });

  return Array.from(monthMap.entries())
    .map(([month, count]) => ({ month, applications: count }))
    .sort((a, b) => parseMonthLabel(a.month) - parseMonthLabel(b.month));
}

export function generateChartData(
  applications: Application[],
  periods: ApplicationPeriod[],
  selectedPeriodId: string | null,
  timeFilter: "all" | "monthly" | "weekly" | "daily"
): ChartDataPoint[] {
  if (!applications || applications.length === 0) {
    return [{ month: "No Data", applications: 0 }];
  }

  if (timeFilter === "all" || timeFilter === "monthly") {
    const result = groupByMonth(applications);
    return result.length > 0 ? result : [{ month: "No Data", applications: 0 }];
  }

  if (timeFilter === "weekly") {
    if (!selectedPeriodId || periods.length === 0) {
      return [{ month: "No Period Selected", applications: 0 }];
    }

    const currentPeriod = periods.find((p) => p.id === selectedPeriodId);
    if (!currentPeriod) {
      return [{ month: "No Period Selected", applications: 0 }];
    }

    const chartDataPoints: ChartDataPoint[] = [];
    const periodStart = new Date(currentPeriod.startDate);
    const periodEnd = new Date(currentPeriod.endDate);

    let weekStart = new Date(periodStart);
    let weekNumber = 1;

    while (weekStart <= periodEnd) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > periodEnd) {
        weekEnd.setTime(periodEnd.getTime());
      }

      const weekApps = applications.filter((app) => {
        const appDate = new Date(app.createdAt);
        return appDate >= weekStart && appDate <= weekEnd;
      }).length;

      chartDataPoints.push({
        month: `Week ${weekNumber}`,
        applications: weekApps,
      });

      weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() + 1);
      weekNumber++;
    }

    return chartDataPoints.length > 0
      ? chartDataPoints
      : [{ month: "No Data", applications: 0 }];
  }

  if (timeFilter === "daily") {
    if (!selectedPeriodId || periods.length === 0) {
      return [{ month: "No Period Selected", applications: 0 }];
    }

    const currentPeriod = periods.find((p) => p.id === selectedPeriodId);
    if (!currentPeriod) {
      return [{ month: "No Period Selected", applications: 0 }];
    }

    const periodStart = new Date(currentPeriod.startDate);
    const periodEnd = new Date(currentPeriod.endDate);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd.setHours(23, 59, 59, 999);

    const dayMap = new Map<string, { count: number; timestamp: number }>();

    applications.forEach((app) => {
      const date = new Date(app.createdAt);
      date.setHours(0, 0, 0, 0);

      if (date >= periodStart && date <= periodEnd) {
        const dayKey = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const existing = dayMap.get(dayKey);
        dayMap.set(dayKey, {
          count: (existing?.count || 0) + 1,
          timestamp: date.getTime(),
        });
      }
    });

    const sortedData = Array.from(dayMap.entries())
      .map(([day, { count, timestamp }]) => ({
        month: day,
        applications: count,
        _ts: timestamp,
      }))
      .sort((a, b) => a._ts - b._ts)
      .map(({ month, applications }) => ({ month, applications }));

    return sortedData.length > 0
      ? sortedData
      : [{ month: "No Data", applications: 0 }];
  }

  return [{ month: "No Data", applications: 0 }];
}

export function filterApplicationsByEducationLevel(
  applications: Application[],
  filter: "all" | "college" | "shs"
): Application[] {
  if (filter === "all") {
    return applications;
  }

  return applications.filter((app) => {
    const yearLevel = app.applicationDetails?.personalInfo?.yearLevel || "";
    if (filter === "college") {
      return ["1", "2", "3", "4"].includes(yearLevel);
    } else if (filter === "shs") {
      return ["G11", "G12"].includes(yearLevel);
    }
    return true;
  });
}
