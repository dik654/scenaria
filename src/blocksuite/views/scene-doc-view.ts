import { BlockComponent } from '@blocksuite/block-std';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('scenaria-scene-doc')
export class ScenariaSceneDoc extends BlockComponent {
  override renderBlock() {
    return html`<div class="scenaria-doc">${this.renderChildren(this.model)}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenaria-scene-doc': ScenariaSceneDoc;
  }
}
