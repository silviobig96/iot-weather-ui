"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

type Reading = {
  _id: string;
  sensorId: string;
  location: string;
  temperature: number;
  humidity: number;
  pressure?: number;
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Stats = {
  min: number;
  max: number;
  average: number;
  count: number;
};

const DEFAULT_LIMIT = 20;
const POLL_INTERVAL = 10_000;
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const SENSOR_ID = process.env.NEXT_PUBLIC_SENSOR_ID ?? "esp32-dht22-1";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const parseDate = (input?: string | Date) => {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
};

const collectStats = (values: number[]): Stats | null => {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { min, max, average, count: values.length };
};

type GaugeProps = {
  label: string;
  unit: string;
  value?: number;
  min: number;
  max: number;
};

function GaugeArc({ label, unit, value, min, max }: GaugeProps) {
  const id = useId();
  const safeValue = value ?? 0;
  const span = Math.max(max - min, 1);
  const percent = Math.min(Math.max((safeValue - min) / span, 0), 1);
  const radius = 100;
  const circumference = Math.PI * radius;
  const dash = circumference * percent;
  const isEmpty = value === undefined || Number.isNaN(value);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm shadow-slate-200">
      <p className="text-xs font-semibold tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <div className="relative w-full max-w-[280px]">
        <svg viewBox="0 0 260 150" className="w-full">
          <defs>
            <linearGradient id={`${id}-gradient`} x1="0%" x2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="45%" stopColor="#22c55e" />
              <stop offset="75%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>
          <path
            d="M30 120 A100 100 0 0 1 230 120"
            stroke="#e5e7eb"
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M30 120 A100 100 0 0 1 230 120"
            stroke={`url(#${id}-gradient)`}
            strokeWidth="18"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={`${circumference - dash}`}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 py-2">
          <span className="text-3xl font-semibold text-slate-900 sm:text-4xl mt-12">
            {isEmpty ? "--" : `${numberFormatter.format(safeValue)} ${unit}`}
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Current
          </span>
        </div>
      </div>
      <div className="flex w-full justify-between text-xs font-medium text-slate-500">
        <span>
          Min {min} {unit}
        </span>
        <span>
          Max {max} {unit}
        </span>
      </div>
    </div>
  );
}

type StatCardProps = {
  title: string;
  stats: Stats | null;
  unit: string;
};

function StatCard({ title, stats, unit }: StatCardProps) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm shadow-slate-200">
      <p className="text-sm font-semibold text-slate-700">
        {title} {stats?.count ?? 0} readings
      </p>
      <div className="grid grid-cols-3 gap-2 text-sm text-slate-600">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Min</p>
          <p className="font-semibold">
            {stats ? `${numberFormatter.format(stats.min)} ${unit}` : "--"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Max</p>
          <p className="font-semibold">
            {stats ? `${numberFormatter.format(stats.max)} ${unit}` : "--"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Average
          </p>
          <p className="font-semibold">
            {stats ? `${numberFormatter.format(stats.average)} ${unit}` : "--"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [limitInput, setLimitInput] = useState(String(DEFAULT_LIMIT));
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const fetchReadings = useCallback(
    async (limitToUse: number) => {
      try {
        setIsFetching(true);
        setError(null);

        const response = await fetch(
          `${API_BASE_URL}/api/readings/latest?sensorId=${encodeURIComponent(
            SENSOR_ID
          )}&limit=${limitToUse}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch readings (${response.status}).`);
        }

        const data = (await response.json()) as Reading[];
        setReadings(Array.isArray(data) ? data : []);
        setLastUpdated(new Date());
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not fetch readings.";
        setError(message);
      } finally {
        setIsFetching(false);
      }
    },
    [setReadings]
  );

  useEffect(() => {
    void fetchReadings(limit);
    const interval = setInterval(() => {
      void fetchReadings(limit);
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchReadings, limit]);

  const latestReading = readings.at(0);
  const lastTimestamp =
    parseDate(latestReading?.timestamp) ??
    parseDate(latestReading?.createdAt) ??
    parseDate(latestReading?.updatedAt);

  const temperatureStats = useMemo(
    () =>
      collectStats(
        readings
          .map((item) => item.temperature)
          .filter((value) => Number.isFinite(value))
      ),
    [readings]
  );

  const humidityStats = useMemo(
    () =>
      collectStats(
        readings
          .map((item) => item.humidity)
          .filter((value) => Number.isFinite(value))
      ),
    [readings]
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number.parseInt(limitInput, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid number of readings.");
      return;
    }

    setLimit(parsed);
    void fetchReadings(parsed);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-amber-50 pb-12">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-400 text-xl font-bold text-white shadow-md shadow-sky-200">
              🌤️
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
                ESP Weather Station
              </h1>
              <p className="text-sm text-slate-600">
                Live dashboard for {SENSOR_ID}. Auto-refresh every 10 seconds.
              </p>
            </div>
          </div>
          <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm shadow-slate-200 ring-1 ring-slate-200">
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Waiting for readings..."}
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm shadow-slate-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="limit"
              className="text-sm font-semibold text-slate-700"
            >
              Number of readings
            </label>
            <p className="text-sm text-slate-500">
              Using the latest {limit} readings.
            </p>
          </div>
          <div className="flex items-center gap-3 sm:justify-end">
            <input
              id="limit"
              name="limit"
              type="number"
              min={1}
              value={limitInput}
              onChange={(event) => setLimitInput(event.target.value)}
              className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-inner shadow-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-200 transition hover:translate-y-[-1px] hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
              disabled={isFetching}
            >
              {isFetching ? "Refreshing..." : "Update"}
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600">
            Last reading:{" "}
            <span className="font-semibold text-slate-900">
              {lastTimestamp
                ? lastTimestamp.toLocaleString()
                : "No readings yet"}
            </span>
          </p>
          {error ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {error}
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <GaugeArc
            label="Temperature"
            unit="°C"
            value={latestReading?.temperature}
            min={0}
            max={50}
          />
          <GaugeArc
            label="Humidity"
            unit="%"
            value={latestReading?.humidity}
            min={0}
            max={100}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard title="Temperature" stats={temperatureStats} unit="°C" />
          <StatCard title="Humidity" stats={humidityStats} unit="%" />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-md shadow-slate-200">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Latest {limit} readings
              </h2>
              <p className="text-sm text-slate-600">
                Tabular view of the most recent sensor data.
              </p>
            </div>
            {isFetching ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                Refreshing...
              </span>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead>
                <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Sensor</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Temp (°C)</th>
                  <th className="px-3 py-2">Humidity (%)</th>
                  <th className="px-3 py-2">Pressure</th>
                  <th className="px-3 py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {readings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-sm text-slate-500"
                    >
                      No readings available yet.
                    </td>
                  </tr>
                ) : (
                  readings.map((reading) => {
                    const rowTimestamp =
                      parseDate(reading.timestamp) ??
                      parseDate(reading.createdAt) ??
                      parseDate(reading.updatedAt);
                    return (
                      <tr
                        key={reading._id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">
                          {reading._id.slice(-6)}
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          {reading.sensorId}
                        </td>
                        <td className="px-3 py-2">{reading.location}</td>
                        <td className="px-3 py-2">
                          {numberFormatter.format(reading.temperature)}
                        </td>
                        <td className="px-3 py-2">
                          {numberFormatter.format(reading.humidity)}
                        </td>
                        <td className="px-3 py-2">
                          {reading.pressure
                            ? numberFormatter.format(reading.pressure)
                            : "--"}
                        </td>
                        <td className="px-3 py-2">
                          {rowTimestamp ? rowTimestamp.toLocaleString() : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
