import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { useSceneStore } from '../store/sceneStore';

const STRUCTURE_BEATS = [
  { name: '사건 발생', position: 0.10, icon: '⚡', color: '#DC2626' },
  { name: '1막 전환점', position: 0.25, icon: '↗', color: '#EA580C' },
  { name: '중간 전환점', position: 0.50, icon: '⟳', color: '#D97706' },
  { name: '위기', position: 0.75, icon: '⬇', color: '#7C3AED' },
  { name: '클라이맥스', position: 0.90, icon: '★', color: '#DC2626' },
];

const ACT_COLORS = ['#1a1a2e33', '#16213e33', '#0f346033', '#1a1a2e33'];

export function StoryClock() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { index: scenes, currentSceneId } = useSceneStore();
  const [hoveredScene, setHoveredScene] = useState<string | null>(null);

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    if (!svg || !container) return;

    const size = Math.min(container.clientWidth, container.clientHeight);
    const CX = size / 2;
    const CY = size / 2;
    const R = (size / 2) * 0.85;

    svg.attr('width', size).attr('height', size);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${CX},${CY})`);

    // Position: 12 o'clock = start (top), clockwise = progress
    const angleFromPosition = (pos: number) => (pos * 2 * Math.PI) - Math.PI / 2;

    // Act arcs
    const arcBoundaries = [0, 0.25, 0.5, 0.75, 1.0];
    for (let i = 0; i < 4; i++) {
      const a0 = angleFromPosition(arcBoundaries[i]);
      const a1 = angleFromPosition(arcBoundaries[i + 1]);
      const arcGen = d3.arc()
        .innerRadius(R * 0.55)
        .outerRadius(R * 0.95)
        .startAngle(a0)
        .endAngle(a1);

      g.append('path')
        .attr('d', arcGen({} as d3.DefaultArcObject))
        .attr('fill', ACT_COLORS[i])
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5);
    }

    // Concentric circles
    [0.55, 0.7, 0.85, 0.95].forEach(r => {
      g.append('circle').attr('r', R * r)
        .attr('fill', 'none').attr('stroke', '#2a2a2a').attr('stroke-width', 0.5);
    });

    // Time markers (hours 1-12)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
      const x = Math.cos(angle) * R * 0.98;
      const y = Math.sin(angle) * R * 0.98;
      g.append('text')
        .attr('x', x).attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 10)
        .attr('fill', '#444')
        .text(i === 0 ? '12' : String(i));
    }

    // Act labels
    const actLabels = ['1막', '2막 前', '2막 後', '3막'];
    const actMids = [0.125, 0.375, 0.625, 0.875];
    actMids.forEach((mid, i) => {
      const angle = angleFromPosition(mid);
      const x = Math.cos(angle) * R * 0.75;
      const y = Math.sin(angle) * R * 0.75;
      g.append('text')
        .attr('x', x).attr('y', y)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('font-size', 10).attr('fill', '#555')
        .text(actLabels[i]);
    });

    // Structure beat markers
    STRUCTURE_BEATS.forEach(beat => {
      const angle = angleFromPosition(beat.position);
      const x = Math.cos(angle) * R * 0.93;
      const y = Math.sin(angle) * R * 0.93;
      g.append('circle')
        .attr('cx', x).attr('cy', y).attr('r', 5)
        .attr('fill', beat.color).attr('stroke', '#fff').attr('stroke-width', 1);

      g.append('text')
        .attr('x', Math.cos(angle) * (R * 0.93 + 14))
        .attr('y', Math.sin(angle) * (R * 0.93 + 14))
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('font-size', 8).attr('fill', '#777')
        .text(beat.name);
    });

    // Scene dots
    if (scenes.length > 0) {
      scenes.forEach((scene, i) => {
        const pos = scenes.length > 1 ? i / (scenes.length - 1) : 0;
        const angle = angleFromPosition(pos);
        const isActive = scene.id === currentSceneId;
        const isHovered = scene.id === hoveredScene;
        const r = R * (0.58 + (isActive || isHovered ? 0.02 : 0));

        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        g.append('circle')
          .attr('cx', x).attr('cy', y)
          .attr('r', isActive ? 5 : 3)
          .attr('fill', isActive ? '#DC2626' : scene.hasConsistencyIssue ? '#EF4444' : '#555')
          .attr('stroke', isActive ? '#fff' : 'none')
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer')
          .on('mouseover', function() { setHoveredScene(scene.id); })
          .on('mouseout', function() { setHoveredScene(null); })
          .append('title')
          .text(`장면 ${scene.number}: ${scene.location}`);
      });

      // Progress arc (thin line from start to current)
      if (currentSceneId) {
        const currentIdx = scenes.findIndex(s => s.id === currentSceneId);
        if (currentIdx >= 0) {
          const progress = scenes.length > 1 ? currentIdx / (scenes.length - 1) : 0;
          const arcGen = d3.arc()
            .innerRadius(R * 0.57)
            .outerRadius(R * 0.59)
            .startAngle(angleFromPosition(0))
            .endAngle(angleFromPosition(progress));

          g.append('path')
            .attr('d', arcGen({} as d3.DefaultArcObject))
            .attr('fill', '#DC2626')
            .attr('opacity', 0.7);
        }
      }
    }

    // Center info
    g.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-size', 12).attr('fill', '#666')
      .text(`${scenes.length}씬`);

  }, [scenes, currentSceneId, hoveredScene]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  if (scenes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        씬을 추가하면 스토리클록이 표시됩니다
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex items-center justify-center w-full h-full">
      <svg ref={svgRef} />
    </div>
  );
}
