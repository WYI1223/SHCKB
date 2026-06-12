/**
 * The settings panel (MVP-8 M8-D2) — the admin back office moved off the
 * rack's foot into a modal on the shared overlay anatomy: instance
 * theme, theme studio, export/import, blob GC. Official chrome keeps it
 * a modal (no dedicated route); a UI plugin may replace the form factor
 * entirely — the contract is the entry point and the capabilities, not
 * the shape [M8-D2].
 */
import { useRef } from 'react';
import { THEMES } from '@skb/theme';
import { ApiError, api, importBundle } from '../api/client';
import { BENCH, SectionLabel, benchButtonStyle, benchSelectStyle } from '../chrome/bench';
import { Modal, useOverlays } from '../chrome/overlays';
import { useShell } from './Shell';
import { ThemeStudio } from './ThemeStudio';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { instanceTheme, customizations, refresh } = useShell();
  const overlays = useOverlays();
  const importInput = useRef<HTMLInputElement>(null);

  async function switchTheme(next: string) {
    const ok = await overlays.confirm({
      title: 'switch theme',
      message: 'Switch instance theme? All published pages re-render.',
      confirmLabel: 'switch',
    });
    if (!ok) return;
    await api.setInstanceTheme(next);
    refresh();
  }

  async function importZip(file: File) {
    try {
      const { counts } = await importBundle(file);
      refresh();
      await overlays.alert({
        title: 'import complete',
        message: `${counts.pages} pages, ${counts.folders} folders, ${counts.blocks} blocks, ${counts.blobs} blobs.`,
      });
    } catch (err) {
      const detail = err instanceof ApiError && err.details ? `\n\n${err.details.join('\n')}` : '';
      await overlays.alert({
        title: 'import failed',
        message: `${err instanceof Error ? err.message : String(err)}${detail}`,
      });
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  }

  async function runGc() {
    const ok = await overlays.confirm({
      title: 'blob gc',
      message: 'Sweep unreferenced blobs from the store?',
      confirmLabel: 'sweep',
    });
    if (!ok) return;
    const { deleted, freedBytes } = await api.gcBlobs();
    await overlays.alert({
      title: 'blob gc',
      message: `Removed ${deleted} blob${deleted === 1 ? '' : 's'}, freed ${formatBytes(freedBytes)}.`,
    });
  }

  return (
    <Modal title="settings · back office" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <section>
          <SectionLabel>Instance theme</SectionLabel>
          <select
            value={instanceTheme}
            onChange={(e) => {
              const next = e.target.value;
              e.target.value = instanceTheme; // confirm decides; refresh repaints
              void switchTheme(next);
            }}
            aria-label="Instance theme"
            style={benchSelectStyle({ width: '100%' })}
          >
            {Object.values(THEMES).map((t) => (
              <option key={t.id} value={t.id}>
                theme · {t.name}
              </option>
            ))}
          </select>
          <div style={{ marginTop: '8px' }}>
            <ThemeStudio themeId={instanceTheme} customizations={customizations} refresh={refresh} />
          </div>
        </section>

        <section>
          <SectionLabel>Data</SectionLabel>
          <div style={{ display: 'flex', gap: '5px' }}>
            <a
              href="/api/admin/export"
              download="shckb-export.zip"
              title="Download a full logical export (git-friendly zip)"
              className="pu-hoverable"
              style={{ ...benchButtonStyle(), flex: 1, textAlign: 'center', textDecoration: 'none' }}
            >
              export
            </a>
            <button
              onClick={() => importInput.current?.click()}
              title="Restore a full export into this instance (empty instance only)"
              className="pu-hoverable"
              style={{ ...benchButtonStyle(), flex: 1 }}
            >
              import
            </button>
            <button
              onClick={() => void runGc()}
              title="Delete blobs no page references any more"
              className="pu-hoverable"
              style={{ ...benchButtonStyle(), flex: 1 }}
            >
              blob gc
            </button>
          </div>
          <input
            ref={importInput}
            type="file"
            accept=".zip,application/zip"
            aria-label="Import bundle file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importZip(file);
            }}
          />
          <p style={{ margin: '8px 0 0', fontSize: '11px', color: BENCH.inkFaint, fontStyle: 'italic' }}>
            Export is the migration path: export, reinstall, import.
          </p>
        </section>
      </div>
    </Modal>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
