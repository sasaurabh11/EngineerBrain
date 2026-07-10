import asyncio
import json
import re
import xml.etree.ElementTree as ET
from collections import defaultdict

import httpx

from app.analysis.analyzer import AnalysisContext, RawFinding
from app.indexing.import_resolver import resolve_import_target

HIGH_COUPLING_THRESHOLD = 10
DEEP_DEPENDENCY_THRESHOLD = 8
OSV_API_URL = "https://api.osv.dev/v1/query"


def _build_file_graph(context: AnalysisContext) -> dict[str, set[str]]:
    all_paths = {f.path for f in context.files}
    graph: dict[str, set[str]] = defaultdict(set)
    for file in context.files:
        for imp in file.parsed.imports:
            target = resolve_import_target(file.path, imp.module, file.language, all_paths)
            if target and target != file.path:
                graph[file.path].add(target)
    return graph


def _find_cycles(graph: dict[str, set[str]]) -> list[list[str]]:
    """DFS with a recursion-stack marker to detect back-edges (cycles)."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = defaultdict(int)
    cycles: list[list[str]] = []
    stack: list[str] = []

    def dfs(node: str) -> None:
        color[node] = GRAY
        stack.append(node)
        for neighbor in graph.get(node, ()):
            if color[neighbor] == GRAY:
                idx = stack.index(neighbor)
                cycles.append([*stack[idx:], neighbor])
            elif color[neighbor] == WHITE:
                dfs(neighbor)
        stack.pop()
        color[node] = BLACK

    for node in list(graph.keys()):
        if color[node] == WHITE:
            dfs(node)

    return cycles


class CircularDependencyAnalyzer:
    name = "circular_dependency"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        graph = _build_file_graph(context)
        findings: list[RawFinding] = []
        seen: set[frozenset] = set()

        for cycle in _find_cycles(graph):
            key = frozenset(cycle)
            if key in seen:
                continue
            seen.add(key)
            chain = " -> ".join(cycle)
            findings.append(
                RawFinding(
                    category="DEPENDENCY",
                    type="CIRCULAR_DEPENDENCY",
                    severity="MEDIUM",
                    title=f"Circular dependency: {' -> '.join(cycle[:-1])}",
                    explanation=f"These files import each other in a cycle: {chain}. Circular imports make modules harder to reason about independently and can cause load-order bugs.",
                    suggested_fix="Break the cycle by extracting the logic both sides depend on into a separate module that neither imports back from.",
                    confidence=95,
                    file_path=cycle[0],
                    metadata={"cycle": cycle},
                )
            )
        return findings


class ModuleCouplingAnalyzer:
    name = "module_coupling"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        graph = _build_file_graph(context)
        efferent: dict[str, int] = {path: len(targets) for path, targets in graph.items()}
        afferent: dict[str, int] = defaultdict(int)
        for targets in graph.values():
            for target in targets:
                afferent[target] += 1

        findings: list[RawFinding] = []
        for file in context.files:
            out_count = efferent.get(file.path, 0)
            in_count = afferent.get(file.path, 0)
            if out_count <= HIGH_COUPLING_THRESHOLD and in_count <= HIGH_COUPLING_THRESHOLD:
                continue
            findings.append(
                RawFinding(
                    category="DEPENDENCY",
                    type="HIGH_MODULE_COUPLING",
                    severity="LOW",
                    title=f"{file.path} has high coupling ({out_count} outgoing, {in_count} incoming)",
                    explanation=f"{file.path} depends on {out_count} other repository files and is depended on by {in_count} others. Highly coupled modules are risky to change and hard to test in isolation.",
                    suggested_fix="Consider whether this module has too many responsibilities, and whether some dependencies could be inverted or extracted.",
                    confidence=70,
                    file_path=file.path,
                    metadata={"efferent_coupling": out_count, "afferent_coupling": in_count},
                )
            )
        return findings


class DependencyDepthAnalyzer:
    name = "dependency_depth"

    def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        graph = _build_file_graph(context)
        memo: dict[str, int] = {}
        visiting: set[str] = set()

        def depth(node: str) -> int:
            if node in memo:
                return memo[node]
            if node in visiting:
                return 0
            visiting.add(node)
            result = 1 + max((depth(n) for n in graph.get(node, ())), default=0)
            visiting.discard(node)
            memo[node] = result
            return result

        deepest_path: str | None = None
        deepest_value = 0
        for path in graph:
            value = depth(path)
            if value > deepest_value:
                deepest_value = value
                deepest_path = path

        if deepest_path is None or deepest_value <= DEEP_DEPENDENCY_THRESHOLD:
            return []

        return [
            RawFinding(
                category="DEPENDENCY",
                type="DEEP_DEPENDENCY_CHAIN",
                severity="LOW",
                title=f"Deep dependency chain starting at {deepest_path} ({deepest_value} levels)",
                explanation=f"The longest import chain starting from {deepest_path} is {deepest_value} files deep, making it hard to predict what a change might affect.",
                suggested_fix="Consider flattening the dependency structure or introducing a shared lower-level module.",
                confidence=60,
                file_path=deepest_path,
                metadata={"depth": deepest_value},
            )
        ]


def _strip_version_prefix(version: str) -> str:
    return re.sub(r"^[\^~>=<\s]+", "", version).strip()


def _parse_npm_manifest(content: str) -> list[tuple[str, str, str]]:
    try:
        data = json.loads(content)
    except ValueError:
        return []
    packages: list[tuple[str, str, str]] = []
    for section in ("dependencies", "devDependencies"):
        for name, version in (data.get(section) or {}).items():
            clean_version = _strip_version_prefix(str(version))
            if clean_version:
                packages.append((name, clean_version, "npm"))
    return packages


def _parse_pypi_manifest(content: str) -> list[tuple[str, str, str]]:
    packages: list[tuple[str, str, str]] = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.match(r"^([A-Za-z0-9_.\-]+)\s*==\s*([A-Za-z0-9_.\-]+)", line)
        if match:
            packages.append((match.group(1), match.group(2), "PyPI"))
    return packages


def _local_tag(elem: ET.Element) -> str:
    return elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag


def _parse_maven_manifest(content: str) -> list[tuple[str, str, str]]:
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        return []

    packages: list[tuple[str, str, str]] = []
    for elem in root.iter():
        if _local_tag(elem) != "dependency":
            continue
        group_id = artifact_id = version = None
        for child in elem:
            tag = _local_tag(child)
            if tag == "groupId":
                group_id = child.text
            elif tag == "artifactId":
                artifact_id = child.text
            elif tag == "version":
                version = child.text
        if group_id and artifact_id and version and not version.startswith("$"):
            packages.append((f"{group_id}:{artifact_id}", version, "Maven"))
    return packages


_MANIFEST_PARSERS = {
    "package.json": _parse_npm_manifest,
    "requirements.txt": _parse_pypi_manifest,
    "pom.xml": _parse_maven_manifest,
}


async def _query_osv(client: httpx.AsyncClient, name: str, version: str, ecosystem: str) -> list[dict] | None:
    try:
        response = await client.post(OSV_API_URL, json={"package": {"name": name, "ecosystem": ecosystem}, "version": version})
        response.raise_for_status()
        return response.json().get("vulns", [])
    except httpx.HTTPError:
        return None


_OSV_SEVERITY_MAP = {"CRITICAL": "CRITICAL", "HIGH": "HIGH", "MODERATE": "MEDIUM", "LOW": "LOW"}


class UnsafeDependencyAnalyzer:
    """Real CVE matching via the free OSV.dev API - only pinned/exact versions
    can be checked (an unpinned Python requirement has no single version to
    look up), which is why the PyPI manifest parser only extracts `==` pins."""

    name = "unsafe_dependencies"

    async def analyze(self, context: AnalysisContext) -> list[RawFinding]:
        packages: list[tuple[str, str, str]] = []
        for filename, content in context.dependency_manifests.items():
            parser = _MANIFEST_PARSERS.get(filename)
            if parser is not None:
                packages.extend(parser(content))

        if not packages:
            return []

        findings: list[RawFinding] = []
        async with httpx.AsyncClient(timeout=10.0) as client:
            results = await asyncio.gather(*(_query_osv(client, name, version, ecosystem) for name, version, ecosystem in packages))

        for (name, version, _ecosystem), vulns in zip(packages, results):
            if not vulns:
                continue
            top = vulns[0]
            severity_raw = (top.get("database_specific") or {}).get("severity", "").upper()
            severity = _OSV_SEVERITY_MAP.get(severity_raw, "MEDIUM")
            findings.append(
                RawFinding(
                    category="DEPENDENCY",
                    type="UNSAFE_DEPENDENCY",
                    severity=severity,
                    title=f"{name}@{version} has {len(vulns)} known vulnerabilit{'y' if len(vulns) == 1 else 'ies'}",
                    explanation=f"{name}@{version}: {top.get('summary', 'known vulnerability')} ({top.get('id', 'unknown id')}).",
                    suggested_fix=f"Upgrade {name} to a version past the affected range.",
                    confidence=90,
                    metadata={"package": name, "version": version, "vuln_ids": [v.get("id") for v in vulns]},
                )
            )
        return findings
