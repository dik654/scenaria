import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { useCharacterStore } from '../store/characterStore';
import { useSceneStore } from '../store/sceneStore';

type SceneEntry = { characters?: string[] };

export function CharacterCoOccurrence() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { index: chars } = useCharacterStore();
  const { index: scenes } = useSceneStore();

  const draw = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const validChars = chars.filter(c =>
      scenes.some(s => ((s as SceneEntry).characters ?? []).includes(c.id))
    );
    if (validChars.length < 2) return;

    const W = containerRef.current.clientWidth;
    const H = containerRef.current.clientHeight;
    svg.attr('width', W).attr('height', H);

    const n = validChars.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (const scene of scenes) {
      const charList = ((scene as SceneEntry).characters ?? [])
        .map(id => validChars.findIndex(c => c.id === id))
        .filter(i => i >= 0);
      for (let i = 0; i < charList.length; i++) {
        for (let j = 0; j < charList.length; j++) {
          if (i !== j) matrix[charList[i]][charList[j]]++;
        }
      }
    }

    const outerR = Math.min(W, H) / 2 - 60;
    const innerR = outerR - 24;

    const chord = d3.chord().padAngle(0.04).sortSubgroups(d3.descending);
    const chords = chord(matrix);

    const arc = d3.arc<d3.ChordGroup>()
      .innerRadius(innerR)
      .outerRadius(outerR);

    const ribbon = d3.ribbon<d3.Chord, d3.ChordSubgroup>()
      .radius(innerR - 1);

    const g = svg.append('g')
      .attr('transform', `translate(${W / 2},${H / 2})`);

    // Groups (arcs)
    const group = g.append('g')
      .selectAll('g')
      .data(chords.groups)
      .enter().append('g');

    group.append('path')
      .attr('d', arc)
      .attr('fill', d => validChars[d.index].color)
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#111')
      .attr('stroke-width', 1);

    // Labels
    group.append('text')
      .each(d => { (d as unknown as { angle: number }).angle = (d.startAngle + d.endAngle) / 2; })
      .attr('dy', '0.35em')
      .attr('transform', d => {
        const angle = (d.startAngle + d.endAngle) / 2;
        const rot = angle * 180 / Math.PI - 90;
        const r = outerR + 10;
        return `rotate(${rot}) translate(${r},0) ${angle > Math.PI ? 'rotate(180)' : ''}`;
      })
      .attr('text-anchor', d => {
        const angle = (d.startAngle + d.endAngle) / 2;
        return angle > Math.PI ? 'end' : 'start';
      })
      .attr('font-size', 11)
      .attr('fill', '#ccc')
      .text(d => validChars[d.index].name);

    // Ticks — scene count on arc
    group.append('text')
      .each(d => { (d as unknown as { angle: number }).angle = (d.startAngle + d.endAngle) / 2; })
      .attr('transform', d => {
        const angle = (d.startAngle + d.endAngle) / 2;
        const rot = angle * 180 / Math.PI - 90;
        const r = innerR - 10;
        return `rotate(${rot}) translate(${r},0) ${angle > Math.PI ? 'rotate(180)' : ''}`;
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', '#666')
      .text(d => d.value > 0 ? d.value : '');

    // Ribbons
    const ribbonPaths = g.append('g')
      .attr('fill-opacity', 0.5)
      .selectAll('path')
      .data(chords)
      .enter().append('path')
      .attr('d', ribbon as unknown as (d: d3.Chord) => string)
      .attr('fill', d => validChars[d.source.index].color)
      .attr('stroke', '#111')
      .attr('stroke-width', 0.5);

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
      .style('opacity', '0');

    ribbonPaths
      .on('mouseover', (event, d) => {
        const a = validChars[d.source.index].name;
        const b = validChars[d.target.index].name;
        tooltip.style('opacity', '1')
          .html(`${a} ↔ ${b}<br/>함께 등장: ${d.source.value}씬`);
      })
      .on('mousemove', event => {
        tooltip
          .style('left', (event.offsetX + 12) + 'px')
          .style('top', (event.offsetY - 28) + 'px');
      })
      .on('mouseout', () => tooltip.style('opacity', '0'));
  }, [chars, scenes]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const validCount = chars.filter(c =>
    scenes.some(s => ((s as SceneEntry).characters ?? []).includes(c.id))
  ).length;

  if (validCount < 2) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        2명 이상의 캐릭터가 같은 씬에 등장하면 코드 다이어그램이 표시됩니다
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 text-xs text-gray-600">
        캐릭터 동시 등장 코드 다이어그램
      </div>
    </div>
  );
}
