import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { useSceneStore } from '../store/sceneStore';
import type { SceneIndexEntry } from '../types/scene';

const MARGIN = { top: 16, right: 24, bottom: 32, left: 32 };

interface TensionPoint {
  sceneIndex: number;
  sceneId: string;
  number: number;
  location: string;
  tension: number;
}

export function TensionFlow({ onSceneClick }: { onSceneClick?: (sceneId: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { index: scenes, currentSceneId } = useSceneStore();

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    if (!svg || !container || scenes.length === 0) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    svg.attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const innerW = W - MARGIN.left - MARGIN.right;
    const innerH = H - MARGIN.top - MARGIN.bottom;

    const data: TensionPoint[] = scenes.map((s, i) => ({
      sceneIndex: i,
      sceneId: s.id,
      number: s.number,
      location: s.location,
      tension: s.tensionLevel ?? 5,
    }));

    const xScale = d3.scaleLinear()
      .domain([0, Math.max(1, scenes.length - 1)])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([0, 10])
      .range([innerH, 0]);

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Act bands
    const actColors = ['#1a1a2e', '#16213e', '#0f3460', '#1a1a2e'];
    const actBoundaries = [0, 0.25, 0.5, 0.75, 1.0];
    for (let i = 0; i < 4; i++) {
      const x0 = xScale(actBoundaries[i] * (scenes.length - 1));
      const x1 = xScale(actBoundaries[i + 1] * (scenes.length - 1));
      g.append('rect')
        .attr('x', x0).attr('y', 0)
        .attr('width', x1 - x0).attr('height', innerH)
        .attr('fill', actColors[i])
        .attr('opacity', 0.4);
    }

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3.axisLeft(yScale)
          .tickSize(-innerW)
          .tickValues([2, 4, 6, 8, 10])
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#333')
      .attr('stroke-dasharray', '2,4');

    // Area fill
    const area = d3.area<TensionPoint>()
      .x(d => xScale(d.sceneIndex))
      .y0(innerH)
      .y1(d => yScale(d.tension))
      .curve(d3.curveCatmullRom.alpha(0.5));

    g.append('path')
      .datum(data)
      .attr('fill', 'url(#tensionGradient)')
      .attr('d', area);

    // Gradient
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient')
      .attr('id', 'tensionGradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', 0).attr('y2', innerH);
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#DC2626').attr('stop-opacity', 0.4);
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#DC2626').attr('stop-opacity', 0.0);

    // Line
    const line = d3.line<TensionPoint>()
      .x(d => xScale(d.sceneIndex))
      .y(d => yScale(d.tension))
      .curve(d3.curveCatmullRom.alpha(0.5));

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#DC2626')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Dots
    const dots = g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.sceneIndex))
      .attr('cy', d => yScale(d.tension))
      .attr('r', d => d.sceneId === currentSceneId ? 5 : 3)
      .attr('fill', d => d.sceneId === currentSceneId ? '#DC2626' : '#555')
      .attr('stroke', d => d.sceneId === currentSceneId ? '#fff' : 'none')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => onSceneClick?.(d.sceneId));

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .append('div')
      .style('position', 'absolute')
      .style('background', '#1a1a1a')
      .style('border', '1px solid #333')
      .style('border-radius', '6px')
      .style('padding', '4px 8px')
      .style('font-size', '11px')
      .style('color', '#ddd')
      .style('pointer-events', 'none')
      .style('opacity', '0')
      .style('transition', 'opacity 0.1s');

    dots
      .on('mouseover', (event, d) => {
        tooltip.style('opacity', '1')
          .html(`<strong>S#${d.number}</strong><br/>${d.location}<br/>긴장도: ${d.tension}`);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.offsetX + 12) + 'px')
          .style('top', (event.offsetY - 28) + 'px');
      })
      .on('mouseout', () => tooltip.style('opacity', '0'));

    // X axis — scene numbers
    const xAxis = d3.axisBottom(xScale)
      .tickValues(data.filter((_, i) => i % Math.max(1, Math.floor(scenes.length / 10)) === 0).map(d => d.sceneIndex))
      .tickFormat(i => `S#${scenes[i as number]?.number ?? ''}`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#666')
      .attr('font-size', 10);

    g.selectAll('.domain, .tick line').attr('stroke', '#333');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll('text')
      .attr('fill', '#666')
      .attr('font-size', 10);
  }, [scenes, currentSceneId, onSceneClick]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  if (scenes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        씬을 추가하면 긴장도 그래프가 표시됩니다
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
