export interface Space {
  id: string;
  name: string;
  logoUrl?: string;
  ownerId: string;
  createdAt: any; // Timestamp or date string
}

export interface Campaign {
  id: string;
  spaceId: string;
  title: string;
  slug: string;
  status: "active" | "paused";
  logoUrl?: string;
  heading: string;
  subheading: string;
  questions: string[];
  collectDetails: {
    rating: boolean;
    title: boolean;
    company: boolean;
    socialUrl: boolean;
    avatarUrl: boolean;
  };
  thankYouTitle: string;
  thankYouMessage: string;
  createdAt: any;
  updatedAt: any;
}

export interface Testimonial {
  id: string;
  campaignId: string;
  spaceId: string;
  name: string;
  email: string;
  company?: string;
  title?: string;
  rating: number; // 1 to 5
  content: string;
  avatarUrl?: string;
  socialUrl?: string;
  status: "new" | "approved" | "archived";
  sentiment?: "Positive" | "Neutral" | "Negative";
  aiSummary?: string;
  tags?: string[];
  createdAt: any;
}

export interface Widget {
  id: string;
  spaceId: string;
  name: string;
  type: "grid" | "carousel" | "single" | "badge";
  theme: "light" | "dark" | "custom";
  campaignIds: string[];
  styles: {
    backgroundColor: string;
    textColor: string;
    cardBgColor: string;
    ratingColor: string;
    borderRadius: "none" | "md" | "lg" | "full";
    borderStyle: "none" | "subtle" | "tinted";
    enableGridAnimation: boolean;
  };
  limit: number;
  showRating: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface AISyntheticResult {
  sentimentSummary: string;
  averageRatingString: string;
  strengths: string[];
  heroHook: string;
  heroSubheading: string;
  marketingCopies: {
    twitter: string;
    linkedin: string;
    facebookAd: string;
  };
}
