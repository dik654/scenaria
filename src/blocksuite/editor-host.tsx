import { useEffect, useRef } from 'react';
import type { Doc } from '@blocksuite/store';
import {
  BlockStdScope,
  type EditorHost,
} from '@blocksuite/block-std';
import { effects as blockStdEffects } from '@blocksuite/block-std/effects';
import { effects as richTextEffects } from '@blocksuite/affine-components/rich-text';
import { scenariaExtensions, scenariaSchemas } from './extensions';

// Register the built-in custom elements (editor-host, rich-text, etc.)
// These are idempotent -- safe to call multiple times.
blockStdEffects();
richTextEffects();

interface BlockSuiteEditorProps {
  doc: Doc | null;
  readonly?: boolean;
  onDirty?: () => void;
}

export function BlockSuiteEditor({
  doc,
  readonly,
  onDirty,
}: BlockSuiteEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !doc) return;

    // Apply readonly setting
    (doc as any).readonly = readonly ?? false;

    // Register schemas on the collection (idempotent -- BlockSuite deduplicates)
    const collection = doc.collection;
    collection.schema.register(scenariaSchemas);

    // Create the BlockStdScope which wires up DI, extensions, and the host
    const std = new BlockStdScope({
      doc,
      extensions: scenariaExtensions,
    });

    // Render the EditorHost element and mount it
    const editorHost: EditorHost = std.render();
    container.appendChild(editorHost);
    std.mount();

    // Dirty tracking via blockUpdated slot
    let unsubDirty: (() => void) | undefined;
    if (onDirty) {
      const disposable = doc.slots.blockUpdated.on(() => {
        onDirty();
      });
      unsubDirty = () => disposable.dispose();
    }

    // Cleanup on unmount
    return () => {
      unsubDirty?.();
      std.unmount();
      editorHost.remove();
    };
  }, [doc, readonly, onDirty]);

  return <div ref={containerRef} className="flex-1 overflow-y-auto" />;
}
