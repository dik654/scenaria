import { BlockComponent } from '@blocksuite/block-std';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('scenaria-dialogue-block')
export class ScenariaDialogueBlock extends BlockComponent {
  override renderBlock() {
    return html`
      <div class="text-center text-sm leading-relaxed px-16 py-0.5">
        <rich-text
          .yText=${this.model.text}
          .undoManager=${this.doc.history}
          .readonly=${this.doc.readonly}
        ></rich-text>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenaria-dialogue-block': ScenariaDialogueBlock;
  }
}
