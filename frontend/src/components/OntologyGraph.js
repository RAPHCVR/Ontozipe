import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { DataSet, Network } from "vis-network/standalone";
const OntologyGraph = ({ graph, onClassHover, onClassClick, }) => {
    const containerRef = useRef(null);
    const networkRef = useRef(null);
    const hoverCb = useRef(onClassHover);
    const clickCb = useRef(onClassClick);
    useEffect(() => {
        hoverCb.current = onClassHover;
        clickCb.current = onClassClick;
    }, [onClassHover, onClassClick]);
    useEffect(() => {
        const { nodes: rawNodes, edges: rawEdges } = graph;
        const nodes = new DataSet(rawNodes);
        const edges = new DataSet(rawEdges);
        const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const classIds = new Set(rawNodes.map((n) => n.id));
        const network = new Network(containerRef.current, { nodes, edges }, {
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
        });
        networkRef.current = network;
        // --- class hover events ---
        network.on("hoverNode", (params) => {
            const id = params.node;
            if (classIds.has(id))
                hoverCb.current(id);
        });
        network.on("blurNode", () => hoverCb.current(null));
        // --- click events ---
        network.on("click", (params) => {
            if (params.nodes.length) {
                const id = params.nodes[0];
                if (classIds.has(id))
                    clickCb.current(id);
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
    return _jsx("div", { ref: containerRef, className: "border rounded-lg h-full w-full" });
};
export default OntologyGraph;
