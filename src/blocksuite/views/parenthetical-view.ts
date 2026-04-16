import { BlockComponent } from '@blocksuite/block-std';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('scenaria-parenthetical-block')
export class ScenariaParentheticalBlock extends BlockComponent {
  override renderBlock() {
    return html`
      <div class="text-center text-xs italic text-gray-500 dark:text-gray-400 py-0.5">
        (<rich-text
          .yText=${this.model.text}
          .undoManager=${this.doc.history}
          .readonly=${this.doc.readonly}
        ></rich-text>)
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenaria-parenthetical-block': ScenariaParentheticalBlock;
  }
}
