import {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  PageOrientation, convertInchesToTwip, SectionType,
} from 'docx';
import type { Scene } from '../types/scene';
import type { Character } from '../types/character';

const CM = (cm: number) => convertInchesToTwip(cm / 2.54);

function headerText(scene: Scene, number: number): string {
  const { interior, location, locationDetail, timeOfDay, timeLabel } = scene.header;
  const timeMap: Record<string, string> = {
    DAY: '낮', NIGHT: '밤', DAWN: '새벽', DUSK: '황혼', CONTINUOUS: '연속',
  };
  const intExt = interior ?? '';
  const loc = locationDetail ? `${location} / ${locationDetail}` : location;
  const time = timeMap[timeOfDay] ?? timeOfDay;
  return `S#${number}. ${intExt ? `[${intExt}] ` : ''}${loc} - ${time}${timeLabel ? ` (${timeLabel})` : ''}`;
}

function sceneToDocxParagraphs(
  scene: Scene,
  number: number,
  characters: Record<string, Character>
): Paragraph[] {
  const paras: Paragraph[] = [];

  // Scene header
  paras.push(new Paragraph({
    children: [new TextRun({ text: headerText(scene, number), bold: true, size: 22 })],
    spacing: { before: CM(0.6), after: CM(0.3) },
    border: { bottom: { color: '444444', size: 6, space: 4, style: 'single' } },
  }));

  for (const block of scene.blocks) {
    switch (block.type) {
      case 'action':
        paras.push(new Paragraph({
          children: [new TextRun({ text: block.text, size: 22 })],
          indent: { left: CM(1.5) },
          spacing: { after: CM(0.3) },
        }));
        break;

      case 'character': {
        const char = characters[block.characterId];
        const name = char ? char.name : block.characterId;
        const voice = block.voiceType !== 'normal' ? ` (${block.voiceType})` : '';
        paras.push(new Paragraph({
          children: [new TextRun({ text: name + voice, bold: true, size: 22 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: CM(0.3), after: 0 },
        }));
        break;
      }

      case 'parenthetical':
        paras.push(new Paragraph({
          children: [new TextRun({ text: `(${block.text})`, italics: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
        }));
        break;

      case 'dialogue':
        paras.push(new Paragraph({
          children: [new TextRun({ text: block.text, size: 22 })],
          indent: { left: CM(3), right: CM(3) },
          spacing: { after: CM(0.3) },
        }));
        break;

      case 'transition':
        paras.push(new Paragraph({
          children: [new TextRun({ text: block.transitionType, bold: true, size: 20 })],
          alignment: AlignmentType.RIGHT,
          spacing: { before: CM(0.3), after: CM(0.3) },
        }));
        break;
    }
  }

  return paras;
}

export async function renderScreenplayDOCX(
  scenes: { scene: Scene; number: number }[],
  title: string,
  characters: Record<string, Character>
): Promise<Blob> {
  const titlePara = new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 36 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: CM(1) },
    heading: HeadingLevel.TITLE,
  });

  const creditPara = new Paragraph({
    children: [new TextRun({ text: 'Written with Scenaria', size: 22, color: '888888' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: CM(2) },
  });

  const allParagraphs: Paragraph[] = [titlePara, creditPara];
  for (const { scene, number } of scenes) {
    allParagraphs.push(...sceneToDocxParagraphs(scene, number, characters));
  }

  const doc = new Document({
    sections: [{
      properties: {
        type: SectionType.CONTINUOUS,
        page: {
          size: { orientation: PageOrientation.PORTRAIT },
          margin: {
            top: CM(2.5), bottom: CM(2.5),
            left: CM(3.5), right: CM(2.5),
          },
        },
      },
      children: allParagraphs,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
}
