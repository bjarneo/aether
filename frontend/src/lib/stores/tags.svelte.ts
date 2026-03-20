// Custom wallpaper label system with persistence
// Labels are user-created with custom names and colors

export interface Label {
    id: string;
    name: string;
    color: string;
}

export const LABEL_COLORS = [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#3b82f6',
    '#a855f7',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f43f5e',
    '#64748b',
    '#ffffff',
];

let labels = $state<Label[]>([]);
let assignments = $state<Record<string, string>>({}); // path → label id

loadData();

async function loadData() {
    try {
        const {GetWallpaperTags} = await import('../../../wailsjs/go/main/App');
        const saved = await GetWallpaperTags();
        if (saved) {
            if (Array.isArray(saved.labels)) labels = saved.labels;
            if (saved.assignments && typeof saved.assignments === 'object')
                assignments = saved.assignments;
        }
    } catch {}
}

function persist() {
    import('../../../wailsjs/go/main/App')
        .then(({SaveWallpaperTags}) => {
            SaveWallpaperTags({labels, assignments});
        })
        .catch(() => {});
}

export function getLabels(): Label[] {
    return labels;
}
export function getAssignments(): Record<string, string> {
    return assignments;
}

export function createLabel(name: string, color?: string): Label {
    const c = color || LABEL_COLORS[labels.length % LABEL_COLORS.length];
    const id = Date.now().toString(36);
    const label: Label = {id, name, color: c};
    labels = [...labels, label];
    persist();
    return label;
}

export function deleteLabel(id: string): void {
    labels = labels.filter(l => l.id !== id);
    const copy = {...assignments};
    for (const [path, lid] of Object.entries(copy)) {
        if (lid === id) delete copy[path];
    }
    assignments = copy;
    persist();
}

export function getLabelForPath(path: string): Label | undefined {
    const id = assignments[path];
    if (!id) return undefined;
    return labels.find(l => l.id === id);
}

export function assignLabel(path: string, labelId: string): void {
    if (assignments[path] === labelId) {
        const copy = {...assignments};
        delete copy[path];
        assignments = copy;
    } else {
        assignments = {...assignments, [path]: labelId};
    }
    persist();
}

export function removeAssignment(path: string): void {
    const copy = {...assignments};
    delete copy[path];
    assignments = copy;
    persist();
}
