// app/routes/_index.tsx

import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
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

const API_KEY = "VF.DM.670508f0cd8f2c59f1b534d4.t6mfdXeIfuUSTqUi";
const PROJECT_ID = "6703af9afcd0ea507e9c5369";

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
  purchases: number;
  revenue: number;
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
  return null;
};

export default function Index() {
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

  // 1) Daily Transcripts via den lokalen Proxy
  const fetchDailyTranscripts = async (selectedTimeRange: string) => {
    if (cachedData[selectedTimeRange]) {
      console.log(`Using cached transcripts for ${selectedTimeRange}`);
      return cachedData[selectedTimeRange];
    }
    try {
      const response = await fetch(`/transcripts?timeRange=${selectedTimeRange}`, {
        method: "GET",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error: ${response.status} - ${errorText}`);
      }
      const data: { dailyTranscripts: DailyInteractionData[] } = await response.json();
      const transcriptsData = data.dailyTranscripts || [];
      setCachedData((prev) => ({ ...prev, [selectedTimeRange]: transcriptsData }));
      return transcriptsData;
    } catch (error) {
      console.error("Error fetching daily transcripts:", error);
      return [];
    }
  };

  // 2) Revenue via den daily-data Endpunkt mit Übergabe des Zeitbereichs
  const fetchDailyPurchases = async (selectedTimeRange: string): Promise<DailyRevenueData[]> => {
    if (cachedRevenue[selectedTimeRange]) {
      console.log(`Using cached purchases data for ${selectedTimeRange}`);
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
      const data: { dailyData: { date: string; purchases: number; revenue: number }[] } = await response.json();
      const rawPurchasesData = data.dailyData || [];
      const purchasesData = rawPurchasesData.map((item) => ({
        date: item.date,
        purchases: item.purchases,
        revenue: item.revenue,
      }));
      setCachedRevenue((prev) => ({ ...prev, [selectedTimeRange]: purchasesData }));
      return purchasesData;
    } catch (error) {
      console.error("Error fetching daily purchases:", error);
      return [];
    }
  };

  // 3) Gesamtdaten laden (Analytics, Transcripts, Revenue)
  const fetchDashboardData = async (selectedTimeRange: string) => {
    setIsLoading(true);
    try {
      const dailyTranscriptsData = await fetchDailyTranscripts(selectedTimeRange);
      setDailyInteractions(dailyTranscriptsData);

      const dailyPurchasesData = await fetchDailyPurchases(selectedTimeRange);
      setDailyRevenue(dailyPurchasesData);

      const { startTime, endTime } = calculateTimeRange(selectedTimeRange);
      const response = await fetch("/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: [
            {
              name: "sessions",
              filter: {
                projectID: PROJECT_ID,
                startTime,
                endTime,
                platform: { not: "canvas-prototype" },
              },
            },
            {
              name: "top_intents",
              filter: {
                projectID: PROJECT_ID,
                limit: 5,
                startTime,
                endTime,
                platform: { not: "canvas-prototype" },
              },
            },
            {
              name: "unique_users",
              filter: {
                projectID: PROJECT_ID,
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

  const dynamicLabels =
    dailyInteractions?.map((entry) => {
      const date = new Date(entry.date);
      date.setDate(date.getDate() + 1);
      return date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
    }) || [];

  const transcriptsData = dailyInteractions?.map((entry) => entry.count) || [];
  const purchasesData = dailyRevenue?.map((entry) => entry.purchases) || [];
  const revenueData = dailyRevenue?.map((entry) => entry.revenue) || [];

  const transcriptsChartData = {
    labels: dynamicLabels,
    datasets: [
      {
        label: "Transkripte pro Tag",
        data: transcriptsData,
        borderColor: "#36a2eb",
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        tension: 0.4,
      },
    ],
  };

  const purchasesChartData = {
    labels: dynamicLabels,
    datasets: [
      {
        label: "Käufe pro Tag",
        data: purchasesData,
        borderColor: "#FF6384",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        tension: 0.4,
      },
    ],
  };

  const revenueChartData = {
    labels: dynamicLabels,
    datasets: [
      {
        label: "Umsatz pro Tag (€)",
        data: revenueData,
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "#FF6384",
        borderWidth: 1,
      },
    ],
  };

  const transcriptsChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Tägliche Transkripte" },
    },
    scales: { y: { beginAtZero: true } },
  };

  const purchasesChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Tägliche Käufe" },
    },
    scales: { y: { beginAtZero: true } },
  };

  const revenueChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Täglicher Umsatz" },
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
              Tägliche Transkripte
            </Text>
            {isLoading ? (
              <Text as="p">Loading...</Text>
            ) : (
              <Line data={transcriptsChartData} options={transcriptsChartOptions} />
            )}
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <Text as="h3" variant="headingMd">
              Tägliche Käufe
            </Text>
            <Bar data={purchasesChartData} options={purchasesChartOptions} />
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <Text as="h3" variant="headingMd">
              Täglicher Umsatz
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
