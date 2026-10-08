export type DemoPlace = {
  id: number;
  name: string;
  category: string;
  rating: number;
  distance_km: number;
  price_range: number;
  match: number;
  reason: string;
  weather_fit: string;
  ambience: string;
  indoor: boolean;
};

export const DEMO_PLACES: DemoPlace[] = [
  {
    id: 1,
    name: "Loom & Leaf Café",
    category: "cafe",
    rating: 4.7,
    distance_km: 1.2,
    price_range: 2,
    match: 94,
    reason: "Matches your café preference · Quiet ambience · Great for conversation",
    weather_fit: "Indoor — perfect for any weather",
    ambience: "Quiet & cozy",
    indoor: true,
  },
  {
    id: 2,
    name: "Central Green Park",
    category: "park",
    rating: 4.8,
    distance_km: 2.4,
    price_range: 1,
    match: 91,
    reason: "Outdoor preference · Sunny forecast · Free entry",
    weather_fit: "Best on sunny days",
    ambience: "Open air",
    indoor: false,
  },
  {
    id: 3,
    name: "Orion Cinema Hall",
    category: "cinema",
    rating: 4.5,
    distance_km: 3.1,
    price_range: 3,
    match: 88,
    reason: "Entertainment match · Group-friendly · Climate controlled",
    weather_fit: "Indoor — rain-proof",
    ambience: "Lively",
    indoor: true,
  },
  {
    id: 4,
    name: "Hopworks Brewpub",
    category: "bar",
    rating: 4.6,
    distance_km: 1.8,
    price_range: 3,
    match: 86,
    reason: "Friends outing · Medium budget · High popularity",
    weather_fit: "Covered terrace available",
    ambience: "Social & energetic",
    indoor: true,
  },
  {
    id: 5,
    name: "City Modern Art Gallery",
    category: "museum",
    rating: 4.4,
    distance_km: 4.0,
    price_range: 1,
    match: 84,
    reason: "Culture preference · Low crowd mid-week · Budget-friendly",
    weather_fit: "Fully indoor",
    ambience: "Calm & reflective",
    indoor: true,
  },
  {
    id: 6,
    name: "Truffles downtown",
    category: "restaurant",
    rating: 4.5,
    distance_km: 2.7,
    price_range: 2,
    match: 89,
    reason: "Restaurant preference · Couple-friendly · Strong reviews",
    weather_fit: "Indoor dining",
    ambience: "Casual & warm",
    indoor: true,
  },
];

export const GROUP_PERSONAS = [
  { id: "a", name: "Alex", emoji: "☕", prefs: ["Cafés", "Quiet spots"], budget: "Medium", color: "#c9a15a" },
  { id: "b", name: "Blake", emoji: "🎬", prefs: ["Entertainment", "Movies"], budget: "Low", color: "#b0505c" },
  { id: "c", name: "Casey", emoji: "🌳", prefs: ["Outdoor", "Parks"], budget: "Medium", color: "#8ea27e" },
];

export const GROUP_RESULT = {
  name: "Botanical Gardens Botanical Garden + Café nearby",
  match: 87,
  reason: "Balances outdoor preference with café stop · Fits medium budgets · Walking distance between stops",
  stops: [
    { time: "4:00 PM", place: "Botanical Gardens Botanical Garden", type: "park" },
    { time: "6:00 PM", place: "The Coffee Bean (nearby)", type: "cafe" },
  ],
};

export const ITINERARY_DEMO = [
  { time: "6:00 PM", place: "Loom & Leaf Café", category: "cafe", distance: "1.2 km", note: "Settle in before the evening" },
  { time: "7:30 PM", place: "Orion Cinema Hall", category: "cinema", distance: "2.1 km from café", note: "Show starts 7:45" },
  { time: "9:45 PM", place: "Truffles downtown", category: "restaurant", distance: "1.8 km from cinema", note: "Dinner reservation held" },
];

export const TESTIMONIALS = [
  {
    quote: "I stopped spending 30 minutes deciding where to go. Nearby just gets it.",
    name: "Priya S.",
    role: "Weekend planner",
  },
  {
    quote: "Finally, recommendations that actually understand what our group likes.",
    name: "Marcus T.",
    role: "Team lead",
  },
  {
    quote: "Weather-aware planning has completely changed how we organize weekends.",
    name: "Ananya R.",
    role: "Frequent traveler",
  },
];

export const FAQ_ITEMS = [
  {
    q: "How does Nearby & Co. work?",
    a: "You tell us your preferences, location, budget, and who you're going with. Our recommendation engine blends content matching, collaborative signals, weather, time, and group taste to surface places you're more likely to enjoy — with clear reasons for each suggestion.",
  },
  {
    q: "How are recommendations personalized?",
    a: "Every like, skip, rating, and visit feeds a feedback loop. Preferences you set during onboarding are combined with live context (weather, time of day) and similar-user patterns to rank places for you specifically.",
  },
  {
    q: "Can I plan outings with friends?",
    a: "Yes. Add multiple people with different preferences and budgets. The group planner finds options that minimize misery — so nobody ends up somewhere they dislike — while still maximizing overall match.",
  },
  {
    q: "Does it consider weather?",
    a: "Absolutely. Recommendations adapt to current and forecast conditions. If rain rolls in, outdoor suggestions can be swapped for indoor alternatives automatically in itineraries.",
  },
  {
    q: "Can I create itineraries?",
    a: "Yes. Turn recommendations into timed itineraries with travel distances, weather notes, and reminders. The system can suggest order and timing based on location and hours.",
  },
  {
    q: "Is my data private?",
    a: "Each workspace is isolated with PostgreSQL row-level security. Your preferences, interactions, and itineraries stay within your tenant. We never expose other workspaces' data.",
  },
  {
    q: "Can I use it for free?",
    a: "Yes. The Free plan covers individual exploration, recommendations, and basic itineraries. Pro and Team unlock advanced personalization, larger groups, and collaboration features.",
  },
  {
    q: "How does workspace isolation work?",
    a: "When you create a workspace you receive a unique API key. Every request is resolved to your tenant server-side; database policies enforce that queries only return your workspace's rows.",
  },
];

export const PRICING_PLANS = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "forever",
    description: "For individuals exploring the platform.",
    cta: "Start Free",
    href: "/signup",
    features: [
      "Personalized recommendations",
      "Weather-aware suggestions",
      "Basic itineraries",
      "Save up to 20 places",
      "Solo & couple planning",
    ],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹999",
    period: "/month",
    description: "For users who want advanced personalization and planning.",
    cta: "Upgrade",
    href: "/signup",
    features: [
      "Everything in Free",
      "Advanced preference learning",
      "Unlimited saved places",
      "Group planning (up to 6)",
      "Weather-reactive itinerary swaps",
      "Priority ranking updates",
    ],
    highlighted: true,
  },
  {
    id: "team",
    name: "Team",
    price: "₹3,999",
    period: "/month",
    description: "For groups and businesses that need collaborative planning.",
    cta: "Contact Sales",
    href: "/signup",
    features: [
      "Everything in Pro",
      "Shared workspaces",
      "Unlimited group members",
      "Activity & history analytics",
      "Admin controls",
      "Dedicated support",
    ],
    highlighted: false,
  },
];

export const ENGINE_FACTORS = [
  { id: "prefs", label: "Preferences", weight: 22 },
  { id: "context", label: "Context", weight: 18 },
  { id: "reviews", label: "Reviews", weight: 14 },
  { id: "distance", label: "Distance", weight: 12 },
  { id: "group", label: "Group taste", weight: 16 },
  { id: "popularity", label: "Popularity", weight: 8 },
  { id: "weather", label: "Weather", weight: 10 },
];
