import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { useCharacterStore } from '../store/characterStore';
import { useSceneStore } from '../store/sceneStore';

interface Node {
  id: string;
  name: string;
  color: string;
  dialogueCount: number;
  sceneCount: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
  coOccurrences: number;
  relationshipType?: string;
}

export function CharacterNetwork({ onCharacterClick }: { onCharacterClick?: (id: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { index: chars } = useCharacterStore();
  const { index: scenes } = useSceneStore();

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || chars.length === 0) return;
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;

    const W = container.clientWidth;
    const H = container.clientHeight;
    svg.attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    type SceneEntry = typeof scenes[0] & { characters?: string[] };

    // Build co-occurrence map
    const coOccurrenceMap = new Map<string, number>();
    const sceneCountMap = new Map<string, number>();

    for (const scene of scenes) {
      const charList = (scene as SceneEntry).characters ?? [];
      for (const cid of charList) {
        sceneCountMap.set(cid, (sceneCountMap.get(cid) ?? 0) + 1);
      }
      for (let i = 0; i < charList.length; i++) {
        for (let j = i + 1; j < charList.length; j++) {
          const key = [charList[i], charList[j]].sort().join('::');
          coOccurrenceMap.set(key, (coOccurrenceMap.get(key) ?? 0) + 1);
        }
      }
    }

    const nodes: Node[] = chars.map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      dialogueCount: 0,
      sceneCount: sceneCountMap.get(c.id) ?? 0,
    }));

    const links: Link[] = [];
    for (const [key, count] of coOccurrenceMap) {
      if (count < 1) continue;
      const [a, b] = key.split('::');
      links.push({ source: a, target: b, coOccurrences: count });
    }

    const maxCoOcc = Math.max(1, ...links.map(l => l.coOccurrences));
    const maxScenes = Math.max(1, ...nodes.map(n => n.sceneCount));

    const nodeRadius = (n: Node) => 8 + (n.sceneCount / maxScenes) * 20;

    // Simulation
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d: d3.SimulationNodeDatum) => (d as Node).id)
        .distance(l => 120 - (l as Link).coOccurrences * 5)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius((d) => nodeRadius(d as Node) + 8));

    const g = svg.append('g');

    // Zoom
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
    );

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#444')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', l => 1 + (l.coOccurrences / maxCoOcc) * 4);

    // Link labels
    const linkLabel = g.append('g')
      .selectAll('text')
      .data(links.filter(l => l.coOccurrences > 2))
      .enter().append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', '#666')
      .text(l => l.coOccurrences + '씬');

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      )
      .on('click', (_event, d) => onCharacterClick?.(d.id));

    node.append('circle')
      .attr('r', d => nodeRadius(d))
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.3);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => nodeRadius(d) + 12)
      .attr('font-size', 11)
      .attr('fill', '#ddd')
      .text(d => d.name);

    node.append('title').text(d => `${d.name}\n등장: ${d.sceneCount}씬`);

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as Node).x!)
        .attr('y1', d => (d.source as Node).y!)
        .attr('x2', d => (d.target as Node).x!)
        .attr('y2', d => (d.target as Node).y!);

      linkLabel
        .attr('x', d => ((d.source as Node).x! + (d.target as Node).x!) / 2)
        .attr('y', d => ((d.source as Node).y! + (d.target as Node).y!) / 2 - 4);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [chars, scenes, onCharacterClick]);

  useEffect(() => {
    const cleanup = draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { cleanup?.(); ro.disconnect(); };
  }, [draw]);

  if (chars.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        캐릭터를 추가하면 관계 네트워크가 표시됩니다
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 text-xs text-gray-600">
        드래그로 이동 · 스크롤로 확대/축소
      </div>
    </div>
  );
}
