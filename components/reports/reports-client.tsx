"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  Wallet,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus,
  ChevronRight,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Color palette for charts
const CHART_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#f43f5e", // Rose
  "#14b8a6", // Teal
  "#f97316", // Orange
];

interface Account {
  id: string;
  name: string;
  type: "CHECKING" | "SAVINGS" | "CASH";
  openingBalanceInPaise: number;
  balanceInPaise: number;
}

interface Envelope {
  id: string;
  name: string;
  isGoal: boolean;
  goalAmountInPaise: number | null;
  goalDeadline: Date | null;
  envelopeSetId: string;
}

interface EnvelopeSet {
  id: string;
  name: string;
  accountId: string | null;
  startsOnDay: number;
  envelopes: Envelope[];
}

interface Allocation {
  id: string;
  envelopeId: string;
  month: number;
  year: number;
  amountInPaise: number;
}

interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amountInPaise: number;
  date: string; // ISO string from database
  envelopeId: string | null;
  toEnvelopeId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  payee: string | null;
  notes: string | null;
  envelopeName?: string;
  envelopeSetName?: string;
}

interface ReportsClientProps {
  accounts: Account[];
  envelopeSets: EnvelopeSet[];
  allocations: Allocation[];
  transactions: Transaction[];
  currentMonth: number;
  currentYear: number;
}

export function ReportsClient({
  accounts,
  envelopeSets,
  allocations,
  transactions,
  currentMonth,
  currentYear,
}: ReportsClientProps) {
  const [activeTab, setActiveTab] = useState<"spending" | "income-expense" | "goals">("spending");
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [hoveredDonutIndex, setHoveredDonutIndex] = useState<number | null>(null);
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});

  // ─────────────────────────────────────────────────────────
  // Years available in filters (based on transaction history + current year)
  // ─────────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    transactions.forEach((t) => {
      const year = new Date(t.date).getFullYear();
      if (!isNaN(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, currentYear]);

  // ─────────────────────────────────────────────────────────
  // Helper: Month name
  // ─────────────────────────────────────────────────────────
  const getMonthName = (m: number) => {
    return new Date(2000, m - 1).toLocaleString("default", { month: "long" });
  };

  // Toggle expanded states for Envelope Sets in report breakdowns
  const toggleSetExpansion = (setId: string) => {
    setExpandedSets((prev) => ({ ...prev, [setId]: !prev[setId] }));
  };

  // ─────────────────────────────────────────────────────────
  // Current Month Aggregations (Income vs Expense)
  // ─────────────────────────────────────────────────────────
  const monthlyMetrics = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach((t) => {
      const tDate = new Date(t.date);
      const tMonth = tDate.getMonth() + 1;
      const tYear = tDate.getFullYear();

      if (tMonth === selectedMonth && tYear === selectedYear) {
        if (t.type === "INCOME") {
          income += t.amountInPaise;
        } else if (t.type === "EXPENSE") {
          expense += t.amountInPaise;
        }
      }
    });

    const net = income - expense;
    const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;

    return { income, expense, net, savingsRate };
  }, [transactions, selectedMonth, selectedYear]);

  // ─────────────────────────────────────────────────────────
  // Spending Breakdown by Envelope and Envelope Set
  // ─────────────────────────────────────────────────────────
  const spendingBreakdown = useMemo(() => {
    // Map of envelope ID to details
    const envMap: Record<string, { id: string; name: string; setName: string; setId: string }> = {};
    envelopeSets.forEach((set) => {
      set.envelopes.forEach((env) => {
        envMap[env.id] = {
          id: env.id,
          name: env.name,
          setName: set.name,
          setId: set.id,
        };
      });
    });

    // Group expenses by envelope and envelope set
    const setGroup: Record<string, { id: string; name: string; spent: number; envelopes: Record<string, { name: string; spent: number; allocated: number }> }> = {};

    // First initialize empty structure with allocations for the selected month
    envelopeSets.forEach((set) => {
      setGroup[set.id] = {
        id: set.id,
        name: set.name,
        spent: 0,
        envelopes: {},
      };
      set.envelopes.forEach((env) => {
        const alloc = allocations.find(
          (a) => a.envelopeId === env.id && a.month === selectedMonth && a.year === selectedYear
        );
        setGroup[set.id].envelopes[env.id] = {
          name: env.name,
          spent: 0,
          allocated: alloc?.amountInPaise ?? 0,
        };
      });
    });

    // Add spending values
    let totalSpent = 0;
    transactions.forEach((t) => {
      const tDate = new Date(t.date);
      const tMonth = tDate.getMonth() + 1;
      const tYear = tDate.getFullYear();

      if (tMonth === selectedMonth && tYear === selectedYear && t.type === "EXPENSE" && t.envelopeId) {
        const envInfo = envMap[t.envelopeId];
        if (envInfo) {
          totalSpent += t.amountInPaise;
          if (setGroup[envInfo.setId]) {
            setGroup[envInfo.setId].spent += t.amountInPaise;
            if (setGroup[envInfo.setId].envelopes[t.envelopeId]) {
              setGroup[envInfo.setId].envelopes[t.envelopeId].spent += t.amountInPaise;
            }
          }
        }
      }
    });

    // Convert to arrays and sort
    const sets = Object.values(setGroup)
      .filter((s) => s.spent > 0 || Object.values(s.envelopes).some((e) => e.allocated > 0))
      .map((s) => ({
        ...s,
        envelopes: Object.entries(s.envelopes)
          .map(([id, e]) => ({ id, ...e }))
          .sort((a, b) => b.spent - a.spent),
      }))
      .sort((a, b) => b.spent - a.spent);

    // Donut chart slices data
    const chartData = sets
      .filter((s) => s.spent > 0)
      .map((s, index) => ({
        id: s.id,
        name: s.name,
        value: s.spent,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));

    return { sets, totalSpent, chartData };
  }, [envelopeSets, allocations, transactions, selectedMonth, selectedYear]);

  // ─────────────────────────────────────────────────────────
  // Income vs Expense Over Last 6 Months (Trend)
  // ─────────────────────────────────────────────────────────
  const historicalTrend = useMemo(() => {
    const trendData: { month: number; year: number; label: string; income: number; expense: number }[] = [];

    // Generate last 6 months
    const date = new Date(selectedYear, selectedMonth - 1, 1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date);
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      trendData.push({
        month: m,
        year: y,
        label: d.toLocaleString("default", { month: "short" }) + " " + y,
        income: 0,
        expense: 0,
      });
    }

    // Populate values
    transactions.forEach((t) => {
      const tDate = new Date(t.date);
      const tMonth = tDate.getMonth() + 1;
      const tYear = tDate.getFullYear();

      const monthMatch = trendData.find((item) => item.month === tMonth && item.year === tYear);
      if (monthMatch) {
        if (t.type === "INCOME") {
          monthMatch.income += t.amountInPaise;
        } else if (t.type === "EXPENSE") {
          monthMatch.expense += t.amountInPaise;
        }
      }
    });

    const maxVal = Math.max(...trendData.map((d) => Math.max(d.income, d.expense)), 1);

    return { trendData, maxVal };
  }, [transactions, selectedMonth, selectedYear]);

  // ─────────────────────────────────────────────────────────
  // Goals Progress Calculations
  // ─────────────────────────────────────────────────────────
  const goalsProgress = useMemo(() => {
    // Find all envelopes marked as goals
    const goalEnvelopes: { id: string; name: string; setName: string; target: number; deadline: Date | null }[] = [];
    envelopeSets.forEach((set) => {
      set.envelopes.forEach((env) => {
        if (env.isGoal && env.goalAmountInPaise && env.goalAmountInPaise > 0) {
          goalEnvelopes.push({
            id: env.id,
            name: env.name,
            setName: set.name,
            target: env.goalAmountInPaise,
            deadline: env.goalDeadline ? new Date(env.goalDeadline) : null,
          });
        }
      });
    });

    // Compute dynamic current balance for each goal envelope
    // Balance = All Allocations + Income Credits + Transfers In - Expenses - Transfers Out (Cumulative All Time)
    return goalEnvelopes.map((goal) => {
      // 1. Allocations
      const totalAllocated = allocations
        .filter((a) => a.envelopeId === goal.id)
        .reduce((sum, a) => sum + a.amountInPaise, 0);

      // 2. Transactions
      let totalTransactionsNet = 0;
      transactions.forEach((t) => {
        if (t.type === "INCOME" && t.envelopeId === goal.id) {
          totalTransactionsNet += t.amountInPaise;
        } else if (t.type === "EXPENSE" && t.envelopeId === goal.id) {
          totalTransactionsNet -= t.amountInPaise;
        } else if (t.type === "TRANSFER") {
          if (t.toEnvelopeId === goal.id) {
            totalTransactionsNet += t.amountInPaise;
          }
          if (t.envelopeId === goal.id) {
            totalTransactionsNet -= t.amountInPaise;
          }
        }
      });

      const currentBalance = totalAllocated + totalTransactionsNet;
      const progressPercent = Math.min(100, Math.max(0, Math.round((currentBalance / goal.target) * 100)));
      const isCompleted = currentBalance >= goal.target;

      let daysRemaining: number | null = null;
      if (goal.deadline) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const timeDiff = goal.deadline.getTime() - today.getTime();
        daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      }

      return {
        ...goal,
        currentBalance,
        progressPercent,
        isCompleted,
        daysRemaining,
      };
    }).sort((a, b) => a.progressPercent - b.progressPercent); // Sort least progress to most progress
  }, [envelopeSets, allocations, transactions]);

  // ─────────────────────────────────────────────────────────
  // Custom Donut Chart Render Helper
  // ─────────────────────────────────────────────────────────
  const renderDonutChart = () => {
    const radius = 35;
    const strokeWidth = 10;
    const circumference = 2 * Math.PI * radius; // ~219.91
    let accumulatedPercent = 0;

    const chartData = spendingBreakdown.chartData;
    const total = spendingBreakdown.totalSpent;

    if (total === 0 || chartData.length === 0) {
      return (
        <div className="relative flex flex-col items-center justify-center w-56 h-56 rounded-full border border-dashed border-border bg-card/40">
          <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <span className="text-xs text-muted-foreground font-medium">No expenses recorded</span>
        </div>
      );
    }

    return (
      <div className="relative flex items-center justify-center w-56 h-56 mx-auto">
        <svg width="100%" height="100%" viewBox="0 0 100 100" className="transform -rotate-90">
          {/* Base Background Track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="var(--border)"
            strokeWidth={strokeWidth - 1}
            className="opacity-20"
          />
          {chartData.map((item, index) => {
            const percentage = item.value / total;
            const strokeLength = percentage * circumference;
            const strokeOffset = circumference - accumulatedPercent * circumference;
            accumulatedPercent += percentage;

            const isHovered = hoveredDonutIndex === index;

            return (
              <circle
                key={item.id}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={`${strokeLength} ${circumference}`}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredDonutIndex(index)}
                onMouseLeave={() => setHoveredDonutIndex(null)}
                style={{
                  filter: isHovered ? "drop-shadow(0 0 3px rgba(0,0,0,0.2))" : "none",
                }}
              />
            );
          })}
        </svg>
        {/* Absolute Centered Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {hoveredDonutIndex !== null ? chartData[hoveredDonutIndex].name : "Total Spending"}
          </span>
          <span className="text-lg font-bold text-foreground truncate max-w-[150px] mt-0.5">
            {formatINR(hoveredDonutIndex !== null ? chartData[hoveredDonutIndex].value : total)}
          </span>
          <span className="text-[11px] text-muted-foreground mt-0.5">
            {hoveredDonutIndex !== null
              ? `${((chartData[hoveredDonutIndex].value / total) * 100).toFixed(1)}%`
              : `${getMonthName(selectedMonth)} ${selectedYear}`}
          </span>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────
  // Custom SVG Bar Chart Render Helper
  // ─────────────────────────────────────────────────────────
  const renderTrendBarChart = () => {
    const { trendData, maxVal } = historicalTrend;
    const chartHeight = 150;
    const chartWidth = 500;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const usableWidth = chartWidth - paddingLeft - paddingRight;
    const usableHeight = chartHeight - paddingTop - paddingBottom;

    // Helper lines at 0%, 50%, 100%
    const gridLines = [0, 0.5, 1];

    return (
      <div className="w-full overflow-x-auto pb-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[450px] overflow-visible text-xs text-muted-foreground"
        >
          {/* Grid lines & Y Axis Labels */}
          {gridLines.map((percent, idx) => {
            const y = paddingTop + usableHeight * (1 - percent);
            const value = maxVal * percent;
            return (
              <g key={idx} className="opacity-60">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text x={paddingLeft - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px] font-medium">
                  {value >= 10000000 // 1L+
                    ? `₹${(value / 10000000).toFixed(1)}L`
                    : value >= 100000 // 1k+
                    ? `₹${(value / 100000).toFixed(0)}k`
                    : `₹${(value / 100).toFixed(0)}`}
                </text>
              </g>
            );
          })}

          {/* Render Bars */}
          {trendData.map((d, index) => {
            const numMonths = trendData.length;
            const groupWidth = usableWidth / numMonths;
            const groupX = paddingLeft + index * groupWidth;

            // Heights
            const incHeight = (d.income / maxVal) * usableHeight;
            const expHeight = (d.expense / maxVal) * usableHeight;

            // Positions (aligned to bottom of usable height)
            const yBase = paddingTop + usableHeight;
            const incY = yBase - incHeight;
            const expY = yBase - expHeight;

            const barWidth = 14;
            const gap = 3;
            const incX = groupX + (groupWidth - barWidth * 2 - gap) / 2;
            const expX = incX + barWidth + gap;

            return (
              <g key={index} className="group">
                {/* Income Bar (Green) */}
                <rect
                  x={incX}
                  y={incY}
                  width={barWidth}
                  height={Math.max(incHeight, 2)} // min height 2px for visibility
                  rx="3"
                  fill="var(--positive)"
                  className="opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                />
                {/* Expense Bar (Red) */}
                <rect
                  x={expX}
                  y={expY}
                  width={barWidth}
                  height={Math.max(expHeight, 2)}
                  rx="3"
                  fill="var(--negative)"
                  className="opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                />

                {/* X Axis Label */}
                <text
                  x={groupX + groupWidth / 2}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] font-semibold"
                >
                  {d.label.split(" ")[0]}
                </text>

                {/* Tooltip Overlay triggers (Invisible boxes covering the groups) */}
                <title>{`${d.label}\nIncome: ${formatINR(d.income)}\nExpense: ${formatINR(
                  d.expense
                )}`}</title>
              </g>
            );
          })}

          {/* Bottom X-Axis line */}
          <line
            x1={paddingLeft}
            y1={paddingTop + usableHeight}
            x2={chartWidth - paddingRight}
            y2={paddingTop + usableHeight}
            stroke="var(--border)"
            strokeWidth="1"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header and Filter controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Financial analytics and category breakdowns</p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1.5 shadow-sm self-start">
          <Calendar className="h-4 w-4 text-muted-foreground ml-1" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent text-sm font-medium text-foreground focus:outline-none cursor-pointer pr-1"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {getMonthName(i + 1)}
              </option>
            ))}
          </select>
          <span className="text-border">|</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent text-sm font-medium text-foreground focus:outline-none cursor-pointer"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("spending")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-all ${
            activeTab === "spending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Spending Breakdown
        </button>
        <button
          onClick={() => setActiveTab("income-expense")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-all ${
            activeTab === "income-expense"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Income vs Expense
        </button>
        <button
          onClick={() => setActiveTab("goals")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-all ${
            activeTab === "goals"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Target className="h-4 w-4" />
          Savings Goals
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────
          TAB CONTENT: SPENDING BREAKDOWN
          ───────────────────────────────────────────────────────── */}
      {activeTab === "spending" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Income
                </CardTitle>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-positive/10 text-positive">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">{formatINR(monthlyMetrics.income)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Deposits for the month</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Spent
                </CardTitle>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-negative/10 text-negative">
                  <ArrowDownRight className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">{formatINR(spendingBreakdown.totalSpent)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Expenses from envelopes</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Savings Rate
                </CardTitle>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">{monthlyMetrics.savingsRate}%</div>
                <p className="text-[10px] text-muted-foreground mt-1">Percentage of income saved</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Net Balance
                </CardTitle>
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-md ${
                    monthlyMetrics.net >= 0 ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {monthlyMetrics.net >= 0 ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold ${monthlyMetrics.net >= 0 ? "text-positive" : "text-destructive"}`}>
                  {formatINR(Math.abs(monthlyMetrics.net))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Cash flow diff this month</p>
              </CardContent>
            </Card>
          </div>

          {/* Grid Layout: Donut + Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 flex flex-col justify-center py-6">
              <CardHeader className="text-center pt-2 pb-4">
                <CardTitle className="text-base font-semibold">Spending Share</CardTitle>
                <CardDescription className="text-xs">Visualizing envelope set expenses</CardDescription>
              </CardHeader>
              <CardContent>{renderDonutChart()}</CardContent>
            </Card>

            <Card className="lg:col-span-7">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base font-semibold">Category breakdown</CardTitle>
                <CardDescription className="text-xs">Expense details grouped by envelope sets</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {spendingBreakdown.sets.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm">
                    No budget allocations or expenses found for this month.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {spendingBreakdown.sets.map((set, sIdx) => {
                      const isExpanded = !!expandedSets[set.id];
                      const setPercentage =
                        spendingBreakdown.totalSpent > 0
                          ? ((set.spent / spendingBreakdown.totalSpent) * 100).toFixed(1)
                          : "0.0";
                      const setChartColor =
                        CHART_COLORS[
                          spendingBreakdown.chartData.findIndex((c) => c.id === set.id) % CHART_COLORS.length
                        ] || "var(--border)";

                      return (
                        <div
                          key={set.id}
                          className="transition-colors hover:bg-card/20"
                          onMouseEnter={() => {
                            const chartIdx = spendingBreakdown.chartData.findIndex((c) => c.id === set.id);
                            if (chartIdx !== -1) setHoveredDonutIndex(chartIdx);
                          }}
                          onMouseLeave={() => setHoveredDonutIndex(null)}
                        >
                          {/* Envelope Set Header Row */}
                          <div
                            onClick={() => toggleSetExpansion(set.id)}
                            className="flex items-center justify-between p-4 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <span
                                className="h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: set.spent > 0 ? setChartColor : "var(--border)" }}
                              />
                              <span className="font-semibold text-sm text-foreground truncate">{set.name}</span>
                              {set.spent > 0 && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0">
                                  {setPercentage}%
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <div>
                                <p className="text-sm font-bold text-foreground">{formatINR(set.spent)}</p>
                                <p className="text-[10px] text-muted-foreground font-medium">
                                  of {formatINR(set.envelopes.reduce((sum, e) => sum + e.allocated, 0))} allocated
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Child Envelopes Expanded */}
                          {isExpanded && (
                            <div className="bg-muted/10 border-t border-border/50 px-4 py-2 divide-y divide-border/30">
                              {set.envelopes.map((env) => {
                                const envPercent =
                                  set.spent > 0 ? ((env.spent / set.spent) * 100).toFixed(0) : "0";
                                const isOverbudget = env.spent > env.allocated && env.allocated > 0;

                                return (
                                  <div key={env.id} className="flex justify-between py-2.5 text-xs">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-foreground truncate">{env.name}</p>
                                      {env.spent > 0 && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                          {envPercent}% of {set.name} spending
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right ml-4">
                                      <p className="font-bold text-foreground">{formatINR(env.spent)}</p>
                                      <p
                                        className={`text-[10px] font-semibold mt-0.5 ${
                                          isOverbudget ? "text-negative" : "text-muted-foreground"
                                        }`}
                                      >
                                        Budget: {formatINR(env.allocated)}
                                        {isOverbudget && " (Overbudget)"}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB CONTENT: INCOME VS EXPENSE HISTORICAL TRENDS
          ───────────────────────────────────────────────────────── */}
      {activeTab === "income-expense" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Income vs Expense Trend</CardTitle>
              <CardDescription className="text-xs">
                Comparison chart for the last 6 months (Green = Income, Red = Expenses)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">{renderTrendBarChart()}</CardContent>
          </Card>

          {/* Historical Metrics Table */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold">Monthly History</CardTitle>
              <CardDescription className="text-xs">
                Historical monthly cash flows and savings percentages
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Month</TableHead>
                    <TableHead className="text-right font-semibold">Income</TableHead>
                    <TableHead className="text-right font-semibold">Expenses</TableHead>
                    <TableHead className="text-right font-semibold">Net Cash Flow</TableHead>
                    <TableHead className="text-right font-semibold">Savings Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalTrend.trendData
                    .slice()
                    .reverse()
                    .map((item, idx) => {
                      const net = item.income - item.expense;
                      const savingsRate =
                        item.income > 0 ? Math.max(0, Math.round((net / item.income) * 100)) : 0;
                      return (
                        <TableRow key={idx} className="hover:bg-card/40">
                          <TableCell className="font-semibold text-foreground">{item.label}</TableCell>
                          <TableCell className="text-right text-positive font-semibold">
                            {formatINR(item.income)}
                          </TableCell>
                          <TableCell className="text-right text-negative font-semibold">
                            {formatINR(item.expense)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-bold ${
                              net >= 0 ? "text-positive" : "text-destructive"
                            }`}
                          >
                            {net >= 0 ? "+" : "-"}
                            {formatINR(Math.abs(net))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="secondary"
                              className={
                                net >= 0
                                  ? "bg-positive/10 text-positive border-transparent font-bold"
                                  : "bg-destructive/10 text-destructive border-transparent font-bold"
                              }
                            >
                              {savingsRate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          TAB CONTENT: GOALS PROGRESS
          ───────────────────────────────────────────────────────── */}
      {activeTab === "goals" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Account Balances Summary Card (Left side) */}
          <Card className="lg:col-span-4 h-fit">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Account Balances
              </CardTitle>
              <CardDescription className="text-xs">Current funds allocated across accounts</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {accounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  No accounts linked. Configure them in the Accounts tab.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="flex justify-between items-center p-4 hover:bg-card/10">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{acc.name}</p>
                        <Badge variant="outline" className="text-[9px] font-semibold py-0 uppercase mt-1 shrink-0">
                          {acc.type}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-foreground ml-4">{formatINR(acc.balanceInPaise)}</p>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-4 bg-muted/20 font-bold text-sm">
                    <span>Total Cash Pool</span>
                    <span className="text-primary">
                      {formatINR(accounts.reduce((sum, a) => sum + a.balanceInPaise, 0))}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Goal Trackers (Right side) */}
          <Card className="lg:col-span-8">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="h-4.5 w-4.5 text-primary" />
                Savings Goals
              </CardTitle>
              <CardDescription className="text-xs">
                Track funding progress on special goal-type envelopes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {goalsProgress.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  <Target className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="font-semibold text-foreground text-base">No active goals</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto">
                    Mark envelopes as goals in the **Envelopes** section, and set their target savings amounts!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {goalsProgress.map((goal) => {
                    const daysColorClass =
                      goal.daysRemaining !== null
                        ? goal.daysRemaining < 0
                          ? "text-negative"
                          : goal.daysRemaining <= 30
                          ? "text-warning"
                          : "text-muted-foreground"
                        : "text-muted-foreground";

                    return (
                      <div key={goal.id} className="p-5 hover:bg-card/10 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-foreground truncate">{goal.name}</h4>
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-semibold">
                                {goal.setName}
                              </Badge>
                              {goal.isCompleted && (
                                <Badge className="bg-positive/10 text-positive border-transparent font-bold text-[9px] py-0">
                                  Completed 🎉
                                </Badge>
                              )}
                            </div>
                            {goal.deadline && (
                              <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                                Target Date: {new Date(goal.deadline).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                                {goal.daysRemaining !== null && !goal.isCompleted && (
                                  <span className={`font-semibold ml-1 ${daysColorClass}`}>
                                    ({goal.daysRemaining < 0 
                                      ? `${Math.abs(goal.daysRemaining)} days overdue` 
                                      : `${goal.daysRemaining} days left`})
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="text-left sm:text-right shrink-0">
                            <span className="text-sm font-bold text-foreground">
                              {formatINR(goal.currentBalance)}
                            </span>
                            <span className="text-xs text-muted-foreground font-semibold">
                              {" "}
                              / {formatINR(goal.target)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                goal.isCompleted ? "bg-positive" : "bg-primary"
                              }`}
                              style={{ width: `${goal.progressPercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
                            <span>Funding Progress</span>
                            <span>{goal.progressPercent}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
