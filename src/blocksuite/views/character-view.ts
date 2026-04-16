import { BlockComponent } from '@blocksuite/block-std';
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('scenaria-character-block')
export class ScenariaCharacterBlock extends BlockComponent {
  override renderBlock() {
    const model = this.model as any;
    const characterId: string = model.characterId || '';
    const voiceType: string = model.voiceType || 'normal';

    return html`
      <div class="text-center py-1">
        <span class="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
          ${characterId}
        </span>
        ${voiceType !== 'normal'
          ? html`<span class="ml-1 text-[10px] text-gray-400">(${voiceType})</span>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenaria-character-block': ScenariaCharacterBlock;
  }
}
