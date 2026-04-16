import { BlockComponent } from '@blocksuite/block-std';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('scenaria-scene-header')
export class ScenariaSceneHeader extends BlockComponent {
  override renderBlock() {
    const model = this.model as any;
    const interior = model.interior;
    const location = model.location || '';
    const timeOfDay = model.timeOfDay || 'DAY';

    // Scene number derived from block position (1-based)
    const parent = this.model.doc.getParent(this.model.id);
    const siblings = parent
      ? parent.children.filter(
          (child: any) => child.flavour === 'scenaria:scene-header'
        )
      : [];
    const sceneNumber = siblings.indexOf(this.model) + 1;

    const intExt = interior === 'INT' ? 'INT' : interior === 'EXT' ? 'EXT' : interior || '';

    return html`
      <div class="text-sm font-bold uppercase tracking-wide text-gray-400 py-3 border-b border-gray-200 dark:border-gray-800 mb-4">
        S#${sceneNumber}. ${intExt}. ${location} - ${timeOfDay}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenaria-scene-header': ScenariaSceneHeader;
  }
}
