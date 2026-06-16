import React, { useMemo, useState } from "react";
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  Layers, 
  Award, 
  CheckCircle, 
  FileText, 
  MessageSquare, 
  Zap, 
  Info,
  Clock,
  Target
} from "lucide-react";
import { Testimonial, Campaign } from "../types";
import { motion } from "motion/react";

interface SaaS_Collection_TrendsProps {
  testimonials: Testimonial[];
  campaigns: Campaign[];
}

export const SaaS_Collection_Trends: React.FC<SaaS_Collection_TrendsProps> = ({ testimonials, campaigns }) => {
  const [activeRange, setActiveRange] = useState<"6m" | "12m">("6m");
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // Parse Month and Year helper
  const getMonthYear = (dateInput: any) => {
    if (!dateInput) return "Unknown";
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return "Unknown";
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" }); // e.g. "Jun 2026"
    } catch (_) {
      return "Unknown";
    }
  };

  // 1. Group testimonials by Month over the last 6 or 12 months
  const monthlyStats = useMemo(() => {
    const groups: Record<string, { label: string; timestamp: number; total: number; approved: number; pending: number; starsSum: number }> = {};
    const monthsToShow = activeRange === "6m" ? 6 : 12;
    const now = new Date();

    // Initialize consecutive months to avoid gaps in data
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      groups[label] = {
        label,
        timestamp: d.getTime(),
        total: 0,
        approved: 0,
        pending: 0,
        starsSum: 0
      };
    }

    // Populate data
    testimonials.forEach(t => {
      const label = getMonthYear(t.createdAt);
      if (label === "Unknown") return;

      const dateObj = new Date(t.createdAt);
      const firstDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime();

      // If it exists in our list, increment. Otherwise create if outside standard window but don't force infinite logs
      if (groups[label]) {
        groups[label].total += 1;
        if (t.status === "approved") {
          groups[label].approved += 1;
        } else if (t.status === "new" || t.status === "archived") {
          groups[label].pending += 1;
        }
        groups[label].starsSum += t.rating;
      } else {
        // If it falls outside the preloaded 6 or 12 range, we check if it is historical
        groups[label] = {
          label,
          timestamp: firstDay,
          total: 1,
          approved: t.status === "approved" ? 1 : 0,
          pending: t.status === "approved" ? 0 : 1,
          starsSum: t.rating
        };
      }
    });

    // Array layout sorted chronologically
    return Object.values(groups)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(item => ({
        ...item,
        avgRating: item.total > 0 ? Number((item.starsSum / item.total).toFixed(1)) : 0
      }));
  }, [testimonials, activeRange]);

  // 2. Statistics and Growth rate percentages
  const collectionVolumeStats = useMemo(() => {
    const total = testimonials.length;
    if (total === 0) {
      return {
        currentMonthCount: 0,
        previousMonthCount: 0,
        growthPercentage: 0,
        weeklyVelocity: "0.0",
        ratingAverage: "0.0"
      };
    }

    const now = new Date();
    const currentMonthLabel = now.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthLabel = prevMonthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    let currentMonthCount = 0;
    let previousMonthCount = 0;
    let ratingSum = 0;

    testimonials.forEach(t => {
      const itemLabel = getMonthYear(t.createdAt);
      if (itemLabel === currentMonthLabel) {
        currentMonthCount++;
      } else if (itemLabel === prevMonthLabel) {
        previousMonthCount++;
      }
      ratingSum += t.rating;
    });

    // Simple percentage delta calculation
    let growthPercentage = 0;
    if (previousMonthCount > 0) {
      growthPercentage = Math.round(((currentMonthCount - previousMonthCount) / previousMonthCount) * 100);
    } else if (currentMonthCount > 0) {
      growthPercentage = 100; // positive infinity / 100% start
    }

    // Weekly benchmark capture
    const weeklyVelocity = (total / 4.3).toFixed(1);
    const ratingAverage = (ratingSum / total).toFixed(1);

    return {
      currentMonthCount,
      previousMonthCount,
      growthPercentage,
      weeklyVelocity,
      ratingAverage
    };
  }, [testimonials]);

  // 3. Campaign Performance comparative rankings
  const campaignVolumeStats = useMemo(() => {
    const campaignMap = new Map<string, { id: string; name: string; total: number; approved: number; starsSum: number }>();

    // Seed map with existing campaigns to catch zero ones
    campaigns.forEach(c => {
      campaignMap.set(c.id, {
        id: c.id,
        name: c.title,
        total: 0,
        approved: 0,
        starsSum: 0
      });
    });

    // Rollup testimonial entries
    testimonials.forEach(t => {
      if (!t.campaignId) return;
      let entry = campaignMap.get(t.campaignId);
      if (!entry) {
        entry = {
          id: t.campaignId,
          name: "Unknown Channel",
          total: 0,
          approved: 0,
          starsSum: 0
        };
        campaignMap.set(t.campaignId, entry);
      }
      entry.total += 1;
      if (t.status === "approved") {
        entry.approved += 1;
      }
      entry.starsSum += t.rating;
    });

    return Array.from(campaignMap.values())
      .map(entry => ({
        ...entry,
        avgRating: entry.total > 0 ? Number((entry.starsSum / entry.total).toFixed(1)) : 0
      }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [testimonials, campaigns]);

  // Milestone Progress target
  const milestones = useMemo(() => {
    const totalCount = testimonials.length;
    const target = totalCount < 5 ? 10 : totalCount < 15 ? 20 : totalCount < 40 ? 50 : 100;
    const percentage = Math.min(Math.round((totalCount / target) * 100), 100);
    
    return {
      target,
      count: totalCount,
      percentage,
      remaining: Math.max(target - totalCount, 0)
    };
  }, [testimonials]);

  if (testimonials.length === 0) {
    return (
      <div className="bento-card-glass p-8 rounded-3xl border border-slate-205 text-center flex flex-col justify-center items-center h-80 space-y-4">
        <Target className="w-12 h-12 text-slate-400 animate-pulse" />
        <div className="space-y-1">
          <h3 className="text-sm font-black text-slate-900 tracking-tight">No Testimonial Collection Records</h3>
          <p className="text-xs text-slate-450 leading-relaxed max-w-sm font-semibold">
            Once client reviews flow into active campaigns, beautiful volume charts, monthly growth analysis, and campaign performance indices will populate in real-time here!
          </p>
        </div>
      </div>
    );
  }

  // Custom tooltips
  const CollectionTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl space-y-1 text-white text-[11px] font-sans">
          <p className="font-extrabold uppercase tracking-wider text-[9px] text-slate-400 border-b border-white/5 pb-1 mb-1">{data.label}</p>
          <div className="flex justify-between gap-6">
            <span className="text-slate-400 font-medium">Total Collected:</span>
            <span className="font-black text-white">{data.total} reviews</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-slate-400 font-medium">Approved & Live:</span>
            <span className="font-bold text-emerald-400">{data.approved} items</span>
          </div>
          {data.pending > 0 && (
            <div className="flex justify-between gap-6">
              <span className="text-slate-400 font-medium">Drafts / Pending:</span>
              <span className="font-bold text-amber-400">{data.pending} items</span>
            </div>
          )}
          <div className="flex justify-between gap-6 border-t border-white/5 pt-1 mt-1">
            <span className="text-slate-400 font-medium font-sans">Avg Month Score:</span>
            <span className="font-extrabold text-amber-400">{data.avgRating} ★</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CampaignTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl space-y-1 text-white text-[11px] font-sans">
          <p className="font-extrabold text-slate-200 border-b border-white/5 pb-1 mb-1 text-xs">{data.name}</p>
          <div className="flex justify-between gap-6">
            <span className="text-slate-400 font-medium">Direct Submissions:</span>
            <span className="font-black text-emerald-400">{data.total} replies</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-slate-400 font-medium">Social Conversion Rate:</span>
            <span className="font-bold text-white">
              {data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0}% Approved
            </span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-slate-400 font-medium">Average Star Rating:</span>
            <span className="font-extrabold text-amber-400">{data.avgRating} ★</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4.5">
        <div className="space-y-1">
          <h2 className="text-base font-black text-slate-955 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" /> Testimonial Collection Volume & Growth Trends
          </h2>
          <p className="text-xs text-slate-450 font-semibold">
            Monitor client acquisition, monthly review velocity, and individual campaign effectiveness.
          </p>
        </div>

        {/* Range control buttons */}
        <div className="flex bg-slate-100 border border-slate-200/50 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveRange("6m")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer ${
              activeRange === "6m"
                ? "bg-white text-slate-900 shadow-sm font-extrabold"
                : "text-slate-550 hover:text-slate-900"
            }`}
          >
            Last 6 Months
          </button>
          <button
            onClick={() => setActiveRange("12m")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none cursor-pointer ${
              activeRange === "12m"
                ? "bg-white text-slate-900 shadow-sm font-extrabold"
                : "text-slate-550 hover:text-slate-900"
            }`}
          >
            Last Year
          </button>
        </div>
      </div>

      {/* KPI Stats Bento grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Collection Total */}
        <div className="bento-card-glass p-5 rounded-2.5xl border border-slate-200/60 shadow-xs hover:shadow-md transition-all duration-300 space-y-2.5">
          <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest font-mono flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> Total Collected
          </span>
          <div className="space-y-0.5">
            <span className="text-3xl font-black tracking-tight text-slate-955 block font-mono">
              {testimonials.length}
            </span>
            <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1 bg-emerald-50 w-fit px-1.5 py-0.5 rounded border border-emerald-100/50">
              <CheckCircle className="w-3 h-3" /> {testimonials.filter(t => t.status === "approved").length} Live Approved
            </span>
          </div>
        </div>

        {/* KPI 2: Current Month collection volume */}
        <div className="bento-card-glass p-5 rounded-2.5xl border border-slate-200/60 shadow-xs hover:shadow-md transition-all duration-300 space-y-2.5">
          <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest font-mono flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-teal-500" /> This Month
          </span>
          <div className="space-y-0.5">
            <span className="text-3xl font-black tracking-tight text-slate-955 block font-mono">
              +{collectionVolumeStats.currentMonthCount}
            </span>
            {collectionVolumeStats.growthPercentage >= 0 ? (
              <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                +{collectionVolumeStats.growthPercentage}% MoM Growth
              </span>
            ) : (
              <span className="text-[10px] text-rose-550 font-extrabold flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                {collectionVolumeStats.growthPercentage}% MoM Decrease
              </span>
            )}
          </div>
        </div>

        {/* KPI 3: Speed rate */}
        <div className="bento-card-glass p-5 rounded-2.5xl border border-slate-200/60 shadow-xs hover:shadow-md transition-all duration-300 space-y-2.5">
          <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest font-mono flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" /> Collection Velocity
          </span>
          <div className="space-y-0.5">
            <span className="text-3xl font-black tracking-tight text-slate-955 block font-mono">
              {collectionVolumeStats.weeklyVelocity}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold block leading-tight">
              Average reviews collected per week across all live domains
            </span>
          </div>
        </div>

        {/* KPI 4: Quality score */}
        <div className="bento-card-glass p-5 rounded-2.5xl border border-slate-200/60 shadow-xs hover:shadow-md transition-all duration-300 space-y-2.5">
          <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest font-mono flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-emerald-500" /> Quality Index
          </span>
          <div className="space-y-0.5">
            <span className="text-3xl font-black tracking-tight text-amber-500 block font-mono">
              {collectionVolumeStats.ratingAverage} <span className="text-lg text-slate-400">/ 5.0</span>
            </span>
            <span className="text-[10px] text-slate-400 font-semibold block leading-tight">
              Global rating index representing total collective satisfaction score
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main Monthly Area Trend Chart - Span 3 */}
        <div className="lg:col-span-3 bento-card-glass rounded-3xl border border-slate-200/60 p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 font-mono">Dynamic Channel Flow</span>
              <h3 className="text-xs font-black text-slate-900 tracking-tight">Cumulative Collection Volume</h3>
            </div>
            
            <div className="flex gap-3 text-[9px] font-black uppercase font-mono tracking-wider">
              <div className="flex items-center gap-1 text-indigo-500">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                <span>Total Response Wave</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-500">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span>Approved (Live)</span>
              </div>
            </div>
          </div>

          <div className="h-68 w-full text-xs font-semibold select-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyStats}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="#94a3b8" 
                  fontSize={9} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={9} 
                  line={false}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CollectionTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  name="Total Collected"
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorApproved)"
                  name="Approved"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Milestone Tracker & Interactive Progress Target - Span 2 */}
        <div className="lg:col-span-2 bento-card-glass rounded-3xl border border-slate-200/60 p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 font-mono">Milestone Engine</span>
              <h3 className="text-xs font-black text-slate-900 tracking-tight">Active Team Progress Target</h3>
            </div>

            {/* Circular milestone visualization */}
            <div className="py-2 flex items-center justify-center gap-5">
              <div className="relative w-28 h-28 shrink-0">
                {/* SVG Radial Gauge */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="46"
                    stroke="#f1f5f9"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="46"
                    stroke="url(#milestoneGradient)"
                    strokeWidth="8.5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 46}
                    strokeDashoffset={2 * Math.PI * 46 * (1 - milestones.percentage / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="milestoneGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Center progress metrics overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center font-sans">
                  <span className="text-2xl font-black text-slate-950 block leading-none font-mono">{milestones.percentage}%</span>
                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block mt-1 leading-none">Milestone</span>
                </div>
              </div>

              <div className="space-y-2 font-sans select-none">
                <span className="text-[9px] font-black uppercase font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-150 block w-fit">
                  👑 Target unlock
                </span>
                <p className="text-xs font-semibold leading-relaxed text-slate-600">
                  Collect <strong className="text-slate-900">{milestones.target} reviews</strong> in this space to lock down elite SEO search snippets.
                </p>
                <div className="text-[10px] text-slate-400 font-medium">
                  Status: <strong className="text-slate-700">{milestones.count}</strong> / {milestones.target} reviews ({milestones.remaining} remaining)
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-3 flex.5 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 font-sans mt-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="font-semibold">
              <strong>Actionable Tip:</strong> Share your active campaigns widget links over your client follow-up newsletter to gather the outstanding <strong className="text-slate-800 font-bold">{milestones.remaining} reviews</strong> before this week ends.
            </p>
          </div>
        </div>
      </div>

      {/* Campaigns performance rankings bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Campaign rankings chart - Span 3 */}
        <div className="lg:col-span-3 bento-card-glass rounded-3xl border border-slate-200/60 p-5 shadow-xs space-y-4">
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 font-mono">Conversion Leaderboard</span>
            <h3 className="text-xs font-black text-slate-900 tracking-tight">Active Review Intake by Campaign Node</h3>
          </div>

          <div className="h-60 w-full text-xs font-mono font-bold select-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={campaignVolumeStats}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  width={110}
                />
                <Tooltip content={<CampaignTooltip />} />
                <Bar 
                  dataKey="total" 
                  fill="#6366f1" 
                  onMouseEnter={(state) => {
                    if (state && state.id) setHoveredBar(state.id);
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={20}
                >
                  {campaignVolumeStats.map((entry, index) => {
                    const isHovered = hoveredBar === entry.id;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isHovered ? "#4f46e5" : "#6366f1"} 
                        className="transition-all duration-200"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Channels tabular breakdown detail side widget - Span 2 */}
        <div className="lg:col-span-2 bento-card-glass rounded-3xl border border-slate-200/60 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 font-mono">Detailed Intake Audit</span>
              <h3 className="text-xs font-black text-slate-900 tracking-tight">Campaign Response Distribution</h3>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {campaignVolumeStats.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50/75 hover:bg-slate-50 border border-slate-200/40 rounded-xl flex items-center justify-between gap-3 text-[11px] leading-relaxed transition-all">
                  <div className="space-y-0.5 max-w-[65%]">
                    <p className="font-extrabold text-slate-800 truncate">{item.name}</p>
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-semibold font-mono">
                      <span>Score: {item.avgRating} ★</span>
                      <span>•</span>
                      <span>{Math.round((item.approved / item.total) * 100)}% approved</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-[10px] font-black text-slate-700 shadow-3xs shrink-0">
                    <FileText className="w-3 h-3 text-indigo-400 pt-[1px]" />
                    <span>{item.total} reviews</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 flex items-center gap-1.5 text-[9px] text-slate-400 font-extrabold uppercase font-mono">
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
            <span>Automatic response syndication active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
