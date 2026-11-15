import { UiTree } from './ui-tree.types';

/** A baseline the index keeps a tree for: the variation and the name of its tree file. */
export interface IndexedBaseline {
  variationId: string;
  treeName: string;
}

// Projects kept in memory at once; a big Android project holds ~6000 trees (ADR-0029).
export const MAX_INDEXED_PROJECTS = 8;
// Tree files read at once while an index fills; the disk, not the CPU, is the limit.
export const INDEX_CONCURRENCY = 4;

async function eachWithConcurrency<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * The UI trees of the latest baselines of each project, in memory (ADR-0029). A search hands it
 * the baselines as the database has them now; only trees whose file name changed (a new
 * approve) are read again, so an index never answers from an outdated baseline.
 */
export class ScreenSearchIndex {
  // insertion order is use order: the first project is the one used longest ago
  private readonly projects = new Map<string, Map<string, { treeName: string; tree: UiTree }>>();

  constructor(
    private readonly load: (name: string) => Promise<UiTree | null>,
    private readonly maxProjects = MAX_INDEXED_PROJECTS
  ) {}

  async treesFor(projectId: string, baselines: IndexedBaseline[]): Promise<Map<string, UiTree>> {
    const index = this.projects.get(projectId) ?? new Map<string, { treeName: string; tree: UiTree }>();
    this.projects.delete(projectId);
    this.projects.set(projectId, index);
    while (this.projects.size > this.maxProjects) this.projects.delete(this.projects.keys().next().value);

    const wanted = new Set(baselines.map((baseline) => baseline.variationId));
    for (const variationId of [...index.keys()]) if (!wanted.has(variationId)) index.delete(variationId);
    const stale = baselines.filter((baseline) => index.get(baseline.variationId)?.treeName !== baseline.treeName);
    await eachWithConcurrency(stale, INDEX_CONCURRENCY, async (baseline) => {
      const tree = await this.load(baseline.treeName);
      if (tree) index.set(baseline.variationId, { treeName: baseline.treeName, tree });
      else index.delete(baseline.variationId);
    });

    const trees = new Map<string, UiTree>();
    for (const baseline of baselines) {
      const entry = index.get(baseline.variationId);
      if (entry) trees.set(baseline.variationId, entry.tree);
    }
    return trees;
  }

  has(projectId: string): boolean {
    return this.projects.has(projectId);
  }
}
