import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataSet, Network } from "vis-network/standalone";

type OntologyGraphProps = {
	graph: { nodes: any[]; edges: any[] };
	onClassHover: (id: string | null) => void;
	onClassClick: (id: string) => void;
    onReady?: () => void;
	selectedNodeId?: string | null;
	highlightNodeId?: string | null;
    focusKey?: number;
};

type ThemeMode = "light" | "dark";

const resolveTheme = (): ThemeMode => {
	if (typeof window === "undefined") return "light";
	const root = window.document.documentElement;
	const datasetTheme = root.dataset.theme;
	if (datasetTheme === "dark" || datasetTheme === "light") return datasetTheme;
	if (root.classList.contains("dark")) return "dark";
	if (root.classList.contains("light")) return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const buildPalette = (mode: ThemeMode) => {
	if (mode === "dark") {
		return {
			node: {
				background: "#facc15",
				border: "#eab308",
				highlightBackground: "#fde047",
				highlightBorder: "#facc15",
				hoverBackground: "#fde047",
				hoverBorder: "#facc15",
				fontColor: "#111827",
			},
			edge: {
				default: "#94a3b8",
				highlight: "#cbd5f5",
			},
		};
	}

	return {
		node: {
			background: "#facc15",
			border: "#eab308",
			highlightBackground: "#fde047",
			highlightBorder: "#eab308",
			hoverBackground: "#fde047",
			hoverBorder: "#eab308",
			fontColor: "#000000",
		},
		edge: {
			default: "#9ca3af",
			highlight: "#6366f1",
		},
	};
};

const OntologyGraph: React.FC<OntologyGraphProps> = ({
	graph,
	onClassHover,
	onClassClick,
    onReady,
	selectedNodeId,
	highlightNodeId,
    focusKey,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const networkRef = useRef<Network | null>(null);
	const hoverCb = useRef(onClassHover);
	const clickCb = useRef(onClassClick);
	const readyCb = useRef(onReady);
	const stabilizedRef = useRef(false);
	const focusFrameRef = useRef<number | null>(null);
	const selectedNodeRef = useRef<string | null>(selectedNodeId ?? null);
	const paletteRef = useRef(buildPalette(resolveTheme()));

	useEffect(() => {
		hoverCb.current = onClassHover;
		clickCb.current = onClassClick;
		readyCb.current = onReady;
	}, [onClassHover, onClassClick, onReady]);

	useEffect(() => {
		selectedNodeRef.current = selectedNodeId ?? null;
	}, [selectedNodeId]);

	const [theme, setTheme] = useState<ThemeMode>(() => resolveTheme());

	useEffect(() => {
		if (typeof window === "undefined") return;
		const root = window.document.documentElement;
		const applyTheme = () => {
			const next = resolveTheme();
			setTheme((prev) => (prev === next ? prev : next));
		};

		applyTheme();
		const observer = new MutationObserver(applyTheme);
		observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const mediaListener = () => applyTheme();
		if (typeof media.addEventListener === "function") {
			media.addEventListener("change", mediaListener);
		} else {
			media.addListener(mediaListener);
		}

		return () => {
			observer.disconnect();
			if (typeof media.removeEventListener === "function") {
				media.removeEventListener("change", mediaListener);
			} else {
				media.removeListener(mediaListener);
			}
		};
	}, []);

	const palette = useMemo(() => buildPalette(theme), [theme]);

	useEffect(() => {
		paletteRef.current = palette;
		const net = networkRef.current;
		if (!net) return;
		net.setOptions({
			nodes: {
				color: {
					background: palette.node.background,
					border: palette.node.border,
					highlight: {
						background: palette.node.highlightBackground,
						border: palette.node.highlightBorder,
					},
					hover: {
						background: palette.node.hoverBackground,
						border: palette.node.hoverBorder,
					},
				},
				font: {
					color: palette.node.fontColor,
				},
			},
			edges: {
				color: {
					color: palette.edge.default,
					highlight: palette.edge.highlight,
					hover: palette.edge.highlight,
				},
			},
		});
	}, [palette]);

	const requestFocus = useCallback((nodeId: string) => {
		const network = networkRef.current;
		if (!network) return;

		if (focusFrameRef.current !== null) {
			window.cancelAnimationFrame(focusFrameRef.current);
			focusFrameRef.current = null;
		}

		focusFrameRef.current = window.requestAnimationFrame(() => {
			focusFrameRef.current = null;
			try {
				network.fit({
					nodes: [nodeId],
					animation: { duration: 500, easingFunction: "easeInOutQuad" },
				});
			} catch {
				try {
					network.focus(nodeId, {
						scale: 0.8,
						animation: { duration: 500, easingFunction: "easeInOutQuad" },
					});
				} catch {
					// ignore focus errors when node is unavailable
				}
			}
		});
	}, []);

	useEffect(() => {
		const { nodes: rawNodes, edges: rawEdges } = graph;
		const nodes = new DataSet(rawNodes);
		const edges = new DataSet(rawEdges);
		const palette = paletteRef.current;

		const classIds = new Set(rawNodes.map((n: any) => n.id));

		stabilizedRef.current = false;

		const network = new Network(
			containerRef.current!,
			{ nodes, edges },
			{
				nodes: {
					shape: "box",
					font: { size: 20, color: palette.node.fontColor, face: "Inter" },
					color: {
						background: palette.node.background,
						border: palette.node.border,
						highlight: {
							background: palette.node.highlightBackground,
							border: palette.node.highlightBorder,
						},
						hover: {
							background: palette.node.hoverBackground,
							border: palette.node.hoverBorder,
						},
					},
				},
				edges: {
					arrows: { to: { enabled: true, scaleFactor: 0.5 } },
					color: {
						color: palette.edge.default,
						highlight: palette.edge.highlight,
						hover: palette.edge.highlight,
					},
				},
				layout: { improvedLayout: true },
				physics: {
					enabled: true,
					stabilization: { iterations: 500 },
				},
				interaction: {
					hover: true,
					tooltipDelay: 200,
					dragView: true,
					zoomView: true,
					dragNodes: false,
				},
				autoResize: true,
				height: "100%",
				width: "100%",
			}
		);
		networkRef.current = network;

		const markReady = () => {
			if (stabilizedRef.current) return;
			stabilizedRef.current = true;
			network.setOptions({ physics: { enabled: false } });
			const target = selectedNodeRef.current;
			if (target) requestFocus(target);
			readyCb.current?.();
		};

		network.once("stabilized", markReady);
		network.once("afterDrawing", markReady);

		// --- class hover events ---
		network.on("hoverNode", (params) => {
			const id = params.node as string;
			if (classIds.has(id)) hoverCb.current(id);
		});
		network.on("blurNode", () => hoverCb.current(null));

		// --- click events ---
		network.on("click", (params) => {
			if (params.nodes.length) {
				const id = params.nodes[0] as string;
				if (classIds.has(id)) clickCb.current(id);
			}
		});

		// --- ResizeObserver ---
		const observer = new ResizeObserver(() => {
			const net = networkRef.current;
			if (net && containerRef.current) {
				net.setSize("100%", "100%");
				net.redraw();
			}
		});
		if (containerRef.current?.parentElement)
			observer.observe(containerRef.current.parentElement);

		return () => {
			observer.disconnect();
			stabilizedRef.current = false;
			if (focusFrameRef.current !== null) {
				window.cancelAnimationFrame(focusFrameRef.current);
				focusFrameRef.current = null;
			}
			networkRef.current?.destroy();
		};
	}, [graph, requestFocus]);

	useEffect(() => {
		const net = networkRef.current;
		if (!net) return;

		const highlightTarget = highlightNodeId ?? selectedNodeId;
		if (!highlightTarget) {
			net.unselectAll();
			return;
		}

		try {
			net.selectNodes([highlightTarget], true);
		} catch {
			// ignore selection errors when node not yet present
		}
	}, [highlightNodeId, selectedNodeId]);

	useEffect(() => {
		if (!selectedNodeId) {
			selectedNodeRef.current = null;
			return undefined;
		}

		selectedNodeRef.current = selectedNodeId;
		const network = networkRef.current;
		if (!network) return;

		try {
			network.selectNodes([selectedNodeId], true);
		} catch {
			// ignore selection errors
		}

		if (!stabilizedRef.current) return;

		requestFocus(selectedNodeId);

		return () => {
			if (focusFrameRef.current !== null) {
				window.cancelAnimationFrame(focusFrameRef.current);
				focusFrameRef.current = null;
			}
		};
	}, [selectedNodeId, focusKey, requestFocus, graph]);

	return <div ref={containerRef} className="border rounded-lg h-full w-full" />;
};

export default OntologyGraph;






