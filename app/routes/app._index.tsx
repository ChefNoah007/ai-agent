// app/routes/_index.tsx

import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Select,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import {
  BarElement,
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { authenticate } from "../shopify.server";
import { getVoiceflowSettings } from "../utils/voiceflow-settings.server";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Define the type for our loader data
interface LoaderData {
  vf_key: string;
  vf_project_id: string;
  vf_version_id: string;
}

interface IntentData {
  name: string;
  count: number;
}

interface DailyInteractionData {
  date: string;
  count: number;
}

interface DailyRevenueData {
  date: string;
  revenue: number;
  purchases?: number;
}

interface ApiResult {
  result: Array<{
    count?: number;
    intents?: IntentData[];
    dailyInteractions?: DailyInteractionData[];
    dailyRevenue?: DailyRevenueData[];
    averageSessionDuration?: number;
    messagesExchanged?: number;
    errorRate?: number;
    newUsers?: number;
  }>;
}

const timeRanges = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last Month", value: "30d" },
  { label: "Last 3 Months", value: "90d" },
  { label: "Last 6 Months", value: "180d" },
  { label: "Last 12 Months", value: "365d" },
];

const calculateTimeRange = (timeRange: string): { startTime: string; endTime: string } => {
  const now = new Date();
  const endTime = now.toISOString();
  const startTime = new Date(now.getTime() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString();
  return { startTime, endTime };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  // Fetch Voiceflow settings from metafields
  const settings = await getVoiceflowSettings(request);
  
  return json<LoaderData>({
    vf_key: settings.vf_key,
    vf_project_id: settings.vf_project_id,
    vf_version_id: settings.vf_version_id
  });
};

export default function Index() {
  // Get Voiceflow settings from loader
  const { vf_key, vf_project_id, vf_version_id } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [uniqueUsers, setUniqueUsers] = useState<number | null>(null);
  const [topIntents, setTopIntents] = useState<IntentData[] | null>(null);
  const [sessions, setSessions] = useState<number | null>(null);
  const [dailyInteractions, setDailyInteractions] = useState<DailyInteractionData[] | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenueData[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<string>("7d");
  const [cachedData, setCachedData] = useState<Record<string, DailyInteractionData[]>>({});
  const [cachedRevenue, setCachedRevenue] = useState<Record<string, DailyRevenueData[]>>({});

  // 1) Daily Transcripts via den Proxy (jetzt zählt /proxy die Transkripte pro Tag)
  const fetchDailyTranscripts = async (selectedTimeRange: string) => {
    if (cachedData[selectedTimeRange]) {
      console.log(`Using cached transcripts for ${selectedTimeRange}`);
      return cachedData[selectedTimeRange];
    }
    const days = parseInt(selectedTimeRange.replace("d", ""));
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    try {
      const response = await fetch(`/proxy?timeRange=${selectedTimeRange}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      // Wir erwarten, dass der Proxy transcriptsPerDay zurückgibt
      const transcriptsPerDay = data.transcriptsPerDay || {};
      const dailyTranscripts: DailyInteractionData[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i + 1);
        const dateKey = d.toISOString().split("T")[0];
        dailyTranscripts.push({ date: dateKey, count: transcriptsPerDay[dateKey] || 0 });
      }
      setCachedData((prev) => ({ ...prev, [selectedTimeRange]: dailyTranscripts }));
      return dailyTranscripts;
    } catch (error) {
      console.error("Error fetching daily transcripts:", error);
      return [];
    }
  };

  // 2) Revenue via den daily-data Endpunkt mit Übergabe des Zeitbereichs
  const fetchDailyRevenue = async (selectedTimeRange: string): Promise<DailyRevenueData[]> => {
    if (cachedRevenue[selectedTimeRange]) {
      console.log(`Using cached revenue data for ${selectedTimeRange}`);
      return cachedRevenue[selectedTimeRange];
    }
    try {
      const response = await fetch(`/daily-data?timeRange=${selectedTimeRange}`, {
        method: "GET",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error: ${response.status} - ${errorText}`);
      }
      // Hier verwenden wir "dailyData", wie es der Loader in daily-data.js zurückgibt
      const data: { dailyData: DailyRevenueData[] } = await response.json();
      const revenueData = data.dailyData || [];
      setCachedRevenue((prev) => ({ ...prev, [selectedTimeRange]: revenueData }));
      return revenueData;
    } catch (error) {
      console.error("Error fetching daily revenue:", error);
      return [];
    }
  };

  // 3) Gesamtdaten laden (Analytics, Transcripts, Revenue)
  const fetchDashboardData = async (selectedTimeRange: string) => {
    setIsLoading(true);
    try {
      // Nutze fetchDailyTranscripts anstelle von fetchDailyInteractions
      const dailyTranscriptsData = await fetchDailyTranscripts(selectedTimeRange);
      setDailyInteractions(dailyTranscriptsData);

      const dailyRevenueData = await fetchDailyRevenue(selectedTimeRange);
      setDailyRevenue(dailyRevenueData);

      const { startTime, endTime } = calculateTimeRange(selectedTimeRange);
      const response = await fetch("/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: [
            {
              name: "sessions",
              filter: {
                projectID: vf_project_id,
                startTime,
                endTime,
                platform: { not: "canvas-prototype" },
              },
            },
            {
              name: "top_intents",
              filter: {
                projectID: vf_project_id,
                limit: 5,
                startTime,
                endTime,
                platform: { not: "canvas-prototype" },
              },
            },
            {
              name: "unique_users",
              filter: {
                projectID: vf_project_id,
                startTime,
                endTime,
                platform: { not: "canvas-prototype" },
              },
            },
          ],
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error: ${response.status} - ${errorText}`);
      }
      const data: ApiResult = await response.json();
      setSessions(data.result[0]?.count || 0);
      setTopIntents(data.result[1]?.intents || []);
      setUniqueUsers(data.result[2]?.count || 0);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(timeRange);
  }, [timeRange]);

  const dynamicLabels = dailyInteractions
    ?.map((entry) => {
      const date = new Date(entry.date);
      date.setDate(date.getDate() + 1);
      return date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
    })
    || [];

  const transcriptsData = dailyInteractions?.map((entry) => entry.count) || [];
  const purchasesData = dailyRevenue?.map((entry) => entry.purchases) || [];
  const revenueData = dailyRevenue?.map((entry) => entry.revenue) || [];

  // Erstes Diagramm zeigt Transkripte und Käufe pro Tag (Linien-Diagramm)
  const lineChartData = {
    labels: dynamicLabels,
    datasets: [
      {
        label: "Transkripte pro Tag",
        data: transcriptsData,
        borderColor: "#36a2eb",
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        tension: 0.4,
      },
      {
        label: "Käufe pro Tag",
        data: purchasesData,
        borderColor: "#4BC0C0",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        tension: 0.4,
      },
    ],
  };

  // Zweites Diagramm zeigt Daily Revenue (Balken-Diagramm)
  const revenueChartData = {
    labels: dynamicLabels,
    datasets: [
      {
        label: "Daily Revenue (€)",
        data: revenueData,
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "#FF6384",
        borderWidth: 1,
      },
    ],
  };

  const revenueChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Daily Revenue" },
    },
    scales: { y: { beginAtZero: true } },
  };

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Daily Transcripts and Revenue" },
    },
    scales: { y: { beginAtZero: true } },
  };

  return (
    <Page>
      <TitleBar title="Voiceflow Dashboard" />
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Dashboard
            </Text>
            <Select
              label="Select Time Range"
              options={timeRanges}
              onChange={(value) => setTimeRange(value)}
              value={timeRange}
            />
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Text as="h3" variant="headingMd">
              Daily Transcripts and Revenue
            </Text>
            {isLoading ? (
              <Text as="p">Loading...</Text>
            ) : (
              <Line data={lineChartData} options={lineChartOptions} />
            )}
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <Text as="h3" variant="headingMd">
              Daily Revenue
            </Text>
            <Bar data={revenueChartData} options={revenueChartOptions} />
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <Text as="h3" variant="headingMd">
              Top Intents
            </Text>
            <Bar
              data={{
                labels: topIntents?.map((intent) => intent.name) || [],
                datasets: [
                  {
                    label: "Top Intents",
                    data: topIntents?.map((intent) => intent.count) || [],
                    backgroundColor: [
                      "#FF6384",
                      "#36A2EB",
                      "#FFCE56",
                      "#4BC0C0",
                      "#9966FF",
                    ],
                    borderWidth: 1,
                  },
                ],
              }}
              options={{
                responsive: true,
                indexAxis: "y",
                plugins: {
                  legend: { position: "top" },
                  title: { display: true, text: "Top Intents" },
                },
                scales: { x: { beginAtZero: true } },
              }}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
