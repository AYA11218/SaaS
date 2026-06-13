import React, { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Smile, 
  Meh, 
  Frown, 
  Brain, 
  HelpCircle, 
  Calendar, 
  Activity, 
  Loader, 
  RefreshCw,
  Award,
  BookOpen,
  CheckCircle2,
  ThumbsUp
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell, 
  PieChart, 
  Pie,
  LineChart,
  Line
} from "recharts";
import { Testimonial } from "../types";

interface SentimentAnalysis {
  id: string;
  sentiment: "Positive" | "Neutral" | "Negative";
  score: number;
  reason: string;
}

interface SaaS_Sentiment_DashboardProps {
  testimonials: Testimonial[];
}

export const SaaS_Sentiment_Dashboard: React.FC<SaaS_Sentiment_DashboardProps> = ({ testimonials }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, SentimentAnalysis>>({});

  // Unique key to cache sentiment analysis results based on testimonials payload state
  const cacheKey = useMemo(() => {
    if (testimonials.length === 0) return "";
    const idsString = testimonials.map(t => t.id).sort().join(",");
    const contentsChecksum = testimonials.reduce((acc, curr) => acc + (curr.content?.length || 0) + curr.rating, 0);
    return `sentiment_analysis_${idsString}_${contentsChecksum}`;
  }, [testimonials]);

  // Read cache on mount/change
  useEffect(() => {
    if (!cacheKey) {
      setAnalysisResults({});
      return;
    }
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setAnalysisResults(JSON.parse(cached));
      } catch (err) {
        console.error("Failed to parse cached sentiment data:", err);
      }
    }
  }, [cacheKey]);

  const triggerSentimentAnalysis = async (force = false) => {
    if (testimonials.length === 0) return;
    
    // Check cache first to avoid redundant API request
    if (!force && Object.keys(analysisResults).length > 0) {
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/gemini/sentiment-trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testimonials })
      });

      if (!response.ok) {
        throw new Error(`HTTP network error: status ${response.status}`);
      }

      const resData = await response.json();
      if (resData.success && Array.isArray(resData.trendData)) {
        const mapped: Record<string, SentimentAnalysis> = {};
        resData.trendData.forEach((item: SentimentAnalysis) => {
          mapped[item.id] = item;
        });
        
        // Cache results
        if (cacheKey) {
          localStorage.setItem(cacheKey, JSON.stringify(mapped));
        }
        
        setAnalysisResults(mapped);
      } else {
        throw new Error(resData.error || "Malformed response from Gemini server route.");
      }
    } catch (err: any) {
      console.error("Failed sentiment analysis process:", err);
      setAnalysisError(err.message || "An unresolved error occurred analyzing feedback sentiments.");
    } finally {
      setAnalyzing(false);
    }
  };

  // If we have local storage cache or can auto-trigger
  useEffect(() => {
    if (testimonials.length > 0 && Object.keys(analysisResults).length === 0 && !analyzing && !analysisError) {
      triggerSentimentAnalysis();
    }
  }, [testimonials, analysisResults]);

  // Compute chronologically organized data for charts
  const chronologicalData = useMemo(() => {
    if (testimonials.length === 0) return [];

    // Sort testimonials oldest to newest to plot a meaningful trend line
    const sorted = [...testimonials].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateA - dateB;
    });

    let runningSum = 0;
    return sorted.map((t, idx) => {
      const analysis = analysisResults[t.id];
      const sentimentScore = analysis ? analysis.score : (t.rating >= 4 ? 0.75 : t.rating === 3 ? 0.1 : -0.5);
      const sentimentLabel = analysis ? analysis.sentiment : (t.rating >= 4 ? "Positive" : t.rating === 3 ? "Neutral" : "Negative");
      
      runningSum += sentimentScore;
      const cumulativeAvg = Number((runningSum / (idx + 1)).toFixed(2));

      // Friendly short date
      let formattedDate = "N/A";
      try {
        if (t.createdAt) {
          const d = new Date(t.createdAt);
          formattedDate = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        }
      } catch (_) {}

      return {
        id: t.id,
        name: t.name || "Customer",
        rating: t.rating,
        date: formattedDate,
        dateFull: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "",
        sentimentScore: Number(sentimentScore.toFixed(2)),
        cumulativeAvg,
        sentiment: sentimentLabel,
        content: t.content,
        reason: analysis ? analysis.reason : "Pending automated evaluation..."
      };
    });
  }, [testimonials, analysisResults]);

  // Aggregate Stats KPI calculations
  const stats = useMemo(() => {
    const total = chronologicalData.length;
    if (total === 0) return { positivePercent: 0, neutralPercent: 0, negativePercent: 0, avgScore: 0, momentum: "stable" };

    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    let sumScore = 0;

    chronologicalData.forEach(item => {
      sumScore += item.sentimentScore;
      if (item.sentiment === "Positive") positiveCount++;
      else if (item.sentiment === "Negative") negativeCount++;
      else neutralCount++;
    });

    const avgScore = Number((sumScore / total).toFixed(2));

    // Sentiment momentum: second half vs first half average
    let momentum: "improving" | "declining" | "stable" = "stable";
    if (total >= 2) {
      const half = Math.floor(total / 2);
      const firstHalf = chronologicalData.slice(0, half);
      const secondHalf = chronologicalData.slice(half);

      const firstHalfAvg = firstHalf.reduce((sum, item) => sum + item.sentimentScore, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, item) => sum + item.sentimentScore, 0) / secondHalf.length;

      const delta = secondHalfAvg - firstHalfAvg;
      if (delta > 0.15) momentum = "improving";
      else if (delta < -0.15) momentum = "declining";
    }

    return {
      positivePercent: Math.round((positiveCount / total) * 100),
      neutralPercent: Math.round((neutralCount / total) * 100),
      negativePercent: Math.round((negativeCount / total) * 100),
      avgScore,
      momentum
    };
  }, [chronologicalData]);

  // Sentiment breakdown by numeric categories for pie chart
  const pieData = useMemo(() => {
    const total = chronologicalData.length;
    if (total === 0) return [];
    
    let pos = 0, neu = 0, neg = 0;
    chronologicalData.forEach(item => {
      if (item.sentiment === "Positive") pos++;
      else if (item.sentiment === "Negative") neg++;
      else neu++;
    });

    return [
      { name: "Positive Sentiment", value: pos, color: "#10b981" },
      { name: "Neutral Sentiment", value: neu, color: "#f59e0b" },
      { name: "Negative Sentiment", value: neg, color: "#f43f5e" }
    ].filter(item => item.value > 0);
  }, [chronologicalData]);

  // Average sentiment score indexed by Star Rating (1 to 5)
  const scoreByRatingData = useMemo(() => {
    const sums = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    chronologicalData.forEach(item => {
      const r = item.rating as 5 | 4 | 3 | 2 | 1;
      if (sums[r] !== undefined) {
        sums[r] += item.sentimentScore;
        counts[r] += 1;
      }
    });

    return [1, 2, 3, 4, 5].map(rating => {
      const count = counts[rating as 5 | 4 | 3 | 2 | 1];
      const avg = count > 0 ? Number((sums[rating as 5 | 4 | 3 | 2 | 1] / count).toFixed(2)) : 0;
      return {
        rating: `${rating} ★`,
        avgScore: avg,
        count
      };
    });
  }, [chronologicalData]);

  // Custom detailed tooltip for Recharts Line Graph
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl shadow-xl space-y-2 max-w-xs text-white z-50">
          <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{data.name}</span>
            <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">{data.dateFull}</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Customer Rating:</span>
              <span className="font-extrabold text-amber-400">{data.rating} ★</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Gemini Polarity Score:</span>
              <span className={`font-black uppercase tracking-wider text-[11px] ${
                data.sentimentScore >= 0.4 ? "text-emerald-400" : data.sentimentScore <= -0.2 ? "text-rose-400" : "text-amber-400"
              }`}>
                {data.sentimentScore > 0 ? `+${data.sentimentScore}` : data.sentimentScore}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium font-sans">Opinion Mode:</span>
              <span className={`font-bold text-[11px] ${
                data.sentiment === "Positive" ? "text-emerald-400" : data.sentiment === "Negative" ? "text-rose-400" : "text-amber-400"
              }`}>{data.sentiment}</span>
            </div>
          </div>
          {data.reason && (
            <p className="text-[10px] border-t border-white/5 pt-1.5 leading-normal italic text-slate-300">
              ⚡ Reason: {data.reason}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (testimonials.length === 0) {
    return (
      <div className="bento-card-glass p-8 rounded-3xl border border-slate-205 text-center flex flex-col justify-center items-center h-80 space-y-4">
        <Frown className="w-12 h-12 text-slate-400 animate-bounce" />
        <div className="space-y-1">
          <h3 className="text-sm font-black text-slate-900 tracking-tight">No Collected Reviews for Sentiment Mapping</h3>
          <p className="text-xs text-slate-450 leading-relaxed max-w-sm font-semibold">
            Once customer responses begin streaming in, Gemini will trace customer feelings over time and render visual line graphs here!
          </p>
        </div>
      </div>
    );
  }

  // Sentiment index descriptor
  const getIndexDescription = (score: number) => {
    if (score >= 0.6) return { text: "Outstanding (Solid Delight)", color: "text-emerald-600 bg-emerald-50 border-emerald-100/50", icon: Smile };
    if (score >= 0.2) return { text: "Satisfactory (Positive Lean)", color: "text-indigo-600 bg-indigo-50 border-indigo-100/50", icon: ThumbsUp };
    if (score >= -0.2) return { text: "Neutral / Balanced Feedback", color: "text-amber-600 bg-amber-50 border-amber-100/50", icon: Meh };
    return { text: "Critical Reaction Needed", color: "text-rose-600 bg-rose-50 border-rose-100/50", icon: Frown };
  };

  const currentDesc = getIndexDescription(stats.avgScore);
  const DescIcon = currentDesc.icon;

  return (
    <div className="space-y-6">
      {/* Visual Analytics Hub Heading and Control */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4.5">
        <div className="space-y-1">
          <h2 className="text-base font-black text-slate-950 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 animate-pulse" /> Client Sentiment Trend Analytics
          </h2>
          <p className="text-xs text-slate-450 font-semibold">
            Visual feedback momentum charting using server-side Gemini sentiment scoring.
          </p>
        </div>

        <button
          onClick={() => triggerSentimentAnalysis(true)}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 rounded-xl text-xs font-bold leading-none outline-none border border-slate-200/50 cursor-pointer disabled:opacity-50 select-none transition-all hover:scale-101 active:scale-99 shadow-xs"
        >
          {analyzing ? (
            <>
              <Loader className="w-3.5 h-3.5 animate-spin text-indigo-650" /> Evaluating...
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Deep Re-Analyze Sentiment
            </>
          )}
        </button>
      </div>

      {analysisError && (
        <div className="p-4 bg-rose-50 text-rose-800 text-xs font-bold rounded-2xl border border-rose-200/60 leading-relaxed">
          🚨 {analysisError}
        </div>
      )}

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Sentiment Score index */}
        <div className="bento-card-glass p-5 rounded-2.5xl border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-md transition-all duration-300 space-y-2.5">
          <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest font-mono">Sentiment Polarity</span>
          <div className="space-y-1">
            <span className="text-2xl font-black tracking-tight text-slate-900 block font-mono">
              {stats.avgScore > 0 ? `+${stats.avgScore}` : stats.avgScore}
            </span>
            <div className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${currentDesc.color}`}>
              <DescIcon className="w-3 h-3 shrink-0" />
              <span>{currentDesc.text}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Positive ratio */}
        <div className="bento-card-glass p-5 rounded-2.5xl border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.01)] space-y-2.5">
          <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest font-mono">Approval Ratio</span>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2x1 font-black leading-none text-emerald-600 tracking-tight text-2xl font-mono">{stats.positivePercent}%</span>
              <span className="text-[10px] text-slate-400 font-extrabold">Positives</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all" 
                style={{ width: `${stats.positivePercent}%` }} 
              />
            </div>
          </div>
        </div>

        {/* KPI 3: Neutral & Critical count */}
        <div className="bento-card-glass p-5 rounded-2.5xl border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.01)] space-y-2.5">
          <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest font-mono">Critical & Neutral</span>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-amber-600 flex items-center gap-1">
                <Meh className="w-3.5 h-3.5" /> {stats.neutralPercent}% Neutral
              </span>
              <span className="font-bold text-rose-500 flex items-center gap-1">
                <Frown className="w-3.5 h-3.5" /> {stats.negativePercent}% Critical
              </span>
            </div>
            <div className="flex w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-400 h-full transition-all" style={{ width: `${stats.neutralPercent}%` }} />
              <div className="bg-rose-500 h-full transition-all" style={{ width: `${stats.negativePercent}%` }} />
            </div>
          </div>
        </div>

        {/* KPI 4: Momentum trend direction */}
        <div className="bento-card-glass p-5 rounded-2.5xl border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.01)] space-y-2.5">
          <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest font-mono">Feedback Momentum</span>
          <div className="space-y-1">
            {stats.momentum === "improving" ? (
              <div className="space-y-0.5">
                <span className="text-slate-900 font-black text-base flex items-center gap-1 leading-tight text-emerald-600 text-lg">
                  <TrendingUp className="w-5 h-5 animate-bounce" /> Improving
                </span>
                <span className="text-[10px] text-slate-400 font-semibold block leading-normal">
                  Recent reviews show higher sentiment scores. Keep up the high standard!
                </span>
              </div>
            ) : stats.momentum === "declining" ? (
              <div className="space-y-0.5">
                <span className="text-slate-900 font-black text-base flex items-center gap-1 leading-tight text-rose-600 text-lg">
                  <TrendingDown className="w-5 h-5 animate-pulse" /> Declining
                </span>
                <span className="text-[10px] text-slate-400 font-semibold block leading-normal">
                  Recent reviews are tracking lower. Time to address customer criticisms.
                </span>
              </div>
            ) : (
              <div className="space-y-0.5">
                <span className="text-slate-900 font-black text-base flex items-center gap-1 leading-tight text-indigo-600 text-lg">
                  <Activity className="w-5 h-5" /> Consistent
                </span>
                <span className="text-[10px] text-slate-400 font-semibold block leading-normal">
                  Steady, reliable sentiment score over current feedback timeline.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {analyzing && (Object.keys(analysisResults).length === 0) ? (
        <div className="bento-card-glass py-16 px-6 rounded-3xl border border-slate-205 flex flex-col justify-center items-center gap-3">
          <Brain className="w-10 h-10 text-indigo-600 animate-pulse" />
          <Loader className="w-5 h-5 animate-spin text-slate-450" />
          <div className="text-center space-y-0.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Gemini Parsing Testimonials...</h4>
            <p className="text-[11px] text-slate-450 font-semibold max-w-xs leading-normal">
              Analyzing text syntax, computing emotional ratings under the server-to-server gateway...
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Main Line trend - span 3 */}
          <div className="lg:col-span-3 bento-card-glass rounded-3xl border border-slate-202 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3.5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-450 font-mono">Chronological Sentiment Wave</span>
                <h3 className="text-xs font-black text-slate-900 tracking-tight">Polarity & Cumulative Average Trend</h3>
              </div>
              <div className="flex gap-2.5 text-[9px] font-black uppercase font-mono tracking-wider">
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-slate-450" />
                  <span>Avg</span>
                </div>
                <div className="flex items-center gap-1 text-indigo-600">
                  <span className="h-2 w-2 rounded-full bg-indigo-505" />
                  <span>Pol. Score</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full text-xs font-semibold select-none">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chronologicalData}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={9} 
                    domain={[-1, 1]} 
                    tickFormatter={(value) => `${value > 0 ? "+" : ""}${value}`}
                    line={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="sentimentScore"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorScore)"
                    name="Sentiment Score"
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeAvg"
                    stroke="#334155"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    name="Moving Avg"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Distribution widgets - span 2 */}
          <div className="lg:col-span-2 bento-card-glass rounded-3xl border border-slate-202 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-5">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-450 font-mono">Aggregate Shares</span>
              <h3 className="text-xs font-black text-slate-900 tracking-tight">Emotional Tone Breakdown</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {/* Pie rendering widget */}
              <div className="h-32 w-full flex items-center justify-center relative font-mono text-[10px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} submission(s)`]} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text count HUD */}
                <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
                  <span className="text-slate-400 text-[8px] uppercase tracking-widest font-black font-sans leading-none">Total</span>
                  <span className="text-sm font-black text-slate-800 font-mono leading-tight">{chronologicalData.length}</span>
                </div>
              </div>

              {/* Legends details sidebar */}
              <div className="space-y-2.5 flex flex-col justify-center">
                {pieData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs border-b border-dashed border-slate-100 pb-1.5 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-extrabold text-slate-700">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-900 font-mono bg-slate-50 px-2 py-0.5 rounded-md border border-slate-205">
                      {item.value} ({Math.round((item.value / chronologicalData.length) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar Chart mapping rating average sentiment score - span 2 */}
          <div className="lg:col-span-2 bento-card-glass rounded-3xl border border-slate-202 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3.5 hover:shadow-md transition-shadow">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-450 font-mono">Rating Translation</span>
              <h3 className="text-xs font-black text-slate-900 tracking-tight">Average Sentiment by Rating Class</h3>
            </div>

            <div className="h-52 w-full text-xs font-mono font-bold select-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scoreByRatingData}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis 
                    dataKey="rating" 
                    stroke="#94a3b8" 
                    tickLine={false} 
                    axisLine={false} 
                    fontSize={10} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    domain={[-1, 1]} 
                    tickLine={false} 
                    axisLine={false} 
                    fontSize={8} 
                  />
                  <Tooltip 
                    formatter={(value: any) => [`Score: ${value}`, "Avg Sentiment"]}
                    contentStyle={{ borderRadius: "1rem", backgroundColor: "#0f172a", border: "1px solid #1e293b", color: "#fff" }}
                  />
                  <Bar dataKey="avgScore" maxBarSize={30}>
                    {scoreByRatingData.map((entry, index) => {
                      const score = entry.avgScore;
                      const fill = score >= 0.4 ? "#10b981" : score <= -0.2 ? "#f43f5e" : "#f59e0b";
                      return <Cell key={`cell-${index}`} fill={fill} radius={[6, 6, 0, 0]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed analyzed tabular items - span 3 */}
          <div className="lg:col-span-3 bento-card-glass rounded-3xl border border-slate-202 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-3">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-450 font-mono">Audit Trails</span>
                <h3 className="text-xs font-black text-slate-900 tracking-tight">Gemini Semantic Valuation Logs</h3>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {chronologicalData.slice().reverse().map((item, idx) => {
                  const score = item.sentimentScore;
                  const scoreColor = score >= 0.4 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : score <= -0.2 ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-amber-50 text-amber-700 border-amber-100";
                  
                  return (
                    <div key={idx} className="p-3 bg-slate-50/70 border border-slate-200/50 rounded-xl text-[11px] leading-relaxed flex flex-col sm:flex-row justify-between items-start gap-2 scroll-mt-2 hover:bg-slate-50 transition-colors">
                      <div className="space-y-1 sm:max-w-[75%]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-800">{item.name}</span>
                          <span className="text-[9px] text-amber-500 font-extrabold">{item.rating}★</span>
                          <span className="text-[9px] text-slate-400 font-semibold">{item.date}</span>
                        </div>
                        <p className="text-slate-650 font-medium italic line-clamp-1">"{item.content}"</p>
                        <p className="text-[9px] text-slate-450 font-semibold"><span className="font-extrabold text-indigo-650">Gemini:</span> {item.reason}</p>
                      </div>

                      <div className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase font-mono flex items-center justify-center gap-1 shrink-0 ${scoreColor}`}>
                        <span>Score:</span>
                        <span>{score > 0 ? `+${score}` : score}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center gap-1 text-[9px] text-slate-400 font-extrabold uppercase font-mono">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Real-time model: gemini-3.5-flash text polarity resolver</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
