import React, { useEffect, useRef } from "react";
import { DataSet, Network } from "vis-network/standalone";

type OntologyGraphProps = {
	graph: { nodes: any[]; edges: any[] };
	onClassHover: (id: string | null) => void;
	onClassClick: (id: string) => void;
    onReady?: () => void;
};

const OntologyGraph: React.FC<OntologyGraphProps> = ({
	graph,
	onClassHover,
	onClassClick,
    onReady,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const networkRef = useRef<Network | null>(null);
	const hoverCb = useRef(onClassHover);
	const clickCb = useRef(onClassClick);
	const readyCb = useRef(onReady);
	useEffect(() => {
		hoverCb.current = onClassHover;
		clickCb.current = onClassClick;
		readyCb.current = onReady;
	}, [onClassHover, onClassClick, onReady]);

	useEffect(() => {
		const { nodes: rawNodes, edges: rawEdges } = graph;
		const nodes = new DataSet(rawNodes);
		const edges = new DataSet(rawEdges);
		const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

		const classIds = new Set(rawNodes.map((n: any) => n.id));

		const network = new Network(
			containerRef.current!,
			{ nodes, edges },
			{
				nodes: {
					shape: "box",
					font: { size: 20, color: "#000", face: "Inter" },
					color: {
						background: "#facc15",
						border: "#eab308",
						highlight: {
							background: "#fde047",
							border: "#eab308",
						},
						hover: {
							background: "#fde047",
							border: "#eab308",
						},
					},
				},
				edges: {
					arrows: { to: { enabled: true, scaleFactor: 0.5 } },
					color: { color: darkMode ? "#94a3b8" : "#9ca3af" },
				},
				layout: { improvedLayout: true },
				physics: { stabilization: { iterations: 500 } },
				interaction: { hover: true, tooltipDelay: 200 },
				autoResize: true,
				height: "100%",
				width: "100%",
			}
		);
		networkRef.current = network;

		if (readyCb.current) {
			let notified = false;
			const markReady = () => {
				if (notified) return;
				notified = true;
				readyCb.current?.();
			};
			network.once("stabilizationIterationsDone", markReady);
			network.once("afterDrawing", markReady);
		}

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
			networkRef.current?.destroy();
		};
	}, [graph]);

	return <div ref={containerRef} className="border rounded-lg h-full w-full" />;
};

export default OntologyGraph;
