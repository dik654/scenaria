import { BlockComponent } from '@blocksuite/block-std';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('scenaria-transition-block')
export class ScenariaTransitionBlock extends BlockComponent {
  override renderBlock() {
    const model = this.model as any;
    const transitionType: string = model.transitionType || '컷';

    return html`
      <div class="text-right text-xs uppercase tracking-wide text-gray-500 py-2">
        ${transitionType}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenaria-transition-block': ScenariaTransitionBlock;
  }
}
