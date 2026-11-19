export interface CampusLocation {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description?: string | null;
  photoUrl?: string | null;
}

export interface CampusPathNode {
  id: string;
  lat: number;
  lng: number;
}

export interface CampusPathEdge {
  id: string;
  node_a: string;
  node_b: string;
}

export interface NavigationRoute {
  totalDistanceMeters: number;
  estimatedDurationMinutes: number;
  stepCount: number;
  hasStairs: boolean;
  coordinates: [number, number][]; // [lng, lat][]
}
