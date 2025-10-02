import { useMemo, useState } from "react";

export type MemberOption = {
    id: string;
    label: string;
    subtitle?: string;
};

export type MemberSelectorProps = {
    options: MemberOption[];
    selectedIds: string[];
    onChange: (next: string[]) => void;
    availableTitle?: string;
    selectedTitle?: string;
    searchPlaceholder?: string;
    emptyAvailableLabel?: string;
    emptySelectedLabel?: string;
};

function formatFallback(id: string) {
    const segments = id.split(/[#/]/).filter(Boolean);
    return segments.pop() ?? id;
}

const normalize = (value: string) => value.trim().toLowerCase();

export function MemberSelector({
    options,
    selectedIds,
    onChange,
    availableTitle = "Disponibles",
    selectedTitle = "Sélectionnés",
    searchPlaceholder = "Rechercher un utilisateur…",
    emptyAvailableLabel = "Aucun résultat",
    emptySelectedLabel = "Aucun membre sélectionné",
}: MemberSelectorProps) {
    const [query, setQuery] = useState("");
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<"available" | "selected" | null>(null);

    const optionsMap = useMemo(() => {
        const map = new Map<string, MemberOption>();
        options.forEach((option) => map.set(option.id, option));
        return map;
    }, [options]);

    const available = useMemo(() => {
        const base = options.filter((option) => !selectedIds.includes(option.id));
        const q = normalize(query);
        if (!q) return base;
        return base.filter((option) => {
            const haystacks = [option.label, option.subtitle, option.id].filter(Boolean) as string[];
            return haystacks.some((value) => normalize(value).includes(q));
        });
    }, [options, selectedIds, query]);

    const selected = useMemo(() => {
        return selectedIds.map((id) => optionsMap.get(id) ?? { id, label: formatFallback(id) });
    }, [selectedIds, optionsMap]);

    const add = (id: string) => {
        if (!id || selectedIds.includes(id)) return;
        onChange([...selectedIds, id]);
    };

    const remove = (id: string) => {
        if (!selectedIds.includes(id)) return;
        onChange(selectedIds.filter((value) => value !== id));
    };

    const handleDrop = (target: "available" | "selected") => (
        event: React.DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault();
        setDropTarget(null);
        const data = event.dataTransfer.getData("text/plain") || draggedId;
        setDraggedId(null);
        if (!data) return;
        if (target === "selected") {
            add(data);
        } else {
            remove(data);
        }
    };

    const handleDragOver = (target: "available" | "selected") => (
        event: React.DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault();
        if (dropTarget !== target) {
            setDropTarget(target);
        }
        event.dataTransfer.dropEffect = "move";
    };

    const handleDragLeave = () => {
        setDropTarget(null);
    };

    const renderOption = (option: MemberOption, isSelected: boolean, action: () => void) => (
        <article
            key={option.id}
            className={`member-selector__item${isSelected ? " is-selected" : ""}`}
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", option.id);
                event.dataTransfer.effectAllowed = "move";
                setDraggedId(option.id);
            }}
            onDoubleClick={action}
        >
            <div className="member-selector__item-main">
                <span className="member-selector__item-label">{option.label}</span>
                {option.subtitle && (
                    <span className="member-selector__item-subtitle">{option.subtitle}</span>
                )}
            </div>
            <button
                type="button"
                className="member-selector__action"
                onClick={action}
                aria-label={isSelected ? `Retirer ${option.label}` : `Ajouter ${option.label}`}
            >
                <i className={`fas fa-${isSelected ? "times" : "chevron-right"}`} aria-hidden="true" />
            </button>
        </article>
    );

    return (
        <div className="member-selector">
            <div className="member-selector__panel">
                <header className="member-selector__panel-header">
                    <div>
                        <h4>{availableTitle}</h4>
                        <p>{available.length} résultats</p>
                    </div>
                </header>
                <div className="member-selector__search">
                    <i className="fas fa-search" aria-hidden="true" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={searchPlaceholder}
                    />
                </div>
                <div
                    className={`member-selector__list${
                        dropTarget === "available" ? " is-dropping" : ""
                    }`}
                    onDragOver={handleDragOver("available")}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop("available")}
                >
                    {available.length === 0 && (
                        <p className="member-selector__empty">{emptyAvailableLabel}</p>
                    )}
                    {available.map((option) => renderOption(option, false, () => add(option.id)))}
                </div>
            </div>

            <div className="member-selector__panel">
                <header className="member-selector__panel-header">
                    <div>
                        <h4>{selectedTitle}</h4>
                        <p>{selected.length} sélectionnés</p>
                    </div>
                </header>
                <div
                    className={`member-selector__list${
                        dropTarget === "selected" ? " is-dropping" : ""
                    }`}
                    onDragOver={handleDragOver("selected")}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop("selected")}
                >
                    {selected.length === 0 && (
                        <p className="member-selector__empty">{emptySelectedLabel}</p>
                    )}
                    {selected.map((option) => renderOption(option, true, () => remove(option.id)))}
                </div>
            </div>
        </div>
    );
}

export default MemberSelector;
