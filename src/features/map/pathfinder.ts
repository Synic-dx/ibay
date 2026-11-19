import campusNodes from "./data/campus-nodes.json";
import campusEdges from "./data/campus-edges.json";
import type { CampusPathNode, CampusPathEdge, NavigationRoute } from "./types";
import { calculateDistanceMeters } from "./proximity";

export { calculateDistanceMeters };

const nodes: CampusPathNode[] = campusNodes as CampusPathNode[];
const edges: CampusPathEdge[] = campusEdges as CampusPathEdge[];

const nodeMap = new Map<string, CampusPathNode>();
for (const n of nodes) {
  nodeMap.set(n.id, n);
}

// Build adjacency list
interface Edge {
  target: string;
  weight: number;
}
const adj = new Map<string, Edge[]>();

for (const e of edges) {
  const nA = nodeMap.get(e.node_a);
  const nB = nodeMap.get(e.node_b);
  if (!nA || !nB) continue;

  const dist = calculateDistanceMeters(nA.lat, nA.lng, nB.lat, nB.lng);

  if (!adj.has(e.node_a)) adj.set(e.node_a, []);
  if (!adj.has(e.node_b)) adj.set(e.node_b, []);

  adj.get(e.node_a)!.push({ target: e.node_b, weight: dist });
  adj.get(e.node_b)!.push({ target: e.node_a, weight: dist });
}

function findNearestNodeId(lng: number, lat: number): string | null {
  let nearestId: string | null = null;
  let minDist = Infinity;

  for (const n of nodes) {
    const dist = calculateDistanceMeters(lat, lng, n.lat, n.lng);
    if (dist < minDist) {
      minDist = dist;
      nearestId = n.id;
    }
  }

  return nearestId;
}

export function findCampusRoute(
  fromCoord: [number, number], // [lng, lat]
  toCoord: [number, number], // [lng, lat]
  avoidStairs = false
): NavigationRoute | null {
  const directDist = calculateDistanceMeters(fromCoord[1], fromCoord[0], toCoord[1], toCoord[0]);

  if (directDist < 10) {
    return {
      totalDistanceMeters: 0,
      estimatedDurationMinutes: 0,
      stepCount: 0,
      hasStairs: false,
      coordinates: [fromCoord, toCoord],
    };
  }

  const startNodeId = findNearestNodeId(fromCoord[0], fromCoord[1]);
  const endNodeId = findNearestNodeId(toCoord[0], toCoord[1]);

  if (!startNodeId || !endNodeId) {
    return {
      totalDistanceMeters: directDist,
      estimatedDurationMinutes: Math.max(1, Math.round(directDist / 80)),
      stepCount: Math.round(directDist / 0.75),
      hasStairs: false,
      coordinates: [fromCoord, toCoord],
    };
  }

  // Dijkstra
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  for (const n of nodes) {
    distances.set(n.id, Infinity);
    previous.set(n.id, null);
    unvisited.add(n.id);
  }

  distances.set(startNodeId, 0);

  while (unvisited.size > 0) {
    // Find min unvisited
    let currentId: string | null = null;
    let currentMin = Infinity;

    for (const id of unvisited) {
      const d = distances.get(id)!;
      if (d < currentMin) {
        currentMin = d;
        currentId = id;
      }
    }

    if (!currentId || currentMin === Infinity || currentId === endNodeId) {
      break;
    }

    unvisited.delete(currentId);

    const neighbors = adj.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor.target)) continue;

      const alt = currentMin + neighbor.weight;
      if (alt < distances.get(neighbor.target)!) {
        distances.set(neighbor.target, alt);
        previous.set(neighbor.target, currentId);
      }
    }
  }

  // Reconstruct path
  const pathNodeIds: string[] = [];
  let curr: string | null = endNodeId;

  while (curr) {
    pathNodeIds.unshift(curr);
    curr = previous.get(curr) ?? null;
  }

  const routeCoords: [number, number][] = [fromCoord];
  for (const id of pathNodeIds) {
    const n = nodeMap.get(id);
    if (n) routeCoords.push([n.lng, n.lat]);
  }
  routeCoords.push(toCoord);

  // Calculate actual distance along route
  let totalDistance = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    totalDistance += calculateDistanceMeters(
      routeCoords[i][1],
      routeCoords[i][0],
      routeCoords[i + 1][1],
      routeCoords[i + 1][0]
    );
  }

  return {
    totalDistanceMeters: totalDistance,
    estimatedDurationMinutes: Math.max(1, Math.round(totalDistance / 80)),
    stepCount: Math.round(totalDistance / 0.75),
    hasStairs: false,
    coordinates: routeCoords,
  };
}

export { findCampusRoute as findShortestCampusPath };

