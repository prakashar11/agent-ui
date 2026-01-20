/**
 * Barnes-Hut Quadtree implementation for O(n log n) force calculation
 * Used in force-directed graph layout for efficient repulsion computation
 */

import type { Node } from '@xyflow/react';

// =============================================================================
// TYPES
// =============================================================================

// Simulation node type with physics properties
export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;  // Fixed X (null = free)
  fy: number | null;  // Fixed Y for hierarchy constraint
  mass: number;       // Higher mass = more inertia
  isSeed: boolean;    // Is this a seed node type?
  hierarchyLevel: number;
  node: Node;
}

// Quadtree node for Barnes-Hut approximation
export interface QuadTreeNode {
  x: number;           // Center of mass X
  y: number;           // Center of mass Y
  mass: number;        // Total mass in this quad
  size: number;        // Width/height of this quad
  centerX: number;     // Quad center X
  centerY: number;     // Quad center Y
  depth: number;       // Current depth in tree
  children: (QuadTreeNode | null)[];  // NW, NE, SW, SE
  bodies: SimNode[];   // Bodies in this leaf (used when max depth reached or for single body)
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Maximum depth to prevent infinite recursion with coincident nodes
export const QUADTREE_MAX_DEPTH = 20;

// =============================================================================
// QUADTREE FUNCTIONS
// =============================================================================

/**
 * Build quadtree for Barnes-Hut approximation
 */
export const buildQuadTree = (nodes: SimNode[]): QuadTreeNode | null => {
  if (nodes.length === 0) return null;
  
  // Find bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  
  // Add padding and make square (ensure minimum size to avoid division issues)
  const size = Math.max(maxX - minX, maxY - minY, 100) * 1.2 + 10;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  const root: QuadTreeNode = {
    x: 0, y: 0, mass: 0,
    size,
    centerX,
    centerY,
    depth: 0,
    children: [null, null, null, null],
    bodies: [],
  };
  
  // Insert all nodes
  for (const node of nodes) {
    insertIntoQuadTree(root, node);
  }
  
  // Calculate centers of mass
  calculateCenterOfMass(root);
  
  return root;
};

/**
 * Insert a node into the quadtree
 */
export const insertIntoQuadTree = (quad: QuadTreeNode, node: SimNode): void => {
  // Update mass
  quad.mass += node.mass;
  
  // If at max depth, just add to bodies list (handles coincident nodes)
  if (quad.depth >= QUADTREE_MAX_DEPTH) {
    quad.bodies.push(node);
    return;
  }
  
  // If empty quad (no bodies yet), place node here
  if (quad.bodies.length === 0 && !quad.children.some(c => c !== null)) {
    quad.bodies.push(node);
    return;
  }
  
  // If this is a leaf with one body, we need to subdivide
  if (quad.bodies.length === 1 && !quad.children.some(c => c !== null)) {
    const existingBody = quad.bodies[0];
    quad.bodies = [];
    
    // Re-insert existing body into appropriate child
    const existingQuadrant = getQuadrant(quad, existingBody.x, existingBody.y);
    if (!quad.children[existingQuadrant]) {
      quad.children[existingQuadrant] = createChildQuad(quad, existingQuadrant);
    }
    insertIntoQuadTree(quad.children[existingQuadrant]!, existingBody);
  }
  
  // Insert new node into appropriate quadrant
  const quadrant = getQuadrant(quad, node.x, node.y);
  if (!quad.children[quadrant]) {
    quad.children[quadrant] = createChildQuad(quad, quadrant);
  }
  insertIntoQuadTree(quad.children[quadrant]!, node);
};

/**
 * Get quadrant index: 0=NW, 1=NE, 2=SW, 3=SE
 */
export const getQuadrant = (quad: QuadTreeNode, x: number, y: number): number => {
  const isEast = x >= quad.centerX;
  const isSouth = y >= quad.centerY;
  return (isSouth ? 2 : 0) + (isEast ? 1 : 0);
};

/**
 * Create a child quadrant
 */
export const createChildQuad = (parent: QuadTreeNode, quadrant: number): QuadTreeNode => {
  const halfSize = parent.size / 2;
  const quarterSize = halfSize / 2;
  
  const offsetX = (quadrant % 2 === 1) ? quarterSize : -quarterSize;
  const offsetY = (quadrant >= 2) ? quarterSize : -quarterSize;
  
  return {
    x: 0, y: 0, mass: 0,
    size: halfSize,
    centerX: parent.centerX + offsetX,
    centerY: parent.centerY + offsetY,
    depth: parent.depth + 1,
    children: [null, null, null, null],
    bodies: [],
  };
};

/**
 * Calculate center of mass for all quads (post-order traversal)
 */
export const calculateCenterOfMass = (quad: QuadTreeNode): void => {
  // Check if this is a leaf node (has bodies, no children with content)
  const hasChildren = quad.children.some(c => c !== null);
  
  if (!hasChildren && quad.bodies.length > 0) {
    // Leaf node - calculate center of mass from all bodies
    let totalMass = 0;
    let weightedX = 0;
    let weightedY = 0;
    
    for (const body of quad.bodies) {
      totalMass += body.mass;
      weightedX += body.x * body.mass;
      weightedY += body.y * body.mass;
    }
    
    if (totalMass > 0) {
      quad.mass = totalMass;
      quad.x = weightedX / totalMass;
      quad.y = weightedY / totalMass;
    }
    return;
  }
  
  // Internal node - aggregate from children
  let totalMass = 0;
  let weightedX = 0;
  let weightedY = 0;
  
  for (const child of quad.children) {
    if (child !== null) {
      calculateCenterOfMass(child);
      totalMass += child.mass;
      weightedX += child.x * child.mass;
      weightedY += child.y * child.mass;
    }
  }
  
  if (totalMass > 0) {
    quad.mass = totalMass;
    quad.x = weightedX / totalMass;
    quad.y = weightedY / totalMass;
  }
};

/**
 * Check if a quad is a leaf (has bodies but no children)
 */
export const isLeafQuad = (quad: QuadTreeNode): boolean => {
  return quad.bodies.length > 0 && !quad.children.some(c => c !== null);
};

/**
 * Check if node is contained in this quad's bodies
 */
export const quadContainsNode = (quad: QuadTreeNode, node: SimNode): boolean => {
  return quad.bodies.some(b => b.id === node.id);
};

/**
 * Calculate repulsion force from quadtree using Barnes-Hut approximation
 */
export const calculateRepulsionFromQuadTree = (
  node: SimNode,
  quad: QuadTreeNode | null,
  theta: number,
  repulsion: number
): { fx: number; fy: number } => {
  if (quad === null || quad.mass === 0) {
    return { fx: 0, fy: 0 };
  }
  
  const dx = node.x - quad.x;
  const dy = node.y - quad.y;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq) || 0.01;
  
  // Check if this is a leaf node
  const isLeaf = isLeafQuad(quad);
  
  // If this is a leaf that contains only this node, skip self-interaction
  if (isLeaf && quad.bodies.length === 1 && quad.bodies[0].id === node.id) {
    return { fx: 0, fy: 0 };
  }
  
  // Barnes-Hut criterion: if quad is far enough OR is a leaf, treat as single mass
  if (isLeaf || (quad.size / dist) < theta) {
    // For leaves with multiple bodies (coincident nodes), we need to handle carefully
    if (isLeaf && quadContainsNode(quad, node)) {
      // Calculate force from other bodies in this leaf, excluding self
      let fx = 0, fy = 0;
      for (const body of quad.bodies) {
        if (body.id === node.id) continue;
        
        const bdx = node.x - body.x;
        const bdy = node.y - body.y;
        const bdistSq = bdx * bdx + bdy * bdy;
        const bdist = Math.sqrt(bdistSq) || 0.01;
        
        const softening = 50;
        const force = repulsion * node.mass * body.mass / (bdistSq + softening);
        fx += (bdx / bdist) * force;
        fy += (bdy / bdist) * force;
      }
      return { fx, fy };
    }
    
    // Apply repulsion force (inverse square law with softening)
    const softening = 50;  // Prevent extreme forces at close range
    const force = repulsion * node.mass * quad.mass / (distSq + softening);
    return {
      fx: (dx / dist) * force,
      fy: (dy / dist) * force,
    };
  }
  
  // Otherwise, recurse into children
  let fx = 0, fy = 0;
  for (const child of quad.children) {
    if (child !== null) {
      const childForce = calculateRepulsionFromQuadTree(node, child, theta, repulsion);
      fx += childForce.fx;
      fy += childForce.fy;
    }
  }
  
  return { fx, fy };
};
