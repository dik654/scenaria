import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { useSceneStore } from '../store/sceneStore';
import { useProjectStore } from '../store/projectStore';
import { fileIO } from '../io';

interface CausalLink {
  from: string;
  to: string;
  label?: string;
}

interface CausalLinkStore {
  links: CausalLink[];
}

interface GraphNode {
  id: string;
  number: number;
  location: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
}

export function CausalGraph({ onSceneClick }: { onSceneClick?: (id: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { index: scenes } = useSceneStore();
  const { projectRef } = useProjectStore();
  const [links, setLinks] = useState<CausalLink[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectRef) return;
    try {
      const data = await fileIO.readJSON<CausalLinkStore>(projectRef, 'story/causal_links.json');
      setLinks(data?.links ?? []);
    } catch {
      setLinks([]);
    }
  }, [projectRef]);

  const save = useCallback(async (newLinks: CausalLink[]) => {
    if (!projectRef) return;
    try {
      await fileIO.writeJSON(projectRef, 'story/causal_links.json', { links: newLinks });
    } catch { /* ignore */ }
  }, [projectRef]);

  useEffect(() => { load(); }, [load]);

  const handleNodeClick = useCallback((sceneId: string) => {
    if (!editMode) { onSceneClick?.(sceneId); return; }

    if (!pendingFrom) {
      setPendingFrom(sceneId);
      return;
    }
    if (pendingFrom === sceneId) { setPendingFrom(null); return; }

    // Toggle link
    const exists = links.find(l => l.from === pendingFrom && l.to === sceneId);
    const newLinks = exists
      ? links.filter(l => !(l.from === pendingFrom && l.to === sceneId))
      : [...links, { from: pendingFrom, to: sceneId }];
    setLinks(newLinks);
    save(newLinks);
    setPendingFrom(null);
  }, [editMode, pendingFrom, links, onSceneClick, save]);

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current || scenes.length === 0) return;
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const W = container.clientWidth;
    const H = container.clientHeight;
    svg.attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const nodes: GraphNode[] = scenes.map(s => ({
      id: s.id,
      number: s.number,
      location: s.location,
    }));
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const validLinks: GraphLink[] = links
      .filter(l => nodeMap.has(l.from) && nodeMap.has(l.to))
      .map(l => ({ source: l.from, target: l.to, label: l.label }));

    // Defs for arrowhead
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#555');

    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(validLinks as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d) => (d as GraphNode).id)
        .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius(36))
      .force('y', d3.forceY<GraphNode>()
        .y(d => (d.number / scenes.length) * (H - 80) + 40)
        .strength(0.15)
      );

    const g = svg.append('g');
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', event => g.attr('transform', event.transform))
    );

    const link = g.append('g')
      .selectAll('line')
      .data(validLinks)
      .enter().append('line')
      .attr('stroke', '#555')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)');

    const linkLabel = g.append('g')
      .selectAll('text')
      .data(validLinks.filter(l => l.label))
      .enter().append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', '#666')
      .text(l => l.label ?? '');

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on('click', (_e, d) => handleNodeClick(d.id));

    node.append('circle')
      .attr('r', 18)
      .attr('fill', d => {
        if (pendingFrom === d.id) return '#DC2626';
        const hasIncoming = validLinks.some(l => (l.target as GraphNode).id === d.id);
        const hasOutgoing = validLinks.some(l => (l.source as GraphNode).id === d.id);
        if (hasIncoming && hasOutgoing) return '#374151';
        if (hasOutgoing) return '#1E3A5F';
        if (hasIncoming) return '#14532D';
        return '#1f2937';
      })
      .attr('stroke', d => pendingFrom === d.id ? '#EF4444' : '#444')
      .attr('stroke-width', d => pendingFrom === d.id ? 2 : 1);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', 10)
      .attr('fill', '#eee')
      .text(d => `장면 ${d.number}`);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '2em')
      .attr('font-size', 9)
      .attr('fill', '#888')
      .text(d => d.location.length > 8 ? d.location.slice(0, 8) + '…' : d.location);

    node.append('title').text(d => `장면 ${d.number}. ${d.location}`);

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);
      linkLabel
        .attr('x', d => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2)
        .attr('y', d => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2 - 6);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [scenes, links, pendingFrom, handleNodeClick]);

  useEffect(() => {
    const cleanup = draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { cleanup?.(); ro.disconnect(); };
  }, [draw]);

  if (scenes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        씬을 추가하면 인과 그래프가 표시됩니다
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 flex items-center gap-2">
        <button
          onClick={() => { setEditMode(e => !e); setPendingFrom(null); }}
          className={`px-2 py-1 text-xs rounded ${editMode ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-800'}`}
        >
          {editMode ? (pendingFrom ? '→ 대상 클릭' : '출발 클릭') : '링크 편집'}
        </button>
        {editMode && (
          <span className="text-xs text-gray-600">
            씬 클릭으로 원인→결과 링크 추가/삭제
          </span>
        )}
      </div>
      <div className="absolute top-2 right-2 flex gap-2 text-xs text-gray-700">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-900 inline-block" />원인</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-900 inline-block" />결과</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-700 inline-block" />복합</span>
      </div>
    </div>
  );
}
