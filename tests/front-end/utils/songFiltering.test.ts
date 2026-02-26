import { describe, it, expect } from 'vitest';

type SortMode = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc';

interface SongLike {
  id: string;
  title: string;
  updatedAt: string;
}

function filterAndSort(songs: SongLike[], query: string, sortBy: SortMode): SongLike[] {
  let result = songs;

  if (query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(s =>
      (s.title || 'Untitled').toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  }

  result = [...result].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'date-asc':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'title-asc':
        return (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
      case 'title-desc':
        return (b.title || 'Untitled').localeCompare(a.title || 'Untitled');
      default:
        return 0;
    }
  });

  return result;
}

const songs: SongLike[] = [
  { id: 'abc', title: 'Alpha', updatedAt: '2025-01-01T00:00:00Z' },
  { id: 'def', title: 'Beta', updatedAt: '2025-06-15T00:00:00Z' },
  { id: 'ghi', title: 'Gamma', updatedAt: '2025-03-10T00:00:00Z' },
];

describe('SongBank / EditorIndex filtering logic', () => {
  it('returns all songs with no search query', () => {
    const result = filterAndSort(songs, '', 'date-desc');
    expect(result.length).toBe(3);
  });

  it('filters by title', () => {
    const result = filterAndSort(songs, 'beta', 'date-desc');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('def');
  });

  it('filters by id', () => {
    const result = filterAndSort(songs, 'ghi', 'date-desc');
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Gamma');
  });

  it('is case insensitive', () => {
    const result = filterAndSort(songs, 'ALPHA', 'date-desc');
    expect(result.length).toBe(1);
  });

  it('sorts by date desc (newest first)', () => {
    const result = filterAndSort(songs, '', 'date-desc');
    expect(result[0].id).toBe('def');
    expect(result[2].id).toBe('abc');
  });

  it('sorts by date asc (oldest first)', () => {
    const result = filterAndSort(songs, '', 'date-asc');
    expect(result[0].id).toBe('abc');
  });

  it('sorts by title asc', () => {
    const result = filterAndSort(songs, '', 'title-asc');
    expect(result[0].title).toBe('Alpha');
    expect(result[2].title).toBe('Gamma');
  });

  it('sorts by title desc', () => {
    const result = filterAndSort(songs, '', 'title-desc');
    expect(result[0].title).toBe('Gamma');
    expect(result[2].title).toBe('Alpha');
  });

  it('returns empty when no match', () => {
    const result = filterAndSort(songs, 'zzzzz', 'date-desc');
    expect(result.length).toBe(0);
  });
});
