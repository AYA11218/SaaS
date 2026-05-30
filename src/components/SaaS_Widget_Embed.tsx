import React, { useState, useEffect, CSSProperties } from "react";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  orderBy 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Widget, Testimonial } from "../types";
import { 
  Star, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare,
  Quote,
  Loader
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SaaSWidgetEmbedProps {
  widgetId: string;
}

export default function SaaS_Widget_Embed({ widgetId }: SaaSWidgetEmbedProps) {
  const [widget, setWidget] = useState<Widget | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load Widget Config and Testimonials
  useEffect(() => {
    async function loadWidgetAndData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Widget
        const widgetRef = doc(db, "widgets", widgetId);
        let docSnap;
        try {
          docSnap = await getDoc(widgetRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `widgets/${widgetId}`);
          return;
        }

        if (!docSnap.exists()) {
          setError("Widget target config was not found.");
          setLoading(false);
          return;
        }

        const widgetConfig = { id: docSnap.id, ...docSnap.data() } as Widget;
        setWidget(widgetConfig);

        // 2. Fetch approved matching reviews
        const testimonialsRef = collection(db, "testimonials");
        
        let q = query(
          testimonialsRef,
          where("spaceId", "==", widgetConfig.spaceId),
          where("status", "==", "approved"),
          orderBy("createdAt", "desc"),
          limit(widgetConfig.limit || 20)
        );

        let testSnaps;
        try {
          testSnaps = await getDocs(q);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, "testimonials approved query");
          return;
        }

        const list: Testimonial[] = [];
        testSnaps.forEach((d) => {
          const t = { id: d.id, ...d.data() } as Testimonial;
          // Filter on client side by campaign IDs if restricted spec is defined
          if (widgetConfig.campaignIds.length === 0 || widgetConfig.campaignIds.includes(t.campaignId)) {
            list.push(t);
          }
        });

        setTestimonials(list);
      } catch (err: any) {
        console.error("Widget fetch error:", err);
        setError("Database transaction refused or is warming up.");
      } finally {
        setLoading(false);
      }
    }

    if (widgetId) {
      loadWidgetAndData();
    }
  }, [widgetId]);

  // Carousel actions
  const nextCarousel = () => {
    if (testimonials.length === 0) return;
    setCarouselIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevCarousel = () => {
    if (testimonials.length === 0) return;
    setCarouselIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  if (loading) {
    return (
      <div className="w-full flex justify-center py-10">
        <Loader className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !widget) {
    return (
      <div className="w-full p-6 text-center bg-rose-50 rounded-xl border border-rose-150">
        <p className="text-rose-700 text-sm font-semibold">{error || "Failed loading proof snippet"}</p>
      </div>
    );
  }

  // Visual variable processing
  const containerStyle: CSSProperties = {
    backgroundColor: widget.theme === "dark" 
      ? "#0f172a" 
      : widget.theme === "light" 
        ? "#ffffff" 
        : widget.styles?.backgroundColor || "transparent",
    color: widget.theme === "dark" 
      ? "#f8fafc" 
      : widget.theme === "light" 
        ? "#0f172a" 
        : widget.styles?.textColor || "#1e293b",
    fontFamily: "Inter, sans-serif"
  };

  const cardStyleClass = (t: Testimonial) => {
    const rounded = widget.styles?.borderRadius === "none" 
      ? "rounded-none" 
      : widget.styles?.borderRadius === "md" 
        ? "rounded-xl" 
        : widget.styles?.borderRadius === "lg" 
          ? "rounded-2xl" 
          : "rounded-3xl";

    const border = widget.styles?.borderStyle === "none" 
      ? "" 
      : widget.styles?.borderStyle === "tinted" 
        ? "border-2 border-emerald-500/20" 
        : "border border-gray-150/40 dark:border-slate-800/40";

    const bg = widget.theme === "dark" 
      ? "bg-slate-900/60" 
      : widget.theme === "light" 
        ? "bg-white border border-gray-100" 
        : widget.styles?.cardBgColor || "rgba(255, 255, 255, 0.9)";

    const shadow = widget.styles?.borderStyle === "none" ? "shadow-md" : "shadow-sm";

    return `p-6 ${rounded} ${border} ${bg} ${shadow} flex flex-col justify-between relative transition-transform hover:scale-[1.01] overflow-hidden`;
  };

  // Mock list for empty preview setups
  const displayTestimonials = testimonials.length > 0 ? testimonials : [
    {
      id: "mock-1",
      name: "Alex Rivera",
      company: "Linear Corp",
      title: "VP of Engineering",
      rating: 5,
      content: "This testimonial widgets SaaS is absolutely mindblocking. We embedded our Wall of Love in minutes, and seen user upgrade conversions skyrocket by 32%. This is a definitive standard of proof platforms.",
      avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80",
      status: "approved" as const,
      createdAt: new Date()
    },
    {
      id: "mock-2",
      name: "Marcus Aurelius",
      company: "Acme Distribution",
      title: "Growth Hacker",
      rating: 5,
      content: "I recommend this micro SaaS platform to every founder. Tracking sentiments, editing campaign prompts, and displaying visual review panels directly requires zero technical logic.",
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80",
      status: "approved" as const,
      createdAt: new Date()
    }
  ] as Testimonial[];

  // 1. GRID LAYOUT
  if (widget.type === "grid") {
    return (
      <div style={containerStyle} className="p-4 w-full h-full min-h-[100px] outline-none">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayTestimonials.map((t, index) => (
            <motion.div
              key={t.id}
              initial={widget.styles?.enableGridAnimation ? { opacity: 0, y: 15 } : false}
              animate={widget.styles?.enableGridAnimation ? { opacity: 1, y: 0 } : false}
              transition={{ delay: index * 0.05 }}
              className={cardStyleClass(t)}
            >
              <div>
                {/* Stars */}
                {widget.showRating && t.rating > 0 && (
                  <div className="flex gap-1 mb-4">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star 
                        key={i} 
                        className="w-4 h-4 fill-current" 
                        style={{ color: widget.styles?.ratingColor || "#eab308" }} 
                      />
                    ))}
                  </div>
                )}
                {/* Content */}
                <p className="text-sm font-medium leading-relaxed opacity-90 mb-5 relative z-10">
                  "{t.content}"
                </p>
              </div>

              {/* Author Footer */}
              <div className="flex gap-3 items-center border-t border-gray-100/10 dark:border-slate-800/20 pt-4 mt-auto">
                {t.avatarUrl && (
                  <img 
                    src={t.avatarUrl} 
                    alt={t.name} 
                    className="w-10 h-10 rounded-full object-cover shadow-inner shrink-0" 
                  />
                )}
                <div>
                  <h4 className="text-sm font-bold opacity-100">{t.name}</h4>
                  {(t.title || t.company) && (
                    <p className="text-[11px] opacity-60 font-semibold mt-0.5">
                      {t.title} {t.title && t.company ? "at " : ""} {t.company}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // 2. CAROUSEL LAYOUT
  if (widget.type === "carousel") {
    const currentTestimonial = displayTestimonials[carouselIndex];
    if (!currentTestimonial) return null;

    return (
      <div style={containerStyle} className="p-6 w-full flex items-center justify-center min-h-[240px]">
        <div className="max-w-xl w-full flex items-center gap-4 relative">
          
          <button 
            type="button"
            onClick={prevCarousel}
            className="p-2 rounded-full border border-gray-200/40 hover:bg-slate-500/10 transition-colors focus:outline-none cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5 opacity-70" />
          </button>

          <div className="w-full relative overflow-hidden px-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTestimonial.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className={cardStyleClass(currentTestimonial)}
              >
                <div>
                  {widget.showRating && currentTestimonial.rating > 0 && (
                    <div className="flex gap-1 mb-4">
                      {[...Array(currentTestimonial.rating)].map((_, i) => (
                        <Star 
                          key={i} 
                          className="w-4.5 h-4.5 fill-current" 
                          style={{ color: widget.styles?.ratingColor || "#eab308" }} 
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-base font-medium italic opacity-95 leading-relaxed mb-6">
                    "{currentTestimonial.content}"
                  </p>
                </div>

                <div className="flex gap-3 items-center border-t border-gray-100/10 dark:border-slate-800/20 pt-4">
                  {currentTestimonial.avatarUrl && (
                    <img 
                      src={currentTestimonial.avatarUrl} 
                      alt={currentTestimonial.name} 
                      className="w-11 h-11 rounded-full object-cover shadow-sm shrink-0" 
                    />
                  )}
                  <div>
                    <h4 className="text-sm font-bold opacity-100">{currentTestimonial.name}</h4>
                    {(currentTestimonial.title || currentTestimonial.company) && (
                      <p className="text-xs opacity-60 font-semibold mt-0.5">
                        {currentTestimonial.title} {currentTestimonial.title && currentTestimonial.company ? "at " : ""} {currentTestimonial.company}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            
            {/* Dots */}
            <div className="flex gap-1.5 justify-center mt-4">
              {displayTestimonials.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setCarouselIndex(i)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer focus:outline-none ${i === carouselIndex ? "w-4 bg-emerald-500" : "w-1.5 bg-gray-300"}`}
                />
              ))}
            </div>
          </div>

          <button 
            type="button"
            onClick={nextCarousel}
            className="p-2 rounded-full border border-gray-200/40 hover:bg-slate-500/10 transition-colors focus:outline-none cursor-pointer shrink-0"
          >
            <ChevronRight className="w-5 h-5 opacity-70" />
          </button>

        </div>
      </div>
    );
  }

  // 3. SINGLE QUOTE LAYOUT
  if (widget.type === "single") {
    const quote = displayTestimonials[0];
    if (!quote) return null;

    return (
      <div style={containerStyle} className="p-8 w-full flex items-center justify-center">
        <div className="max-w-2xl w-full relative">
          <div className="absolute -left-4 -top-6 text-slate-150/40 dark:text-slate-800/10 select-none">
            <Quote className="w-20 h-20 fill-current opacity-30" />
          </div>
          <div className={cardStyleClass(quote)}>
            <div>
              {widget.showRating && quote.rating > 0 && (
                <div className="flex gap-1 mb-4">
                  {[...Array(quote.rating)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="w-5 h-5 fill-current" 
                      style={{ color: widget.styles?.ratingColor || "#eab308" }} 
                    />
                  ))}
                </div>
              )}
              <blockquote className="text-lg font-medium leading-relaxed opacity-95 text-slate-800 dark:text-slate-100 italic mb-6">
                "{quote.content}"
              </blockquote>
            </div>

            <div className="flex gap-3.5 items-center border-t border-gray-100/10 dark:border-slate-800/20 pt-4">
              {quote.avatarUrl && (
                <img 
                  src={quote.avatarUrl} 
                  alt={quote.name} 
                  className="w-12 h-12 rounded-full object-cover shadow-md shrink-0" 
                />
              )}
              <div>
                <cite className="not-italic text-sm font-bold opacity-100 block">{quote.name}</cite>
                {(quote.title || quote.company) && (
                  <p className="text-xs opacity-60 font-semibold mt-0.5">
                    {quote.title} {quote.title && quote.company ? "at " : ""} {quote.company}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. COMPACT BADGE LAYOUT
  if (widget.type === "badge") {
    const totalCount = testimonials.length > 0 ? testimonials.length : 12;
    const avgScore = 4.9;

    return (
      <div style={containerStyle} className="p-4 flex justify-center w-full">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="inline-flex items-center gap-3 bg-white dark:bg-slate-900 px-4.5 py-2.5 rounded-full shadow-md border border-gray-100 dark:border-slate-800"
        >
          {/* Avatar stack */}
          <div className="flex -space-x-2.5 overflow-hidden">
            {displayTestimonials.slice(0, 3).map((t) => (
              <img
                key={t.id}
                className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover"
                src={t.avatarUrl}
                alt={t.name}
              />
            ))}
          </div>

          <div className="h-4 w-[1px] bg-gray-200 dark:bg-slate-800 shrink-0" />

          {/* Core Info */}
          <div className="text-left text-xs font-semibold">
            <div className="flex items-center gap-1 font-extrabold text-slate-800 dark:text-slate-100">
              <span>{avgScore} / 5 stars</span>
              <div className="flex gap-0.5 ml-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold tracking-tight mt-0.5 uppercase">
              Backed by {totalCount}+ absolute client reviews
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}
