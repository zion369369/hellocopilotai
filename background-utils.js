// background-utils.js - Utilities ported from OpenClaw for Hello Co-Pilot

export function isMissingTabError(err) {
    const message = (err instanceof Error ? err.message : String(err || "")).toLowerCase();
    return (
        message.includes("no tab with id") ||
        message.includes("no tab with given id") ||
        message.includes("tab not found")
    );
}

function axValue(v) {
    if (!v || typeof v !== "object") {
        return "";
    }
    const value = v.value;
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return "";
}

/**
 * Formats a raw AXTree from Accessibility.getFullAXTree into a concise list of semantic nodes.
 * @param {Array} nodes 
 * @param {number} limit 
 * @returns {Array}
 */
export function formatAriaSnapshot(nodes, limit) {
    if (!Array.isArray(nodes) || nodes.length === 0) return [];

    const byId = new Map();
    for (const n of nodes) {
        if (n.nodeId) {
            byId.set(n.nodeId, n);
        }
    }

    // Heuristic: pick a root-ish node (one that is not referenced as a child), else first.
    const referenced = new Set();
    for (const n of nodes) {
        for (const c of n.childIds ?? []) {
            referenced.add(c);
        }
    }
    const root = nodes.find((n) => n.nodeId && !referenced.has(n.nodeId)) ?? nodes[0];
    if (!root?.nodeId) {
        return [];
    }

    const out = [];
    const stack = [{ id: root.nodeId, depth: 0 }];
    while (stack.length && out.length < limit) {
        const popped = stack.pop();
        if (!popped) {
            break;
        }
        const { id, depth } = popped;
        const n = byId.get(id);
        if (!n) {
            continue;
        }
        const role = axValue(n.role);
        const name = axValue(n.name);
        const value = axValue(n.value);
        const description = axValue(n.description);

        // Only include nodes with a role or name, or that have children (as structure)
        // Filter out generic containers with no name to keep it concise
        if (role || name || value || description) {
            const ref = `ax${out.length + 1}`;
            out.push({
                ref,
                role: role || "unknown",
                name: name || "",
                ...(value ? { value } : {}),
                ...(description ? { description } : {}),
                ...(typeof n.backendDOMNodeId === "number" ? { backendDOMNodeId: n.backendDOMNodeId } : {}),
                depth,
            });
        }

        const children = (n.childIds ?? []).filter((c) => byId.has(c));
        for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            if (child) {
                stack.push({ id: child, depth: depth + 1 });
            }
        }
    }

    return out;
}

export function convertAriaSnapshotToMarkdown(ariaNodes) {
    return ariaNodes.map(n => {
        const indent = "  ".repeat(n.depth);
        let text = `${indent}[${n.ref}] <${n.role}> "${n.name}"`;
        if (n.value) text += ` value: "${n.value}"`;
        if (n.description) text += ` desc: "${n.description}"`;
        return text;
    }).join("\n");
}
