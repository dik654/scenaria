import { BlockComponent } from '@blocksuite/block-std';
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

const markerColors: Record<string, string> = {
  foreshadowing: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  payoff: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  note: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  inconsistency: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  todo: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

@customElement('scenaria-action-block')
export class ScenariaActionBlock extends BlockComponent {
  override renderBlock() {
    const model = this.model as any;
    const markers: Array<{ type: string; label: string }> = model.markers ?? [];

    return html`
      <div class="py-1 text-sm leading-relaxed text-gray-800 dark:text-gray-200">
        <rich-text
          .yText=${this.model.text}
          .undoManager=${this.doc.history}
          .readonly=${this.doc.readonly}
        ></rich-text>
        ${markers.length > 0
          ? html`
              <div class="flex flex-wrap gap-1 mt-1">
                ${markers.map(
                  (m) => html`
                    <span
                      class="inline-block text-[10px] px-1.5 py-0.5 rounded-full ${markerColors[m.type] ?? markerColors['note']}"
                    >
                      ${m.label || m.type}
                    </span>
                  `
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenaria-action-block': ScenariaActionBlock;
  }
}
